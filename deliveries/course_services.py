from decimal import Decimal, ROUND_HALF_UP
from math import atan2, ceil, cos, radians, sin, sqrt
from datetime import time, timedelta
from zoneinfo import ZoneInfo

import requests
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import Course, CourseEvent, CourseOffer, Livreur


OFFER_TTL_SECONDS = 60


def offer_deadline(now=None):
    """Horodatage d'expiration d'une nouvelle offre (compte à rebours Uber)."""
    now = now or timezone.now()
    return now + timedelta(seconds=settings.COURSE_OFFER_TTL_SECONDS)


def expire_stale_offers(now=None):
    """Retire les offres périmées pour qu'elles ne restent plus proposables."""
    now = now or timezone.now()
    return CourseOffer.objects.filter(
        response="pending",
        expires_at__isnull=False,
        expires_at__lte=now,
        course__status__in=["searching", "driver_accepted"],
        course__livreur__isnull=True,
    ).update(response="withdrawn", responded_at=now)


def remaining_offer_seconds(expires_at, now=None):
    """Secondes restantes avant expiration (0 si déjà expirée, None sans limite)."""
    if expires_at is None:
        return None
    now = now or timezone.now()
    return max(0, int((expires_at - now).total_seconds()))


def distance_km(latitude_a, longitude_a, latitude_b, longitude_b):
    earth_radius_km = 6371.0088
    latitude_delta = radians(latitude_b - latitude_a)
    longitude_delta = radians(longitude_b - longitude_a)
    value = (
        sin(latitude_delta / 2) ** 2
        + cos(radians(latitude_a))
        * cos(radians(latitude_b))
        * sin(longitude_delta / 2) ** 2
    )
    return earth_radius_km * 2 * atan2(sqrt(value), sqrt(1 - value))


def current_surcharge_percent(now=None):
    now = (now or timezone.now()).astimezone(ZoneInfo(settings.COURSE_TARIFF_TIME_ZONE)).time()
    start = time.fromisoformat(settings.COURSE_SURCHARGE_START)
    end = time.fromisoformat(settings.COURSE_SURCHARGE_END)
    in_window = start <= now < end if start <= end else now >= start or now < end
    return Decimal(settings.COURSE_SURCHARGE_PERCENT) if in_window else Decimal("0")


def adjusted_price(proposed_price, surcharge_percent):
    multiplier = Decimal("1") + Decimal(surcharge_percent) / Decimal("100")
    return (Decimal(proposed_price) * multiplier).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def suggested_price(distance):
    minimum = Decimal(settings.COURSE_MIN_PRICE_DZD)
    price_per_km = Decimal(settings.COURSE_PRICE_PER_KM_DZD)
    distance_price = (Decimal(str(distance)) * price_per_km).quantize(
        Decimal("1"), rounding=ROUND_HALF_UP
    )
    return max(minimum, distance_price)


def resolve_destination(destination):
    try:
        response = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": destination, "format": "jsonv2", "limit": 1},
            headers={"User-Agent": "WinRak/1.0 (course routing)"},
            timeout=4,
        )
        response.raise_for_status()
        result = response.json()
        if result:
            return float(result[0]["lat"]), float(result[0]["lon"])
    except (requests.RequestException, ValueError, KeyError, IndexError, TypeError):
        pass
    return None


def resolve_destination_label(latitude, longitude, *, full_address=False):
    try:
        response = requests.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={"lat": latitude, "lon": longitude, "format": "jsonv2"},
            headers={"User-Agent": "WinRak/1.0 (course routing)"},
            timeout=4,
        )
        response.raise_for_status()
        result = response.json()
        if full_address:
            return result.get("display_name") or result.get("name")
        return result.get("name") or result.get("display_name")
    except (requests.RequestException, ValueError, AttributeError, TypeError):
        return None


def resolve_route(start_lat, start_lon, destination_lat, destination_lon):
    if destination_lat is None or destination_lon is None:
        return None, None
    try:
        response = requests.get(
            f"https://router.project-osrm.org/route/v1/driving/{start_lon},{start_lat};{destination_lon},{destination_lat}",
            params={"overview": "full", "geometries": "geojson"},
            timeout=4,
        )
        response.raise_for_status()
        route = response.json()["routes"][0]
        return round(route["distance"] / 1000, 2), route["geometry"]["coordinates"]
    except (requests.RequestException, ValueError, KeyError, IndexError, TypeError):
        return round(distance_km(start_lat, start_lon, destination_lat, destination_lon), 2), None


def record_course_event(course, event_type, actor_type="", actor_id=None, previous_status="", new_status="", details=None):
    return CourseEvent.objects.create(
        course=course,
        actor_type=actor_type,
        actor_id=actor_id,
        event_type=event_type,
        previous_status=previous_status,
        new_status=new_status,
        details=details or {},
    )


# ---------------------------------------------------------------------------
# Expérience "livreur Uber de commandes" : retrait chez le commerçant,
# livraison chez le client, ETA estimées et rediffusion automatique.
# ---------------------------------------------------------------------------

def eta_minutes(distance_km, buffer_minutes=0):
    """Durée de trajet estimée en minutes (arrondi supérieur, jamais 0 dès 1 km)."""
    if distance_km is None:
        return None
    distance_km = max(0.0, float(distance_km))
    speed = max(1.0, float(settings.COURSE_ETA_SPEED_KMH))
    travel_minutes = ceil((distance_km / speed) * 60)
    return max(1, travel_minutes + int(buffer_minutes))


def resolve_legs(client_lat, client_lon, pickup_lat, pickup_lon, dropoff_lat, dropoff_lon, router=None):
    """Découpe un parcours de livraison en deux jambes : retrait puis livraison.

    Retourne la géométrie et la distance de chaque jambe. Quand aucun commerçant
    n'est fourni, le retrait s'effectue depuis la position du client : on ne fait
    alors qu'un seul appel de routage (client -> livraison), ce qui préserve le
    comportement historique de l'API.

    `router` est injectable pour permettre de neutraliser les appels réseau
    (tests, environments hors ligne).
    """
    router = router or resolve_route
    if pickup_lat is None or pickup_lon is None:
        trip_distance, trip_geometry = router(
            client_lat, client_lon, dropoff_lat, dropoff_lon
        )
        return {
            "has_pickup": False,
            "pickup_distance_km": 0.0,
            "pickup_route_geometry": None,
            "trip_distance_km": trip_distance,
            "trip_route_geometry": trip_geometry,
        }

    pickup_distance, pickup_geometry = router(
        client_lat, client_lon, pickup_lat, pickup_lon
    )
    trip_distance, trip_geometry = router(
        pickup_lat, pickup_lon, dropoff_lat, dropoff_lon
    )
    return {
        "has_pickup": True,
        "pickup_distance_km": pickup_distance,
        "pickup_route_geometry": pickup_geometry,
        "trip_distance_km": trip_distance,
        "trip_route_geometry": trip_geometry,
    }


def matching_vehicle_types(vehicle_type):
    """Véhicules compatibles avec une commande (les motos couvrent les scooters)."""
    if vehicle_type == "moto":
        return ["moto", "scooter"]
    return [vehicle_type]


def eligible_drivers_for_course(course):
    """Livreurs en ligne, du bon véhicule, proches du point de retrait.

    Le rayon de recherche est centré sur le commerçant : c'est le livreur le plus
    proche du restaurant qui décroche en premier. Sans commerçant désigné, on
    retombe sur la position du client. Un livreur déjà sollicité (quelle que soit
    la vague) ou déjà en course est exclu.
    """
    origin_lat, origin_lon = course.pickup_position
    if origin_lat is None or origin_lon is None:
        return []

    already_offered = CourseOffer.objects.filter(course=course).values_list(
        "livreur_id", flat=True
    )
    busy_drivers = Course.objects.filter(active=True).exclude(pk=course.pk).exclude(
        livreur__isnull=True
    ).values_list("livreur_id", flat=True)

    candidates = Livreur.objects.select_related("user").filter(
        user__is_active=True,
        fcm_token__gt="",
        latitude__isnull=False,
        longitude__isnull=False,
        est_en_ligne=True,
        vehicule__in=matching_vehicle_types(course.vehicle_type),
    ).exclude(id__in=already_offered).exclude(id__in=busy_drivers)

    radius_km = settings.COURSE_SEARCH_RADIUS_KM
    nearby = [
        (driver, distance_km(origin_lat, origin_lon, driver.latitude, driver.longitude))
        for driver in candidates
    ]
    nearby = [item for item in nearby if item[1] <= radius_km]
    # Les plus proches d'abord : ils sont les plus rapides à faire la course.
    nearby.sort(key=lambda item: item[1])
    return nearby[: settings.COURSE_OFFER_MAX_DRIVERS_PER_ROUND]


def _build_offers(course, drivers, expires_at):
    """Offres avec, pour chaque livreur, sa distance et son ETA vers le retrait."""
    return [
        CourseOffer(
            course=course,
            livreur=driver,
            expires_at=expires_at,
            round_number=course.broadcast_round,
            pickup_distance_km=round(driver_distance, 2),
            pickup_eta_minutes=eta_minutes(
                driver_distance, settings.COURSE_ETA_PICKUP_BUFFER_MINUTES
            ),
            dropoff_distance_km=course.trip_distance_km,
            dropoff_eta_minutes=eta_minutes(course.trip_distance_km),
        )
        for driver, driver_distance in drivers
    ]


def broadcast_course_offers(course, now=None, notifier=None):
    """Diffuse la course à une nouvelle vague de livreurs et notifie via FCM.

    Idempotent : un livreur déjà sollicité pour cette course, quelle que soit la
    vague, ne reçoit jamais deux fois la même proposition. `notifier` est
    injectable pour permettre de neutraliser l'envoi push (tests).
    """
    if notifier is None:
        from .firebase import send_livreur_notification as notifier

    now = now or timezone.now()
    drivers = eligible_drivers_for_course(course)
    if not drivers:
        record_course_event(
            course, "dispatch_exhausted", details={"round": course.broadcast_round}
        )
        return []

    expires_at = offer_deadline(now)
    CourseOffer.objects.bulk_create(_build_offers(course, drivers, expires_at))
    course.last_offer_at = now
    course.save(update_fields=["last_offer_at"])

    record_course_event(
        course,
        "drivers_notified",
        details={
            "livreur_ids": [driver.id for driver, _ in drivers],
            "round": course.broadcast_round,
        },
    )

    notification_price = format(Decimal(course.final_price).normalize(), "f")
    for driver, _ in drivers:
        transaction.on_commit(
            lambda driver=driver: notifier(
                driver,
                "رحلة جديدة",
                f"{notification_price} دج",
                course_id=course.id,
                notification_type="course_offer",
                extra_data={
                    "round": course.broadcast_round,
                    "price": notification_price,
                    "pickup_address": course.pickup_address or course.pickup_name or "موقع العميل",
                    "destination": course.destination or "تفاصيل الرحلة",
                },
            )
        )
    return [driver for driver, _ in drivers]


def dispatch_expired_courses(now=None):
    """Rediffuse les courses dont la vague d'offres est tombée dans le vide.

    C'est la garantie « Uber » : une commande ne reste pas figée en attente
    parce que personne n'a répondu à la première vague. On passe à la vague
    suivante jusqu'à épuisement du nombre de vagues autorisé.
    """
    now = now or timezone.now()
    threshold = now - timedelta(seconds=settings.COURSE_OFFER_ROUND_DELAY_SECONDS)

    candidates = (
        Course.objects.filter(
            status="searching",
            livreur__isnull=True,
            active=True,
            broadcast_round__lt=settings.COURSE_OFFER_MAX_ROUNDS,
            last_offer_at__isnull=False,
            last_offer_at__lte=threshold,
        )
        .exclude(offers__response__in=["pending", "accepted"])
        .distinct()
    )

    dispatched = []
    for course in candidates:
        previous_round = course.broadcast_round
        course.broadcast_round = previous_round + 1
        course.save(update_fields=["broadcast_round"])
        record_course_event(
            course,
            "offers_rebroadcast",
            details={"previous_round": previous_round, "round": course.broadcast_round},
        )
        if broadcast_course_offers(course, now=now):
            dispatched.append(course.id)

    return dispatched

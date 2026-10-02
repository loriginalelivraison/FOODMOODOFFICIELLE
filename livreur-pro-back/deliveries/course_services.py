from decimal import Decimal, ROUND_HALF_UP
from math import atan2, cos, radians, sin, sqrt
from datetime import time
from zoneinfo import ZoneInfo

import requests
from django.conf import settings
from django.utils import timezone

from .models import CourseEvent


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


def resolve_destination_label(latitude, longitude):
    try:
        response = requests.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={"lat": latitude, "lon": longitude, "format": "jsonv2"},
            headers={"User-Agent": "WinRak/1.0 (course routing)"},
            timeout=4,
        )
        response.raise_for_status()
        result = response.json()
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

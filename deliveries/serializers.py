from rest_framework import serializers
from .models import Livreur, DemandeLivraison, CommentaireLivreur, Client, Course

# Étapes de navigation d'un livreur de commandes : d'abord le retrait chez le
# commerçant, puis la livraison chez le client.
PICKUP_STATUSES = (
    "searching",
    "driver_accepted",
    "driver_selected",
    "driver_arriving",
    "driver_arrived",
)
DROPOFF_STATUSES = ("picked_up", "in_progress")


def navigation_stage(course):
    """Étape courante du parcours : retrait, livraison, ou terminé."""
    if course.status in PICKUP_STATUSES:
        return "to_pickup"
    if course.status in DROPOFF_STATUSES:
        return "to_dropoff"
    return "done"


class LivreurSerializer(serializers.ModelSerializer):
    class Meta:
        model = Livreur
        fields = "__all__"


class DemandeLivraisonSerializer(serializers.ModelSerializer):
    livreur_detail = LivreurSerializer(source="livreur", read_only=True)

    class Meta:
        model = DemandeLivraison
        fields = "__all__"

class CommentaireLivreurSerializer(serializers.ModelSerializer):
    class Meta:
        model = CommentaireLivreur
        fields = "__all__"

class ClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = [
            "id",
            "user",
            "nom",
            "telephone",
            "points",
            "created_at",
        ]
        read_only_fields = ["user", "points", "created_at"]

class CourseSerializer(serializers.ModelSerializer):
    finished_by_name = serializers.SerializerMethodField()
    finished_by_type = serializers.SerializerMethodField()
    accepted_drivers = serializers.SerializerMethodField()
    events = serializers.SerializerMethodField()
    my_offer_response = serializers.SerializerMethodField()
    my_offer_expires_in = serializers.SerializerMethodField()
    my_offer_pickup_eta_minutes = serializers.SerializerMethodField()
    my_offer_pickup_distance_km = serializers.SerializerMethodField()
    my_offer_dropoff_eta_minutes = serializers.SerializerMethodField()
    navigation = serializers.SerializerMethodField()

    def get_my_offer_response(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        offer = obj.offers.filter(livreur__user=request.user).values_list("response", flat=True).first()
        return offer

    def get_my_offer_expires_in(self, obj):
        """Secondes restantes pour accepter l'offre (compte à rebours Uber)."""
        from .course_services import remaining_offer_seconds

        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        expires_at = obj.offers.filter(
            livreur__user=request.user,
            response="pending",
        ).values_list("expires_at", flat=True).first()
        if expires_at is None:
            return None
        return remaining_offer_seconds(expires_at)

    def get_accepted_drivers(self, obj):
        from .course_services import distance_km

        request = self.context.get("request")
        if not request or not request.user.is_authenticated or obj.client.user_id != request.user.id:
            return []

        accepted = obj.offers.filter(response="accepted").select_related("livreur")
        drivers = []
        for offer in accepted:
            driver = offer.livreur
            distance = None
            if obj.client_latitude is not None and obj.client_longitude is not None and driver.latitude is not None and driver.longitude is not None:
                distance = round(distance_km(obj.client_latitude, obj.client_longitude, driver.latitude, driver.longitude), 1)
            drivers.append({
                "id": driver.id,
                "nom": driver.nom,
                "vehicule": driver.vehicule,
                "telephone": driver.telephone,
                "note": driver.note,
                "latitude": driver.latitude,
                "longitude": driver.longitude,
                "distance_km": distance,
            })
        return drivers

    def get_events(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return []
        driver = obj.livreur
        if obj.client.user_id != request.user.id and (not driver or driver.user_id != request.user.id):
            return []
        return list(obj.events.values(
            "event_type", "actor_type", "actor_id", "previous_status", "new_status", "details", "created_at"
        ))

    def _my_offer(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        return obj.offers.filter(livreur__user=request.user).first()

    def get_my_offer_pickup_eta_minutes(self, obj):
        """Minutes estimées pour rejoindre le commerçant (base de la carte d'offre)."""
        offer = self._my_offer(obj)
        return offer.pickup_eta_minutes if offer else obj.pickup_eta_minutes

    def get_my_offer_pickup_distance_km(self, obj):
        offer = self._my_offer(obj)
        return offer.pickup_distance_km if offer else None

    def get_my_offer_dropoff_eta_minutes(self, obj):
        """Minutes estimées entre le commerçant et le client."""
        offer = self._my_offer(obj)
        return offer.dropoff_eta_minutes if offer else obj.dropoff_eta_minutes

    def get_navigation(self, obj):
        """Consigne de navigation courante : où aller, sur quelle jambe, ETA.

        Alimente la carte in-app du livreur comme le suivi côté client, sans
        que le front ait à recalculer quoi que ce soit.
        """
        stage = navigation_stage(obj)
        dropoff_lat, dropoff_lon = obj.dropoff_position
        dropoff_distance = obj.trip_distance_km or obj.estimated_distance_km
        tail = {
            "dropoff_latitude": dropoff_lat,
            "dropoff_longitude": dropoff_lon,
            "dropoff_distance_km": dropoff_distance,
            "dropoff_eta_minutes": obj.dropoff_eta_minutes,
        }

        if stage == "to_pickup":
            pickup_lat, pickup_lon = obj.pickup_position
            return {
                "stage": stage,
                "target_latitude": pickup_lat,
                "target_longitude": pickup_lon,
                "target_label": obj.pickup_name or obj.pickup_address or "نقطة الاستلام",
                "route_geometry": obj.pickup_route_geometry or obj.route_geometry,
                "distance_km": obj.pickup_distance_km,
                "eta_minutes": obj.pickup_eta_minutes,
                **tail,
            }

        if stage == "to_dropoff":
            return {
                "stage": stage,
                "target_latitude": dropoff_lat,
                "target_longitude": dropoff_lon,
                "target_label": obj.destination or "عنوان العميل",
                "route_geometry": obj.trip_route_geometry or obj.route_geometry,
                "distance_km": dropoff_distance,
                "eta_minutes": obj.dropoff_eta_minutes,
                **tail,
            }

        return {
            "stage": stage,
            "target_latitude": None,
            "target_longitude": None,
            "target_label": None,
            "route_geometry": None,
            "distance_km": None,
            "eta_minutes": None,
            **tail,
        }

    def get_finished_by_name(self, obj):
        if obj.finished_by:
            return obj.finished_by.nom
        if obj.finished_by_client:
            return obj.finished_by_client.nom
        return None

    def get_finished_by_type(self, obj):
        if obj.finished_by:
            return "livreur"
        if obj.finished_by_client:
            return "client"
        return None

    class Meta:
        model = Course
        fields = [
            "id",
            "client",
            "livreur",
            "finished_by",
            "finished_by_client",
            "finished_by_name",
            "finished_by_type",
            "client_latitude",
            "client_longitude",
            "destination",
            "destination_latitude",
            "destination_longitude",
            "pickup_name",
            "pickup_address",
            "pickup_phone",
            "pickup_latitude",
            "pickup_longitude",
            "pickup_route_geometry",
            "pickup_distance_km",
            "pickup_eta_minutes",
            "trip_route_geometry",
            "trip_distance_km",
            "dropoff_eta_minutes",
            "broadcast_round",
            "vehicle_type",
            "estimated_distance_km",
            "route_geometry",
            "proposed_price",
            "surcharge_percent",
            "final_price",
            "status",
            "client_confirmed",
            "active",
            "created_at",
            "finished_at",
            "arrived_at",
            "picked_up_at",
            "started_at",
            "cancelled_at",
            "cancelled_by_type",
            "cancellation_reason",
            "cancellation_comment",
            "previous_status",
            "accepted_drivers",
            "events",
            "my_offer_response",
            "my_offer_expires_in",
            "my_offer_pickup_eta_minutes",
            "my_offer_pickup_distance_km",
            "my_offer_dropoff_eta_minutes",
            "navigation",
        ]
        read_only_fields = [
            "finished_by",
            "finished_by_client",
            "finished_by_name",
            "finished_by_type",
            "client_confirmed",
            "status",
            "active",
            "created_at",
            "finished_at",
            "arrived_at",
            "picked_up_at",
            "started_at",
            "cancelled_at",
            "accepted_drivers",
            "events",
            "my_offer_response",
            "my_offer_expires_in",
            "my_offer_pickup_eta_minutes",
            "my_offer_pickup_distance_km",
            "my_offer_dropoff_eta_minutes",
            "navigation",
        ]

class LivreurSerializer(serializers.ModelSerializer):
    class Meta:
        model = Livreur
        fields = "__all__"
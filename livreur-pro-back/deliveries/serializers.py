from rest_framework import serializers
from .models import Livreur, DemandeLivraison, CommentaireLivreur, Client, Course


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
            "created_at",
        ]
        read_only_fields = ["user", "created_at"]

class CourseSerializer(serializers.ModelSerializer):
    finished_by_name = serializers.SerializerMethodField()
    finished_by_type = serializers.SerializerMethodField()
    accepted_drivers = serializers.SerializerMethodField()
    events = serializers.SerializerMethodField()
    my_offer_response = serializers.SerializerMethodField()

    def get_my_offer_response(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        offer = obj.offers.filter(livreur__user=request.user).values_list("response", flat=True).first()
        return offer

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
            "started_at",
            "cancelled_at",
            "cancelled_by_type",
            "cancellation_reason",
            "cancellation_comment",
            "previous_status",
            "accepted_drivers",
            "events",
            "my_offer_response",
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
            "started_at",
            "cancelled_at",
            "accepted_drivers",
            "events",
            "my_offer_response",
        ]

class LivreurSerializer(serializers.ModelSerializer):
    class Meta:
        model = Livreur
        fields = "__all__"
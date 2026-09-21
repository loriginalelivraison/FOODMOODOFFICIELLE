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
            "client_confirmed",
            "active",
            "created_at",
            "finished_at",
        ]
        read_only_fields = [
            "finished_by",
            "finished_by_client",
            "finished_by_name",
            "finished_by_type",
            "client_confirmed",
        ]

class LivreurSerializer(serializers.ModelSerializer):
    class Meta:
        model = Livreur
        fields = "__all__"
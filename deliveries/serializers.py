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
    livreur_nom = serializers.CharField(source="livreur.nom", read_only=True)

    class Meta:
        model = CommentaireLivreur
        fields = [
            "id",
            "livreur",
            "livreur_nom",
            "nom_client",
            "message",
            "created_at",
        ]

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
    class Meta:
        model = Course
        fields = "__all__"

class LivreurSerializer(serializers.ModelSerializer):
    class Meta:
        model = Livreur
        fields = "__all__"
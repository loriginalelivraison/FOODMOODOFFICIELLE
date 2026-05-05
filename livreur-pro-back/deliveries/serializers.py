from rest_framework import serializers
from .models import Livreur, DemandeLivraison

class LivreurSerializer(serializers.ModelSerializer):
    class Meta:
        model = Livreur
        fields = "__all__"


class DemandeLivraisonSerializer(serializers.ModelSerializer):
    livreur_detail = LivreurSerializer(source="livreur", read_only=True)

    class Meta:
        model = DemandeLivraison
        fields = "__all__"
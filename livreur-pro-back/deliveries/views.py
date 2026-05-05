from rest_framework.viewsets import ModelViewSet
from .models import Livreur, DemandeLivraison
from .serializers import LivreurSerializer, DemandeLivraisonSerializer
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from rest_framework.decorators import api_view
from django.contrib.auth.models import User


class LivreurViewSet(ModelViewSet):
    queryset = Livreur.objects.all().order_by("-disponible", "-note")
    serializer_class = LivreurSerializer

    @action(detail=True, methods=["patch"])
    def update_position(self, request, pk=None):
        livreur = self.get_object()

        latitude = request.data.get("latitude")
        longitude = request.data.get("longitude")

        if latitude is None or longitude is None:
            return Response(
                {"error": "latitude et longitude sont obligatoires"},
                status=status.HTTP_400_BAD_REQUEST
            )

        livreur.latitude = latitude
        livreur.longitude = longitude
        livreur.save()

        return Response({
            "message": "Position mise à jour",
            "id": livreur.id,
            "latitude": livreur.latitude,
            "longitude": livreur.longitude,
        })

class DemandeLivraisonViewSet(ModelViewSet):
    queryset = DemandeLivraison.objects.all().order_by("-created_at")
    serializer_class = DemandeLivraisonSerializer

@api_view(["POST"])
def register_livreur(request):
    nom = request.data.get("nom")
    email = request.data.get("email")
    telephone = request.data.get("telephone")
    ville = request.data.get("ville")
    vehicule = request.data.get("vehicule")
    password = request.data.get("password")

    if User.objects.filter(username=telephone).exists():
        return Response(
            {"error": "Un utilisateur avec cet email existe déjà"},
            status=status.HTTP_400_BAD_REQUEST
        )

    user = User.objects.create_user(
        username=telephone,
        email=email,
        password=password
    )

    livreur = Livreur.objects.create(
        user=user,
        nom=nom,
        email=email,
        telephone=telephone,
        ville=ville,
        vehicule=vehicule,
        disponible=True,
    )

    return Response({
        "message": "Livreur créé avec succès",
        "id": livreur.id,
    })
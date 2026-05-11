from rest_framework.viewsets import ModelViewSet
from .models import Livreur, DemandeLivraison, CommentaireLivreur, Client, Course
from .serializers import LivreurSerializer, DemandeLivraisonSerializer, CommentaireLivreurSerializer, ClientSerializer, CourseSerializer
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from rest_framework.decorators import api_view
from django.contrib.auth.models import User
from django.utils import timezone




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
        livreur.disponible = True
        livreur.save()

        return Response({
            "message": "Position mise à jour",
            "id": livreur.id,
            "latitude": livreur.latitude,
            "longitude": livreur.longitude,
        })

        
    #livreur indisponible
    @action(detail=True, methods=["patch"])
    def set_unavailable(self, request, pk=None):
        livreur = self.get_object()
        livreur.disponible = False
        livreur.save()

        return Response({
            "message": "Livreur passé en occupé",
            "id": livreur.id,
            "disponible": livreur.disponible,
        })



class DemandeLivraisonViewSet(ModelViewSet):
    queryset = DemandeLivraison.objects.all().order_by("-created_at")
    serializer_class = DemandeLivraisonSerializer

@api_view(["POST"])
def register_livreur(request):
    nom = request.data.get("nom")
    telephone = request.data.get("telephone")
    ville = request.data.get("ville")
    vehicule = request.data.get("vehicule")
    password = request.data.get("password")

    if not nom or not telephone or not password:
        return Response(
            {"error": "Nom, téléphone et mot de passe sont obligatoires"},
            status=status.HTTP_400_BAD_REQUEST
        )

    if User.objects.filter(username=telephone).exists():
        return Response(
            {"error": "Un compte avec ce téléphone existe déjà"},
            status=status.HTTP_400_BAD_REQUEST
        )

    if Livreur.objects.filter(telephone=telephone).exists():
        return Response(
            {"error": "Ce téléphone est déjà utilisé par un livreur"},
            status=status.HTTP_400_BAD_REQUEST
        )

    user = User.objects.create_user(
        username=telephone,
        password=password
    )

    livreur = Livreur.objects.create(
        user=user,
        nom=nom,
        telephone=telephone,
        ville=ville,
        vehicule=vehicule,
        disponible=True,
    )

    return Response({
        "message": "Livreur créé avec succès",
        "id": livreur.id,
        "nom": livreur.nom,
        "telephone": livreur.telephone,
    }, status=status.HTTP_201_CREATED)
    
class CommentaireLivreurViewSet(ModelViewSet):
    serializer_class = CommentaireLivreurSerializer

    def get_queryset(self):
        livreur_id = self.request.query_params.get("livreur")
        queryset = CommentaireLivreur.objects.all().order_by("-created_at")

        if livreur_id:
            queryset = queryset.filter(livreur_id=livreur_id)

        return queryset

class ClientViewSet(ModelViewSet):
    queryset = Client.objects.all().order_by("-created_at")
    serializer_class = ClientSerializer
@api_view(["POST"])
def register_client(request):
    nom = request.data.get("nom")
    telephone = request.data.get("telephone")
    password = request.data.get("password")

    if not nom or not telephone or not password:
        return Response(
            {"error": "Nom, téléphone et mot de passe sont obligatoires"},
            status=status.HTTP_400_BAD_REQUEST
        )

    if User.objects.filter(username=telephone).exists():
        return Response(
            {"error": "Un utilisateur avec ce téléphone existe déjà"},
            status=status.HTTP_400_BAD_REQUEST
        )

    user = User.objects.create_user(
        username=telephone,
        password=password
    )

    client = Client.objects.create(
        user=user,
        nom=nom,
        telephone=telephone,
        
    )

    return Response({
        "message": "Client créé avec succès",
        "id": client.id,
        "nom": client.nom,
        "telephone": client.telephone,
    }, status=status.HTTP_201_CREATED)

class CourseViewSet(ModelViewSet):
    queryset = Course.objects.all().order_by("-created_at")
    serializer_class = CourseSerializer

    def perform_create(self, serializer):
        client = serializer.validated_data.get("client")
        livreur = serializer.validated_data.get("livreur")

        Course.objects.filter(
            client=client,
            livreur=livreur,
            active=True
        ).update(active=False, finished_at=timezone.now())

        serializer.save(active=True)

    @action(detail=False, methods=["get"])
    def active(self, request):
        livreur_id = request.query_params.get("livreur_id")

        if not livreur_id:
            return Response({"error": "livreur_id obligatoire"}, status=400)

        course = Course.objects.filter(
            livreur_id=livreur_id,
            active=True
        ).order_by("-created_at").first()

        if not course:
            return Response({"active": False})

        serializer = self.get_serializer(course)

        return Response({
            "active": True,
            "course": serializer.data
        })

    @action(detail=True, methods=["patch"])
    def finish(self, request, pk=None):
        course = self.get_object()
        course.active = False
        course.finished_at = timezone.now()
        course.save()

        return Response({
            "message": "Course terminée",
            "active": False
        })
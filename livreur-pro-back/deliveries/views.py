from rest_framework.viewsets import ModelViewSet
from .models import Livreur, DemandeLivraison, CommentaireLivreur, Client, Course
from .serializers import (
    LivreurSerializer,
    DemandeLivraisonSerializer,
    CommentaireLivreurSerializer,
    ClientSerializer,
    CourseSerializer,
)
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.parsers import MultiPartParser, FormParser
from django.db.models import Avg
from rest_framework.permissions import AllowAny


class LivreurViewSet(ModelViewSet):
    serializer_class = LivreurSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        if self.action in ["list", "retrieve"]:
            return Livreur.objects.all().order_by("-disponible", "-note")

        return Livreur.objects.filter(user=self.request.user)

    @action(detail=True, methods=["patch"])
    def update_position(self, request, pk=None):
        livreur = self.get_object()

        if livreur.user != request.user:
            return Response({"error": "Accès interdit"}, status=403)

        latitude = request.data.get("latitude")
        longitude = request.data.get("longitude")

        if latitude is None or longitude is None:
            return Response(
                {"error": "latitude et longitude sont obligatoires"},
                status=status.HTTP_400_BAD_REQUEST,
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

    @action(detail=True, methods=["patch"])
    def set_unavailable(self, request, pk=None):
        livreur = self.get_object()

        if livreur.user != request.user:
            return Response({"error": "Accès interdit"}, status=403)

        livreur.disponible = False
        livreur.save()

        return Response({
            "message": "Livreur passé en occupé",
            "id": livreur.id,
            "disponible": livreur.disponible,
        })


class DemandeLivraisonViewSet(ModelViewSet):
    parser_classes = [MultiPartParser, FormParser]
    queryset = DemandeLivraison.objects.all().order_by("-created_at")
    serializer_class = DemandeLivraisonSerializer


@api_view(["POST"])
@permission_classes([AllowAny])
def register_livreur(request):
    nom = request.data.get("nom")
    telephone = request.data.get("telephone")
    ville = request.data.get("ville")
    vehicule = request.data.get("vehicule")
    password = request.data.get("password")

    if not nom or not telephone or not password:
        return Response(
            {"error": "Nom, téléphone et mot de passe sont obligatoires"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if User.objects.filter(username=telephone).exists():
        return Response(
            {"error": "Un compte avec ce téléphone existe déjà"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if Livreur.objects.filter(telephone=telephone).exists():
        return Response(
            {"error": "Ce téléphone est déjà utilisé par un livreur"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = User.objects.create_user(
        username=telephone,
        password=password,
    )

    try:
        livreur = Livreur.objects.create(
            user=user,
            nom=nom,
            telephone=telephone,
            ville=ville,
            vehicule=vehicule,
            disponible=True,
            photo=request.FILES.get("photo"),
        )

    except Exception as e:
        user.delete()

        return Response(
            {"error": f"Erreur upload photo Cloudinary: {str(e)}"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response({
        "message": "Livreur créé avec succès",
        "id": livreur.id,
        "nom": livreur.nom,
        "telephone": livreur.telephone,
    }, status=status.HTTP_201_CREATED)


class CommentaireLivreurViewSet(ModelViewSet):
    serializer_class = CommentaireLivreurSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve", "create"]:
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        livreur_id = self.request.query_params.get("livreur")
        queryset = CommentaireLivreur.objects.all().order_by("-created_at")

        if livreur_id:
            queryset = queryset.filter(livreur_id=livreur_id)

        return queryset

    def perform_create(self, serializer):
        commentaire = serializer.save()

        livreur = commentaire.livreur
        moyenne = CommentaireLivreur.objects.filter(
            livreur=livreur
        ).aggregate(avg_note=Avg("note"))["avg_note"]

        livreur.note = round(moyenne or 5, 1)
        livreur.save()


class ClientViewSet(ModelViewSet):
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Client.objects.filter(user=self.request.user)


@api_view(["POST"])
def register_client(request):
    nom = request.data.get("nom")
    telephone = request.data.get("telephone")
    password = request.data.get("password")

    if not nom or not telephone or not password:
        return Response(
            {"error": "Nom, téléphone et mot de passe sont obligatoires"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if User.objects.filter(username=telephone).exists():
        return Response(
            {"error": "Un utilisateur avec ce téléphone existe déjà"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = User.objects.create_user(
        username=telephone,
        password=password,
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
    serializer_class = CourseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = Course.objects.all().order_by("-created_at")

        client = getattr(user, "client_profile", None)
        livreur = Livreur.objects.filter(user=user).first()

        if client:
            return queryset.filter(client=client)

        if livreur:
            return queryset.filter(livreur=livreur)

        return Course.objects.none()

    def perform_create(self, serializer):
        client = serializer.validated_data.get("client")
        livreur = serializer.validated_data.get("livreur")

        if client.user != self.request.user:
            raise PermissionError("Accès interdit")

        Course.objects.filter(
            client=client,
            livreur=livreur,
            active=True,
        ).update(active=False, finished_at=timezone.now())

        serializer.save(active=True)

    @action(detail=False, methods=["get"])
    def active(self, request):
        livreur_id = request.query_params.get("livreur_id")

        if not livreur_id:
            return Response({"error": "livreur_id obligatoire"}, status=400)

        livreur = Livreur.objects.filter(id=livreur_id).first()

        if not livreur:
            return Response({"error": "Livreur introuvable"}, status=404)

        if livreur.user != request.user:
            return Response({"error": "Accès interdit"}, status=403)

        course = Course.objects.filter(
            livreur_id=livreur_id,
            active=True,
        ).order_by("-created_at").first()

        if not course:
            return Response({"active": False})

        serializer = self.get_serializer(course)

        return Response({
            "active": True,
            "course": serializer.data,
        })




    @action(detail=True, methods=["patch"])
    def update_client_position(self, request, pk=None):
        course = self.get_object()

        if course.client.user != request.user:
            return Response({"error": "Accès interdit"}, status=403)

        latitude = request.data.get("client_latitude")
        longitude = request.data.get("client_longitude")

        if latitude is None or longitude is None:
            return Response(
                {"error": "client_latitude et client_longitude sont obligatoires"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        course.client_latitude = latitude
        course.client_longitude = longitude
        course.save()

        return Response({
            "message": "Position client mise à jour",
            "id": course.id,
            "client_latitude": course.client_latitude,
            "client_longitude": course.client_longitude,
        })
    @action(detail=True, methods=["patch"])
    def finish(self, request, pk=None):
        course = self.get_object()

        course.active = False
        course.finished_at = timezone.now()
        course.save()

        livreur = course.livreur
        livreur.nombre_livraisons = (livreur.nombre_livraisons or 0) + 1
        livreur.save()

        return Response({
            "message": "Course terminée",
            "active": False,
            "nombre_livraisons": livreur.nombre_livraisons,
        })
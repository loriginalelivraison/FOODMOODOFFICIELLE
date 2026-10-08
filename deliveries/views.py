from rest_framework.viewsets import ModelViewSet
from rest_framework.decorators import action, api_view, permission_classes, parser_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.exceptions import PermissionDenied, ValidationError, MethodNotAllowed
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from PIL import Image, UnidentifiedImageError
import warnings

from django.contrib.auth.models import User
from django.conf import settings
from django.utils import timezone
from django.db import transaction
from django.db.models import Avg, Q
from decimal import Decimal, InvalidOperation

from .models import Livreur, DemandeLivraison, CommentaireLivreur, Client, Course, CourseOffer, DriverDocument
from .serializers import (
    LivreurSerializer,
    DemandeLivraisonSerializer,
    CommentaireLivreurSerializer,
    ClientSerializer,
    CourseSerializer,
)
from .firebase import send_livreur_notification, send_client_notification, save_fcm_token
from .course_services import (
    adjusted_price,
    broadcast_course_offers,
    current_surcharge_percent,
    dispatch_expired_courses,
    distance_km,
    eta_minutes,
    expire_stale_offers,
    offer_deadline,
    record_course_event,
    resolve_destination,
    resolve_destination_label,
    resolve_legs,
    resolve_route,
    suggested_price,
)


class LivreurViewSet(ModelViewSet):
    serializer_class = LivreurSerializer

    @action(detail=False, methods=["get"])
    def me(self, request):
        driver = get_object_or_404(Livreur, user=request.user)
        return Response(self.get_serializer(driver).data)

    @action(detail=True, methods=["get", "post"], parser_classes=[MultiPartParser, FormParser])
    def documents(self, request, pk=None):
        driver = self.get_object()
        if request.method == "POST":
            kind = request.data.get("kind")
            upload = request.FILES.get("file")
            if kind not in {"license", "vehicle"} or not upload:
                raise ValidationError({"detail": "اختر نوع الوثيقة وأرفق صورة واضحة."})
            if upload.size > 5 * 1024 * 1024:
                raise ValidationError({"detail": "الحد الأقصى للصورة 5 ميغابايت."})
            try:
                with warnings.catch_warnings():
                    warnings.simplefilter("error", Image.DecompressionBombWarning)
                    image = Image.open(upload)
                    if image.format not in {"JPEG", "PNG"}:
                        raise ValueError()
                    image.verify()
                upload.seek(0)
            except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
                raise ValidationError({"detail": "أرفق صورة JPEG أو PNG صالحة."})
            upload.name = "document.jpg" if image.format == "JPEG" else "document.png"
            with transaction.atomic():
                Livreur.objects.select_for_update().get(pk=driver.pk)
                document, _ = DriverDocument.objects.get_or_create(
                    livreur=driver, kind=kind, defaults={"file": ""}
                )
                previous_file = document.file.name
                document.file = upload
                document.status = "pending"
                document.save()
                if previous_file:
                    transaction.on_commit(lambda: document.file.storage.delete(previous_file), robust=True)
        documents = {doc.kind: doc for doc in driver.documents.all()}
        return Response([{
            "kind": kind, "status": documents[kind].status if kind in documents else "missing",
            "uploaded_at": documents[kind].uploaded_at if kind in documents else None,
        } for kind in ("license", "vehicle")])

    @action(detail=True, methods=["get"], url_path="documents/(?P<kind>license|vehicle)/download")
    def download_document(self, request, pk=None, kind=None):
        driver = self.get_object()
        document = get_object_or_404(DriverDocument, livreur=driver, kind=kind)
        response = FileResponse(document.file.open("rb"), as_attachment=True,
                                filename=f"{kind}{'.png' if document.file.name.endswith('.png') else '.jpg'}")
        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        return response

    def perform_destroy(self, instance):
        user = instance.user

        with transaction.atomic():
            instance.delete()
            if user:
                user.delete()

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        if self.action == "download_document" and self.request.user.has_perm("deliveries.view_driverdocument"):
            return Livreur.objects.all()
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

        has_active_course = Course.objects.filter(
            livreur=livreur,
            active=True,
        ).exists()

        livreur.latitude = latitude
        livreur.longitude = longitude
        livreur.disponible = not has_active_course
        livreur.save(update_fields=["latitude", "longitude", "disponible"])

        return Response({
            "message": "Position mise à jour",
            "id": livreur.id,
            "latitude": livreur.latitude,
            "longitude": livreur.longitude,
            "disponible": livreur.disponible,
        })

    @action(detail=True, methods=["patch"], url_path="set_offline")
    def set_offline(self, request, pk=None):
        livreur = self.get_object()

        if livreur.user != request.user:
            return Response({"error": "Accès interdit"}, status=403)

        livreur.est_en_ligne = False
        livreur.disponible = False
        livreur.save(update_fields=["est_en_ligne", "disponible"])

        # Un livreur qui se déconnecte ne peut plus répondre à une offre.
        withdrawn = CourseOffer.objects.filter(
            livreur=livreur,
            response="pending",
            course__status__in=["searching", "driver_accepted"],
            course__livreur__isnull=True,
        ).update(response="withdrawn", responded_at=timezone.now())

        return Response({
            "message": "Livreur passé hors ligne",
            "id": livreur.id,
            "est_en_ligne": livreur.est_en_ligne,
            "disponible": livreur.disponible,
            "withdrawn_offers": withdrawn,
        })

    @action(detail=True, methods=["patch"], url_path="set_online")
    def set_online(self, request, pk=None):
        livreur = self.get_object()

        if livreur.user != request.user:
            return Response({"error": "Accès interdit"}, status=403)

        if Course.objects.filter(livreur=livreur, active=True).exists():
            return Response(
                {"detail": "Terminez la course en cours avant de vous remettre en ligne."},
                status=status.HTTP_409_CONFLICT,
            )

        livreur.est_en_ligne = True
        livreur.disponible = True
        livreur.save(update_fields=["est_en_ligne", "disponible"])

        return Response({
            "message": "Livreur en ligne",
            "id": livreur.id,
            "est_en_ligne": livreur.est_en_ligne,
            "disponible": livreur.disponible,
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

    @action(detail=True, methods=["patch"], url_path="update_fcm_token")
    def update_fcm_token(self, request, pk=None):
        livreur = self.get_object()

        if livreur.user != request.user:
            return Response({"error": "Accès interdit"}, status=403)

        token = request.data.get("fcm_token")

        if not token:
            return Response(
                {"error": "fcm_token obligatoire"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        save_fcm_token(livreur, token)

        return Response({
            "success": True,
            "message": "FCM token enregistré",
        })

    @action(detail=True, methods=["delete"], url_path="clear_fcm_token")
    def clear_fcm_token(self, request, pk=None):
        livreur = self.get_object()

        if livreur.user != request.user:
            return Response({"error": "Accès interdit"}, status=403)

        livreur.fcm_token = None
        livreur.save(update_fields=["fcm_token"])
        return Response({"success": True})


class DemandeLivraisonViewSet(ModelViewSet):
    parser_classes = [MultiPartParser, FormParser]
    queryset = DemandeLivraison.objects.all().order_by("-created_at")
    serializer_class = DemandeLivraisonSerializer

    def get_permissions(self):
        if self.action == "create":
            return [IsAuthenticated()]
        return super().get_permissions()

    def create(self, request, *args, **kwargs):
        if not Client.objects.filter(user=request.user).exists():
            raise PermissionDenied("يلزم حساب عميل لطلب توصيل.")
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        if not Client.objects.filter(user=self.request.user).exists():
            raise PermissionDenied("يلزم حساب عميل لطلب توصيل.")
        serializer.save()


@api_view(["POST"])
@permission_classes([AllowAny])
@parser_classes([MultiPartParser, FormParser])
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

        livreur.note = round(moyenne, 1) if moyenne is not None else None
        livreur.save(update_fields=["note"])


class ClientViewSet(ModelViewSet):
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=["patch", "delete"])
    def update_fcm_token(self, request, pk=None):
        client = self.get_object()
        token = request.data.get("fcm_token") if request.method == "PATCH" else None
        if request.method == "PATCH" and not token:
            raise ValidationError({"detail": "fcm_token obligatoire"})
        save_fcm_token(client, token)
        return Response({"success": True})

    def get_queryset(self):
        return Client.objects.filter(user=self.request.user)


@api_view(["POST"])
@permission_classes([AllowAny])
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
    def update(self, request, *args, **kwargs):
        raise MethodNotAllowed(request.method)

    def destroy(self, request, *args, **kwargs):
        raise MethodNotAllowed(request.method)

    def create(self, request, *args, **kwargs):
        if not Client.objects.filter(user=request.user).exists():
            raise PermissionDenied("يلزم حساب عميل لطلب رحلة. سجّل الدخول بحساب عميل.")
        # Keep the existing direct-driver booking contract.
        with transaction.atomic():
            return super().create(request, *args, **kwargs)

    def get_queryset(self):
        user = self.request.user
        queryset = Course.objects.all().order_by("-created_at")

        client = getattr(user, "client_profile", None)
        livreur = Livreur.objects.filter(user=user).first()

        if client:
            return queryset.filter(client=client)

        if livreur:
            return queryset.filter(
                Q(livreur=livreur)
                | Q(offers__livreur=livreur, offers__response__in=["pending", "accepted"])
            ).distinct()

        return Course.objects.none()

    def perform_create(self, serializer):
        client = serializer.validated_data.get("client")
        livreur = serializer.validated_data.get("livreur")

        if not client or client.user != self.request.user:
            raise PermissionDenied("يلزم حساب عميل لطلب رحلة.")
        if not livreur:
            raise ValidationError("اختر سائقاً متاحاً.")
        livreur = Livreur.objects.select_for_update().get(pk=livreur.pk)

        existing_course = Course.objects.filter(
            livreur=livreur,
            active=True,
        ).exists()

        if existing_course or not livreur.disponible or not livreur.est_en_ligne:
            raise ValidationError("هذا السائق غير متاح حالياً.")

        course = serializer.save(active=True, client_confirmed=True, status="driver_selected",
                                 availability_before_course=livreur.disponible,
                                 vehicle_type=livreur.vehicule if livreur.vehicule in {"voiture", "moto", "camion"} else "moto")

        livreur.disponible = False
        livreur.save(update_fields=["disponible"])

        transaction.on_commit(lambda: send_livreur_notification(
            livreur,
            "طلب جديد",
            "أكد العميل الطلب. افتح WinRak للاطلاع على التفاصيل.",
            course_id=course.id,
        ))

    @staticmethod
    def _read_optional_float(request, key):
        try:
            return float(request.data[key])
        except (KeyError, TypeError, ValueError):
            return None

    def _parse_delivery_legs(self, request):
        """Valide et normalise une demande de livraison : commerçant puis client.

        Le retrait (`pickup_*`) est facultatif pour rester compatible avec les
        appels existants : sans commerçant, la commande part de la position du
        client. La destination de livraison reste obligatoire.
        """
        destination = str(request.data.get("destination", "")).strip()
        destination_lat = self._read_optional_float(request, "destination_latitude")
        destination_lon = self._read_optional_float(request, "destination_longitude")
        if not destination and destination_lat is None:
            return Response(
                {"detail": "La destination ou ses coordonnées sont obligatoires."}, status=400
            )

        try:
            start_lat = float(request.data["client_latitude"])
            start_lon = float(request.data["client_longitude"])
            proposed_price = Decimal(str(request.data["proposed_price"]))
            if not proposed_price.is_finite():
                raise InvalidOperation
        except (KeyError, TypeError, ValueError, InvalidOperation):
            return Response(
                {"detail": "Position GPS et prix valide obligatoires."}, status=400
            )

        minimum = Decimal(settings.COURSE_MIN_PRICE_DZD)
        if proposed_price < minimum:
            return Response({"detail": f"Le prix minimum est de {minimum} DZD."}, status=400)
        if not (-90 <= start_lat <= 90 and -180 <= start_lon <= 180):
            return Response({"detail": "Coordonnées GPS invalides."}, status=400)
        if destination_lat is not None and not (
            -90 <= destination_lat <= 90 and -180 <= destination_lon <= 180
        ):
            return Response({"detail": "Coordonnées de destination invalides."}, status=400)

        vehicle_type = str(request.data.get("vehicle_type", "voiture")).strip().lower()
        if vehicle_type not in {"moto", "voiture", "camion"}:
            return Response({"detail": "نوع المركبة غير صالح."}, status=400)

        pickup_name = str(request.data.get("pickup_name", "")).strip()[:120]
        pickup_address = str(request.data.get("pickup_address", "")).strip()[:255]
        pickup_phone = str(request.data.get("pickup_phone", "")).strip()[:30]
        pickup_lat = self._read_optional_float(request, "pickup_latitude")
        pickup_lon = self._read_optional_float(request, "pickup_longitude")
        # Point de départ saisi en texte (ou « Ma position » pré-rempli) :
        # on le géocode quand aucun point carte n'est transmis, pour obtenir
        # un vrai trajet simple départ → arrivée (tous véhicules).
        if pickup_lat is None and pickup_lon is None:
            pickup_text = pickup_address or pickup_name
            if pickup_text and pickup_text != "موقعي الحالي":
                pickup_position = resolve_destination(pickup_text)
                if not pickup_position:
                    return Response(
                        {"detail": "Point de départ introuvable. Vérifiez l’adresse puis réessayez."},
                        status=422,
                    )
                pickup_lat, pickup_lon = pickup_position
            else:
                pickup_text = ""
        if (pickup_lat is None) != (pickup_lon is None):
            return Response(
                {"detail": "Les coordonnées du commerçant sont incomplètes."}, status=400
            )
        if pickup_lat is not None and not (-90 <= pickup_lat <= 90 and -180 <= pickup_lon <= 180):
            return Response(
                {"detail": "Coordonnées du commerçant invalides."}, status=400
            )

        if destination_lat is None:
            destination_position = resolve_destination(destination)
            if not destination_position:
                return Response(
                    {"detail": "Destination introuvable. Vérifiez l’adresse puis réessayez."},
                    status=422,
                )
            destination_lat, destination_lon = destination_position
        elif not destination:
            destination = (
                resolve_destination_label(destination_lat, destination_lon)
                or "موقع محدد على الخريطة"
            )[:255]

        if pickup_lat is not None and not pickup_address:
            pickup_address = (
                resolve_destination_label(pickup_lat, pickup_lon) or pickup_name
            )[:255]

        return {
            "client_latitude": start_lat,
            "client_longitude": start_lon,
            "destination": destination,
            "destination_latitude": destination_lat,
            "destination_longitude": destination_lon,
            "pickup_name": pickup_name,
            "pickup_address": pickup_address,
            "pickup_phone": pickup_phone,
            "pickup_latitude": pickup_lat,
            "pickup_longitude": pickup_lon,
            "vehicle_type": vehicle_type,
            "proposed_price": proposed_price,
        }

    @action(detail=False, methods=["post"], url_path="request")
    def request_course(self, request):
        client = Client.objects.filter(user=request.user).first()
        if not client:
            return Response({"detail": "يلزم حساب عميل لطلب رحلة. سجّل الدخول بحساب عميل."}, status=403)

        legs = self._parse_delivery_legs(request)
        if isinstance(legs, Response):
            return legs

        start_lat = legs["client_latitude"]
        start_lon = legs["client_longitude"]
        destination = legs["destination"]
        destination_lat = legs["destination_latitude"]
        destination_lon = legs["destination_longitude"]
        pickup_name = legs["pickup_name"]
        pickup_address = legs["pickup_address"]
        pickup_phone = legs["pickup_phone"]
        pickup_lat = legs["pickup_latitude"]
        pickup_lon = legs["pickup_longitude"]

        request_key = str(request.data.get("request_key", "")).strip()[:64] or None
        if request_key:
            existing = Course.objects.filter(client=client, request_key=request_key).first()
            if existing:
                return Response(self.get_serializer(existing).data, status=200)

        routing = resolve_legs(
            start_lat,
            start_lon,
            pickup_lat,
            pickup_lon,
            destination_lat,
            destination_lon,
            router=resolve_route,
        )
        trip_distance = routing["trip_distance_km"]
        surcharge_percent = current_surcharge_percent()
        final_price = adjusted_price(legs["proposed_price"], surcharge_percent)

        try:
            with transaction.atomic():
                course = Course.objects.create(
                    client=client,
                    client_latitude=start_lat,
                    client_longitude=start_lon,
                    destination=destination,
                    destination_latitude=destination_lat,
                    destination_longitude=destination_lon,
                    pickup_name=pickup_name,
                    pickup_address=pickup_address,
                    pickup_phone=pickup_phone,
                    pickup_latitude=pickup_lat,
                    pickup_longitude=pickup_lon,
                    pickup_distance_km=routing["pickup_distance_km"],
                    pickup_route_geometry=routing["pickup_route_geometry"],
                    trip_distance_km=trip_distance,
                    trip_route_geometry=routing["trip_route_geometry"],
                    pickup_eta_minutes=eta_minutes(
                        routing["pickup_distance_km"],
                        settings.COURSE_ETA_PICKUP_BUFFER_MINUTES,
                    ),
                    dropoff_eta_minutes=eta_minutes(trip_distance),
                    vehicle_type=legs["vehicle_type"],
                    estimated_distance_km=trip_distance,
                    route_geometry=routing["trip_route_geometry"],
                    proposed_price=legs["proposed_price"],
                    surcharge_percent=surcharge_percent,
                    final_price=final_price,
                    status="searching",
                    active=True,
                    request_key=request_key,
                )
                record_course_event(course, "created", "client", client.id, new_status=course.status)

                # Première vague d'offres : on notifie les livreurs éligibles
                # (en ligne, bon véhicule, proches du commerçant).
                broadcast_course_offers(course, notifier=send_livreur_notification)
        except Exception as exc:
            if request_key:
                existing = Course.objects.filter(client=client, request_key=request_key).first()
                if existing:
                    return Response(self.get_serializer(existing).data, status=200)
            raise exc

        return Response(self.get_serializer(course).data, status=201)

    @action(detail=False, methods=["get"], permission_classes=[AllowAny])
    def address(self, request):
        """Adresse lisible des points GPS ou choisis sur la carte de réservation."""
        try:
            latitude = float(request.query_params["latitude"])
            longitude = float(request.query_params["longitude"])
        except (KeyError, TypeError, ValueError):
            return Response({"detail": "Coordonnées invalides."}, status=400)
        if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
            return Response({"detail": "Coordonnées invalides."}, status=400)
        address = resolve_destination_label(latitude, longitude, full_address=True)
        if not address:
            return Response({"detail": "Adresse indisponible."}, status=422)
        return Response({"address": address[:255]})

    @action(detail=False, methods=["post"], permission_classes=[AllowAny])
    def quote(self, request):
        destination = str(request.data.get("destination", "")).strip()
        try:
            start_lat = float(request.data["client_latitude"])
            start_lon = float(request.data["client_longitude"])
        except (KeyError, TypeError, ValueError):
            return Response({"detail": "Position GPS invalide."}, status=400)
        try:
            destination_lat = float(request.data["destination_latitude"])
            destination_lon = float(request.data["destination_longitude"])
        except (KeyError, TypeError, ValueError):
            destination_lat = destination_lon = None

        if not destination and destination_lat is None:
            return Response({"detail": "La destination ou ses coordonnées sont obligatoires."}, status=400)
        if not (-90 <= start_lat <= 90 and -180 <= start_lon <= 180):
            return Response({"detail": "Coordonnées GPS invalides."}, status=400)
        if destination_lat is not None and not (-90 <= destination_lat <= 90 and -180 <= destination_lon <= 180):
            return Response({"detail": "Coordonnées de destination invalides."}, status=400)
        if destination_lat is None:
            destination_position = resolve_destination(destination)
            if not destination_position:
                return Response({"detail": "Destination introuvable. Vérifiez l’adresse puis réessayez."}, status=422)
            destination_lat, destination_lon = destination_position
        elif not destination:
            destination = (resolve_destination_label(destination_lat, destination_lon) or "موقع محدد على الخريطة")[:255]

        pickup_lat = self._read_optional_float(request, "pickup_latitude")
        pickup_lon = self._read_optional_float(request, "pickup_longitude")
        # Même logique que la création : un départ texte est géocodé pour
        # chiffrer le trajet départ → arrivée (sinon on part du GPS).
        if pickup_lat is None and pickup_lon is None:
            pickup_text = (
                str(request.data.get("pickup_address", "")).strip()
                or str(request.data.get("pickup_name", "")).strip()
            )
            if pickup_text and pickup_text != "موقعي الحالي":
                pickup_position = resolve_destination(pickup_text)
                if not pickup_position:
                    return Response({"detail": "Point de départ introuvable. Vérifiez l’adresse puis réessayez."}, status=422)
                pickup_lat, pickup_lon = pickup_position

        routing = resolve_legs(
            start_lat,
            start_lon,
            pickup_lat,
            pickup_lon,
            destination_lat,
            destination_lon,
            router=resolve_route,
        )
        estimated_distance = routing["trip_distance_km"]
        price = suggested_price(estimated_distance)
        surcharge_percent = current_surcharge_percent()
        return Response({
            "destination": destination,
            "destination_latitude": destination_lat,
            "destination_longitude": destination_lon,
            "pickup_latitude": pickup_lat,
            "pickup_longitude": pickup_lon,
            "pickup_distance_km": routing["pickup_distance_km"],
            "pickup_route_geometry": routing["pickup_route_geometry"],
            "trip_distance_km": routing["trip_distance_km"],
            "trip_route_geometry": routing["trip_route_geometry"],
            "pickup_eta_minutes": eta_minutes(
                routing["pickup_distance_km"], settings.COURSE_ETA_PICKUP_BUFFER_MINUTES
            ),
            "dropoff_eta_minutes": eta_minutes(routing["trip_distance_km"]),
            "estimated_distance_km": estimated_distance,
            "route_geometry": routing["trip_route_geometry"],
            "proposed_price": price,
            "surcharge_percent": surcharge_percent,
            "final_price": adjusted_price(price, surcharge_percent),
        })

    @action(detail=False, methods=["get"])
    def offers(self, request):
        driver = Livreur.objects.filter(user=request.user, user__is_active=True).first()
        if not driver:
            return Response({"detail": "Compte chauffeur invalide."}, status=403)

        expire_stale_offers()
        # Une commande dont personne n'a voulu la vague précédente repart
        # immédiatement chez d'autres livreurs plus proches.
        dispatch_expired_courses()

        offers = CourseOffer.objects.filter(
            livreur=driver,
            response__in=["pending", "accepted"],
            course__status__in=["searching", "driver_accepted"],
            course__livreur__isnull=True,
        ).select_related("course", "course__client").order_by("-course__created_at")
        return Response(self.get_serializer([offer.course for offer in offers], many=True).data)

    @action(detail=True, methods=["post"])
    def respond(self, request, pk=None):
        response_value = request.data.get("response")
        if response_value not in ["accepted", "rejected"]:
            return Response({"detail": "Réponse invalide."}, status=400)

        driver = Livreur.objects.filter(user=request.user, user__is_active=True).first()
        if not driver:
            return Response({"detail": "Compte chauffeur invalide."}, status=403)

        with transaction.atomic():
            course = Course.objects.select_for_update().filter(pk=pk).first()
            if not course:
                return Response({"detail": "Course introuvable."}, status=404)
            offer = CourseOffer.objects.select_for_update().filter(course=course, livreur=driver).first()
            if not offer:
                return Response({"detail": "Cette course ne vous a pas été proposée."}, status=404)
            if course.status in ["cancelled", "completed"] or course.livreur_id:
                return Response({"detail": "Cette course n’est plus disponible."}, status=409)
            if offer.response == response_value:
                return Response({"status": course.status, "response": offer.response})
            if offer.response != "pending":
                return Response({"detail": "Cette offre a déjà été traitée."}, status=409)
            if offer.expires_at and offer.expires_at <= timezone.now():
                offer.response = "withdrawn"
                offer.responded_at = timezone.now()
                offer.save(update_fields=["response", "responded_at"])
                return Response({"detail": "Cette offre a expiré."}, status=409)
            if response_value == "accepted" and not driver.est_en_ligne:
                return Response({"detail": "Remettez-vous en ligne pour accepter une course."}, status=409)
            if response_value == "accepted" and Course.objects.filter(livreur=driver, active=True).exclude(pk=course.pk).exists():
                return Response({"detail": "Vous avez déjà une course en cours."}, status=409)

            previous_status = course.status
            offer.response = response_value
            offer.responded_at = timezone.now()
            offer.save(update_fields=["response", "responded_at"])
            if response_value == "accepted":
                course.status = "driver_accepted"
                course.save(update_fields=["status"])
            else:
                if not course.offers.filter(response="accepted").exists():
                    course.status = "searching"
                    course.save(update_fields=["status"])
                # Un refus ne doit pas laisser la commande en attente : on passe
                # à la vague suivante dès qu'aucun livreur n'a d'offre en cours.
                if not course.offers.filter(response="pending").exists():
                    previous_round = course.broadcast_round
                    course.broadcast_round = previous_round + 1
                    course.status = "searching"
                    course.save(update_fields=["broadcast_round", "status"])
                    record_course_event(
                        course,
                        "offers_rebroadcast",
                        details={
                            "previous_round": previous_round,
                            "round": course.broadcast_round,
                            "trigger": "offer_rejected",
                        },
                    )
                    transaction.on_commit(
                        lambda: broadcast_course_offers(
                            course, notifier=send_livreur_notification
                        )
                    )
            record_course_event(
                course,
                response_value,
                "livreur",
                driver.id,
                previous_status=previous_status,
                new_status=course.status,
            )
        return Response({"status": course.status, "response": offer.response})

    @action(detail=True, methods=["post"])
    def select_driver(self, request, pk=None):
        client = Client.objects.filter(user=request.user).first()
        if not client:
            return Response({"detail": "Accès réservé au client."}, status=403)
        try:
            driver_id = int(request.data["livreur_id"])
        except (KeyError, TypeError, ValueError):
            return Response({"detail": "Chauffeur invalide."}, status=400)

        with transaction.atomic():
            course = Course.objects.select_for_update().filter(pk=pk, client=client).first()
            if not course:
                return Response({"detail": "Course introuvable."}, status=404)
            if course.status not in ["searching", "driver_accepted"] or course.livreur_id:
                return Response({"detail": "La course n’est plus disponible pour une sélection."}, status=409)
            offer = CourseOffer.objects.select_for_update().filter(
                course=course, livreur_id=driver_id, response="accepted"
            ).select_related("livreur").first()
            if not offer:
                return Response({"detail": "Ce chauffeur n’a pas accepté la course."}, status=409)
            offer.livreur = Livreur.objects.select_for_update().get(pk=offer.livreur_id)
            if not offer.livreur.est_en_ligne or Course.objects.filter(
                livreur=offer.livreur, active=True
            ).exists():
                return Response({"detail": "هذا السائق غير متاح حالياً. اختر سائقاً آخر."}, status=409)

            previous_status = course.status
            course.livreur = offer.livreur
            course.client_confirmed = True
            course.status = "driver_selected"
            course.availability_before_course = offer.livreur.disponible
            course.save(update_fields=["livreur", "client_confirmed", "status", "availability_before_course"])
            offer.livreur.disponible = False
            offer.livreur.save(update_fields=["disponible"])
            CourseOffer.objects.filter(course=course).exclude(pk=offer.pk).update(
                response="withdrawn", responded_at=timezone.now()
            )
            record_course_event(
                course, "driver_selected", "client", client.id,
                previous_status=previous_status,
                new_status=course.status,
                details={"livreur_id": offer.livreur_id},
            )
            transaction.on_commit(lambda: send_livreur_notification(
                offer.livreur,
                "تم اختيارك للرحلة",
                f"اختارك الزبون للرحلة رقم {course.id}. افتح WinRak للتوجه إلى موقع الانطلاق.",
                course_id=course.id,
                notification_type="course_selected",
            ))

        return Response(self.get_serializer(course).data)

    @action(detail=True, methods=["post"])
    def enroute(self, request, pk=None):
        return self._transition(request, pk, "driver_arriving", ["driver_selected"], None)

    @action(detail=True, methods=["post"])
    def arrive(self, request, pk=None):
        return self._transition(request, pk, "driver_arrived", ["driver_selected", "driver_arriving"], "arrived_at")

    @action(detail=True, methods=["post"])
    def pickup(self, request, pk=None):
        """Le livreur a récupéré la commande chez le commerçant."""
        return self._transition(request, pk, "picked_up", ["driver_arrived"], "picked_up_at")

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        return self._transition(request, pk, "in_progress", ["driver_arrived", "picked_up"], "started_at")

    def _transition(self, request, pk, new_status, allowed_statuses, timestamp_field):
        driver = Livreur.objects.filter(user=request.user, user__is_active=True).first()
        if not driver:
            return Response({"detail": "Compte chauffeur invalide."}, status=403)
        with transaction.atomic():
            course = Course.objects.select_for_update().filter(pk=pk, livreur=driver).first()
            if not course:
                return Response({"detail": "Course introuvable."}, status=404)
            if new_status == "picked_up" and not course.is_delivery:
                return Response({"detail": "La récupération de commande est réservée aux livraisons."}, status=409)
            if new_status == "in_progress" and course.is_delivery:
                allowed_statuses = ["picked_up"]
            if course.status == new_status:
                return Response(self.get_serializer(course).data)
            if course.status not in allowed_statuses:
                return Response({"detail": "Cette transition n’est pas autorisée."}, status=409)
            previous_status = course.status
            course.status = new_status
            update_fields = ["status"]
            if timestamp_field:
                setattr(course, timestamp_field, timezone.now())
                update_fields.append(timestamp_field)
            course.save(update_fields=update_fields)
            record_course_event(course, new_status, "livreur", driver.id, previous_status, new_status)
        return Response(self.get_serializer(course).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        reason = str(request.data.get("reason", "")).strip()
        comment = str(request.data.get("comment", "")).strip()
        client = Client.objects.filter(user=request.user).first()
        driver = Livreur.objects.filter(user=request.user).first()
        client_reasons = {"changed_mind", "driver_delay", "request_error", "other"}
        driver_reasons = {"cannot_complete", "vehicle_issue", "route_unsuitable", "other"}
        if (client and reason not in client_reasons) or (driver and reason not in driver_reasons) or not (client or driver):
            return Response({"detail": "Motif d’annulation invalide."}, status=400)
        if reason == "other" and not comment:
            return Response({"detail": "Précisez le motif dans le commentaire."}, status=400)
        with transaction.atomic():
            course = Course.objects.select_for_update().filter(pk=pk).first()
            if not course or (not client or course.client_id != client.id) and (not driver or course.livreur_id != driver.id):
                return Response({"detail": "Course introuvable."}, status=404)
            actor_type = "client" if client and course.client_id == client.id else "livreur"
            actor_id = client.id if actor_type == "client" else driver.id
            if course.status == "cancelled":
                return Response(self.get_serializer(course).data)
            if course.status == "completed" or not course.active:
                return Response({"detail": "Cette course ne peut plus être annulée."}, status=409)
            if actor_type == "livreur" and course.status not in ["driver_selected", "driver_arriving", "driver_arrived", "picked_up", "in_progress"]:
                return Response({"detail": "Vous ne pouvez pas annuler cette demande."}, status=403)

            previous_status = course.status
            course.previous_status = previous_status
            course.status = "cancelled"
            course.active = False
            course.cancelled_at = timezone.now()
            course.cancelled_by_type = actor_type
            course.cancellation_reason = reason
            course.cancellation_comment = comment
            course.save(update_fields=[
                "previous_status", "status", "active", "cancelled_at",
                "cancelled_by_type", "cancellation_reason", "cancellation_comment",
            ])
            active_offers = list(CourseOffer.objects.filter(
                course=course, response__in=["pending", "accepted"]
            ).select_related("livreur"))
            CourseOffer.objects.filter(course=course, response__in=["pending", "accepted"]).update(
                response="withdrawn", responded_at=timezone.now()
            )
            record_course_event(
                course, "cancelled", actor_type, actor_id, previous_status, "cancelled",
                {"reason": reason, "comment": comment},
            )
            recipients = {offer.livreur_id: offer.livreur for offer in active_offers}
            if actor_type == "client" and course.livreur_id:
                recipients[course.livreur_id] = course.livreur
            recipients.pop(driver.id if actor_type == "livreur" else None, None)
            for recipient in recipients.values():
                transaction.on_commit(lambda recipient=recipient: send_livreur_notification(
                    recipient,
                    "تم إلغاء الطلب" if course.is_delivery else "تم إلغاء الرحلة",
                    "ألغى العميل الطلب. يمكنك استقبال طلبات جديدة." if actor_type == "client" else "تم إلغاء الطلب. يمكنك استقبال طلبات جديدة.",
                    course_id=course.id,
                    notification_type="course_cancelled",
                    extra_data={"open_home": str(recipient.id != course.livreur_id).lower()},
                ))
            if actor_type == "livreur":
                transaction.on_commit(lambda: send_client_notification(
                    course.client, "تم إلغاء الرحلة",
                    "نعتذر، ألغى السائق الرحلة. يمكنك طلب سائق آخر.",
                    course_id=course.id, notification_type="course_cancelled",
                ))
            if course.livreur_id:
                has_other_active_course = Course.objects.filter(
                    livreur=course.livreur, active=True
                ).exclude(pk=course.pk).exists()
                course.livreur.disponible = False if has_other_active_course else (
                    course.availability_before_course if course.availability_before_course is not None else True
                )
                course.livreur.est_en_ligne = course.livreur.disponible
                course.livreur.save(update_fields=["disponible", "est_en_ligne"])
        return Response(self.get_serializer(course).data)

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
        # GPS writes must never overwrite a cancellation committed concurrently.
        course.save(update_fields=["client_latitude", "client_longitude"])

        return Response({
            "message": "Position client mise à jour",
            "id": course.id,
            "client_latitude": course.client_latitude,
            "client_longitude": course.client_longitude,
        })

    @action(detail=True, methods=["patch"])
    def finish(self, request, pk=None):
        with transaction.atomic():
            course = Course.objects.select_for_update().filter(pk=pk).first()
            if not course:
                return Response({"detail": "Course introuvable."}, status=404)
            livreur = course.livreur
            client = course.client
            is_livreur = bool(livreur and livreur.user_id == request.user.id)
            is_client = client.user_id == request.user.id

            if not is_livreur and not is_client:
                return Response({"error": "Accès interdit"}, status=403)
            if not course.active or course.status in ["completed", "cancelled"]:
                return Response(self.get_serializer(course).data)
            if course.destination and course.status != "in_progress":
                return Response({"detail": "Seule une course en cours peut être terminée."}, status=409)
            if course.livreur_id and course.status not in ["in_progress", "driver_selected", "driver_arrived", "driver_arriving", "picked_up"]:
                return Response({"detail": "La course ne peut pas être terminée dans cet état."}, status=409)

            previous_status = course.status
            course.active = False
            course.status = "completed"
            course.finished_at = timezone.now()
            if is_livreur:
                course.finished_by = livreur
            else:
                course.finished_by_client = client
            course.save(update_fields=[
                "active", "status", "finished_at", "finished_by", "finished_by_client",
            ])
            record_course_event(course, "completed", "livreur" if is_livreur else "client", livreur.id if is_livreur else client.id, previous_status, "completed")

            points_earned = settings.COURSE_COMPLETION_POINTS

            if livreur:
                if course.client_confirmed:
                    livreur.nombre_livraisons = (livreur.nombre_livraisons or 0) + 1
                livreur.points = (livreur.points or 0) + points_earned
                has_other_active_course = Course.objects.filter(livreur=livreur, active=True).exclude(pk=course.pk).exists()
                livreur.disponible = False if has_other_active_course else (
                    course.availability_before_course if course.availability_before_course is not None else True
                )
                livreur.est_en_ligne = livreur.disponible
                livreur.save(update_fields=["nombre_livraisons", "disponible", "est_en_ligne", "points"])

            client.points = (client.points or 0) + points_earned
            client.save(update_fields=["points"])

        return Response({
            **self.get_serializer(course).data,
            "message": "Course terminée",
            "active": False,
            "nombre_livraisons": livreur.nombre_livraisons if livreur else None,
            "disponible": livreur.disponible if livreur else None,
            "points_earned": points_earned,
            "client_points": client.points,
            "livreur_points": livreur.points if livreur else None,
        })

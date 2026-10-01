from rest_framework.viewsets import ModelViewSet
from rest_framework.decorators import action, api_view, permission_classes, parser_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser

from django.contrib.auth.models import User
from django.conf import settings
from django.utils import timezone
from django.db import transaction
from django.db.models import Avg, Q
from decimal import Decimal, InvalidOperation

from .models import Livreur, DemandeLivraison, CommentaireLivreur, Client, Course, CourseOffer
from .serializers import (
    LivreurSerializer,
    DemandeLivraisonSerializer,
    CommentaireLivreurSerializer,
    ClientSerializer,
    CourseSerializer,
)
from .firebase import send_livreur_notification
from .course_services import (
    adjusted_price,
    current_surcharge_percent,
    distance_km,
    record_course_event,
    resolve_destination,
    resolve_destination_label,
    resolve_route,
)


class LivreurViewSet(ModelViewSet):
    serializer_class = LivreurSerializer

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
        livreur.save()

        return Response({
            "message": "Position mise à jour",
            "id": livreur.id,
            "latitude": livreur.latitude,
            "longitude": livreur.longitude,
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

        livreur.fcm_token = token
        livreur.save(update_fields=["fcm_token"])

        return Response({
            "success": True,
            "message": "FCM token enregistré",
        })


class DemandeLivraisonViewSet(ModelViewSet):
    parser_classes = [MultiPartParser, FormParser]
    queryset = DemandeLivraison.objects.all().order_by("-created_at")
    serializer_class = DemandeLivraisonSerializer


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

        if client.user != self.request.user:
            raise PermissionError("Accès interdit")

        existing_course = Course.objects.filter(
            livreur=livreur,
            active=True,
        ).exists()

        if existing_course:
            raise PermissionError("Ce livreur est déjà en livraison")

        course = serializer.save(active=True, client_confirmed=True, status="driver_selected")

        livreur.disponible = False
        livreur.save(update_fields=["disponible"])

        send_livreur_notification(
            livreur,
            "Nouvelle demande de livraison",
            "Un client a confirmé la course. Ouvrez WinRak.",
            course_id=course.id,
        )

    @action(detail=False, methods=["post"], url_path="request")
    def request_course(self, request):
        client = Client.objects.filter(user=request.user).first()
        if not client:
            return Response({"detail": "Un compte client est requis."}, status=403)

        destination = str(request.data.get("destination", "")).strip()
        try:
            destination_lat = float(request.data["destination_latitude"])
            destination_lon = float(request.data["destination_longitude"])
        except (KeyError, TypeError, ValueError):
            destination_lat = destination_lon = None

        if not destination and destination_lat is None:
            return Response({"detail": "La destination ou ses coordonnées sont obligatoires."}, status=400)

        try:
            start_lat = float(request.data["client_latitude"])
            start_lon = float(request.data["client_longitude"])
            proposed_price = Decimal(str(request.data["proposed_price"]))
            if not proposed_price.is_finite():
                raise InvalidOperation
        except (KeyError, TypeError, ValueError, InvalidOperation):
            return Response({"detail": "Position GPS et prix valide obligatoires."}, status=400)

        minimum = Decimal(settings.COURSE_MIN_PRICE_DZD)
        if proposed_price < minimum:
            return Response({"detail": f"Le prix minimum est de {minimum} DZD."}, status=400)
        if not (-90 <= start_lat <= 90 and -180 <= start_lon <= 180):
            return Response({"detail": "Coordonnées GPS invalides."}, status=400)
        if destination_lat is not None and not (-90 <= destination_lat <= 90 and -180 <= destination_lon <= 180):
            return Response({"detail": "Coordonnées de destination invalides."}, status=400)

        request_key = str(request.data.get("request_key", "")).strip()[:64] or None
        if request_key:
            existing = Course.objects.filter(client=client, request_key=request_key).first()
            if existing:
                return Response(self.get_serializer(existing).data, status=200)

        if destination_lat is None:
            destination_position = resolve_destination(destination)
            if not destination_position:
                return Response({"detail": "Destination introuvable. Vérifiez l’adresse puis réessayez."}, status=422)
            destination_lat, destination_lon = destination_position
        elif not destination:
            destination = (resolve_destination_label(destination_lat, destination_lon) or "موقع محدد على الخريطة")[:255]
        estimated_distance, route_geometry = resolve_route(
            start_lat, start_lon, destination_lat, destination_lon
        )
        surcharge_percent = current_surcharge_percent()
        final_price = adjusted_price(proposed_price, surcharge_percent)

        try:
            with transaction.atomic():
                course = Course.objects.create(
                    client=client,
                    client_latitude=start_lat,
                    client_longitude=start_lon,
                    destination=destination,
                    destination_latitude=destination_lat,
                    destination_longitude=destination_lon,
                    estimated_distance_km=estimated_distance,
                    route_geometry=route_geometry,
                    proposed_price=proposed_price,
                    surcharge_percent=surcharge_percent,
                    final_price=final_price,
                    status="searching",
                    active=True,
                    request_key=request_key,
                )
                record_course_event(course, "created", "client", client.id, new_status=course.status)

                nearby_drivers = []
                for driver in Livreur.objects.select_related("user").filter(
                    user__is_active=True,
                    fcm_token__gt="",
                    latitude__isnull=False,
                    longitude__isnull=False,
                ):
                    driver_distance = distance_km(start_lat, start_lon, driver.latitude, driver.longitude)
                    if driver_distance <= settings.COURSE_SEARCH_RADIUS_KM:
                        nearby_drivers.append(driver)

                CourseOffer.objects.bulk_create([
                    CourseOffer(course=course, livreur=driver) for driver in nearby_drivers
                ])
                record_course_event(
                    course,
                    "drivers_notified",
                    details={"livreur_ids": [driver.id for driver in nearby_drivers]},
                )

                request_time = timezone.localtime(course.created_at).strftime("%H:%M")
                distance_label = f"{estimated_distance} كم" if estimated_distance is not None else "قيد التقدير"
                body = (
                    "طلب رحلة جديد\n"
                    f"📍 الانطلاق: {start_lat:.5f}, {start_lon:.5f}\n"
                    f"🎯 الوجهة: {destination}\n"
                    f"📏 المسافة التقريبية: {distance_label}\n"
                    f"💰 السعر المقترح: {final_price} دج\n"
                    f"🕒 وقت الطلب: {request_time}\n"
                    "افتح WinRak ثم اختر قبول أو رفض."
                )
                for driver in nearby_drivers:
                    transaction.on_commit(lambda driver=driver: send_livreur_notification(
                        driver,
                        "طلب رحلة جديد",
                        body,
                        course_id=course.id,
                        notification_type="course_offer",
                        extra_data={
                            "destination": destination,
                            "price": final_price,
                            "accept_label": "قبول",
                            "reject_label": "رفض",
                        },
                    ))
        except Exception as exc:
            if request_key:
                existing = Course.objects.filter(client=client, request_key=request_key).first()
                if existing:
                    return Response(self.get_serializer(existing).data, status=200)
            raise exc

        return Response(self.get_serializer(course).data, status=201)

    @action(detail=False, methods=["get"])
    def offers(self, request):
        driver = Livreur.objects.filter(user=request.user, user__is_active=True).first()
        if not driver:
            return Response({"detail": "Compte chauffeur invalide."}, status=403)

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
            if response_value == "accepted" and Course.objects.filter(livreur=driver, active=True).exclude(pk=course.pk).exists():
                return Response({"detail": "Vous avez déjà une course en cours."}, status=409)

            previous_status = course.status
            offer.response = response_value
            offer.responded_at = timezone.now()
            offer.save(update_fields=["response", "responded_at"])
            if response_value == "accepted":
                course.status = "driver_accepted"
                course.save(update_fields=["status"])
            elif not course.offers.filter(response="accepted").exists():
                course.status = "searching"
                course.save(update_fields=["status"])
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
    def start(self, request, pk=None):
        return self._transition(request, pk, "in_progress", ["driver_arrived"], "started_at")

    def _transition(self, request, pk, new_status, allowed_statuses, timestamp_field):
        driver = Livreur.objects.filter(user=request.user, user__is_active=True).first()
        if not driver:
            return Response({"detail": "Compte chauffeur invalide."}, status=403)
        with transaction.atomic():
            course = Course.objects.select_for_update().filter(pk=pk, livreur=driver).first()
            if not course:
                return Response({"detail": "Course introuvable."}, status=404)
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
            if course.status in ["completed", "cancelled"] or not course.active:
                return Response({"detail": "Cette course ne peut plus être annulée."}, status=409)
            if actor_type == "livreur" and course.status not in ["driver_selected", "driver_arriving", "driver_arrived", "in_progress"]:
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
            for affected_offer in active_offers:
                if actor_type == "client" or affected_offer.livreur_id != course.livreur_id:
                    transaction.on_commit(lambda affected_offer=affected_offer: send_livreur_notification(
                        affected_offer.livreur,
                        "تم إلغاء الرحلة",
                        f"تم إلغاء طلب الرحلة رقم {course.id}. لم يعد متاحاً.",
                        course_id=course.id,
                        notification_type="course_cancelled",
                    ))
            if course.livreur_id:
                has_other_active_course = Course.objects.filter(
                    livreur=course.livreur, active=True
                ).exclude(pk=course.pk).exists()
                course.livreur.disponible = False if has_other_active_course else (
                    course.availability_before_course if course.availability_before_course is not None else True
                )
                course.livreur.save(update_fields=["disponible"])
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
        course.save()

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
            if course.destination and (not is_livreur or course.status != "in_progress"):
                return Response({"detail": "Seul le chauffeur peut terminer une course en cours."}, status=409)
            if course.livreur_id and course.status not in ["in_progress", "driver_selected", "driver_arrived", "driver_arriving"]:
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

            if livreur:
                if course.client_confirmed:
                    livreur.nombre_livraisons = (livreur.nombre_livraisons or 0) + 1
                has_other_active_course = Course.objects.filter(livreur=livreur, active=True).exclude(pk=course.pk).exists()
                livreur.disponible = False if has_other_active_course else (
                    course.availability_before_course if course.availability_before_course is not None else True
                )
                livreur.save(update_fields=["nombre_livraisons", "disponible"])

        return Response({
            "message": "Course terminée",
            "active": False,
            "nombre_livraisons": livreur.nombre_livraisons,
            "disponible": livreur.disponible,
        })
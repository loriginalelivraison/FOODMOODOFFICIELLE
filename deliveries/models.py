from django.db import models
from django.contrib.auth.models import User
from .private_storage import PrivateDocumentStorage, document_path


class Livreur(models.Model):
    user = models.OneToOneField(
    User,
    on_delete=models.CASCADE,
    null=True,
    blank=True
)


    VEHICULE_CHOICES = [
        ("velo", "Vélo"),
        ("camion", "Camion"),
        ("moto", "Moto"),
        ("voiture", "Voiture"),
    ]

    nom = models.CharField(max_length=100)
    telephone = models.CharField(max_length=30)
    ville = models.CharField(max_length=100)
    vehicule = models.CharField(max_length=30, choices=VEHICULE_CHOICES)
    disponible = models.BooleanField(default=True)
    # Bascule "en ligne / hors ligne" façon Uber : un livreur hors ligne
    # ne reçoit plus aucune offre, même s'il a une position GPS connue.
    est_en_ligne = models.BooleanField(default=False)
    photo = models.ImageField(upload_to="livreurs/", blank=True, null=True)

    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)

    note = models.FloatField(null=True, blank=True, default=None)
    nombre_livraisons = models.PositiveIntegerField(default=0)
    points = models.PositiveIntegerField(default=0)

    fcm_token = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.nom


class DemandeLivraison(models.Model):
    STATUT_CHOICES = [
        ("en_attente", "En attente"),
        ("acceptee", "Acceptée"),
        ("en_cours", "En cours"),
        ("livree", "Livrée"),
        ("annulee", "Annulée"),
    ]

    client_nom = models.CharField(max_length=100)
    client_telephone = models.CharField(max_length=30)

    adresse_depart = models.CharField(max_length=255)
    adresse_arrivee = models.CharField(max_length=255)

    livreur = models.ForeignKey(
        Livreur,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="demandes"
    )

    statut = models.CharField(
        max_length=30,
        choices=STATUT_CHOICES,
        default="en_attente"
    )

    prix_estime = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    tracking_code = models.CharField(max_length=50, unique=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Demande {self.id} - {self.client_nom}"

#model de table des commentaires des clients sur livreure s
class CommentaireLivreur(models.Model):
    livreur = models.ForeignKey(
        Livreur,
        on_delete=models.CASCADE,
        related_name="commentaires"
    )
    nom_client = models.CharField(max_length=100, blank=True)
    message = models.TextField()
    note = models.IntegerField(default=5)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Commentaire pour {self.livreur.nom}"

#table client  
class Client(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="client_profile"
    )
    nom = models.CharField(max_length=100)
    telephone = models.CharField(max_length=20, unique=True)
    points = models.PositiveIntegerField(default=0)
    fcm_token = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.nom

class DriverDocument(models.Model):
    KIND_CHOICES = [("license", "Permis de conduire"), ("vehicle", "Véhicule et plaque")]
    STATUS_CHOICES = [("pending", "قيد المراجعة"), ("verified", "تم التحقق"), ("rejected", "مرفوض")]
    livreur = models.ForeignKey(Livreur, on_delete=models.CASCADE, related_name="documents")
    kind = models.CharField(max_length=12, choices=KIND_CHOICES)
    file = models.FileField(storage=PrivateDocumentStorage(), upload_to=document_path)
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default="pending")
    uploaded_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["livreur", "kind"], name="unique_driver_document_kind")]

#table de position client 
class Course(models.Model):
    STATUS_CHOICES = [
        ("searching", "Recherche de chauffeur"),
        ("driver_accepted", "Chauffeur intéressé"),
        ("driver_selected", "Chauffeur sélectionné"),
        ("driver_arriving", "Chauffeur en route"),
        ("driver_arrived", "Chauffeur arrivé"),
        ("picked_up", "Commande récupérée"),
        ("in_progress", "Course en cours"),
        ("completed", "Terminée"),
        ("cancelled", "Annulée"),
    ]

    client = models.ForeignKey(Client, on_delete=models.CASCADE)
    livreur = models.ForeignKey(
        Livreur,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="courses",
    )
    finished_by = models.ForeignKey(
        Livreur,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="courses_finies",
    )
    finished_by_client = models.ForeignKey(
        Client,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="courses_finies",
    )

    client_latitude = models.FloatField(null=True, blank=True)
    client_longitude = models.FloatField(null=True, blank=True)
    destination = models.CharField(max_length=255, blank=True)
    destination_latitude = models.FloatField(null=True, blank=True)
    destination_longitude = models.FloatField(null=True, blank=True)

    # --- Parcours "livreur Uber de commandes" : commerçant -> client ---
    # Le retrait se fait chez le commerçant (restaurant / boutique), la
    # livraison chez le client. `destination*` reste la destination de
    # livraison (dropoff) pour ne casser ni l'existant ni le suivi client.
    pickup_name = models.CharField(max_length=120, blank=True)
    pickup_address = models.CharField(max_length=255, blank=True)
    pickup_phone = models.CharField(max_length=30, blank=True)
    pickup_latitude = models.FloatField(null=True, blank=True)
    pickup_longitude = models.FloatField(null=True, blank=True)
    pickup_route_geometry = models.JSONField(null=True, blank=True)
    pickup_distance_km = models.FloatField(null=True, blank=True)
    trip_route_geometry = models.JSONField(null=True, blank=True)
    trip_distance_km = models.FloatField(null=True, blank=True)
    pickup_eta_minutes = models.PositiveIntegerField(null=True, blank=True)
    dropoff_eta_minutes = models.PositiveIntegerField(null=True, blank=True)

    vehicle_type = models.CharField(
        max_length=20,
        choices=[("moto", "Moto"), ("voiture", "Voiture"), ("camion", "Camion")],
        default="voiture",
    )
    estimated_distance_km = models.FloatField(null=True, blank=True)
    route_geometry = models.JSONField(null=True, blank=True)
    proposed_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    surcharge_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    final_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=24, choices=STATUS_CHOICES, default="searching")
    arrived_at = models.DateTimeField(null=True, blank=True)
    picked_up_at = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancelled_by_type = models.CharField(max_length=16, blank=True)
    cancellation_reason = models.CharField(max_length=100, blank=True)
    cancellation_comment = models.TextField(blank=True)
    previous_status = models.CharField(max_length=24, blank=True)
    request_key = models.CharField(max_length=64, unique=True, null=True, blank=True)
    availability_before_course = models.BooleanField(null=True, blank=True)
    # Vague de diffusion en cours : sert à la rediffusion automatique quand
    # une vague d'offres expire sans réponse (escalade façon Uber).
    broadcast_round = models.PositiveIntegerField(default=1)
    last_offer_at = models.DateTimeField(null=True, blank=True)

    client_confirmed = models.BooleanField(default=False)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Course client {self.client_id} -> livreur {self.livreur_id}"

    @property
    def is_delivery(self):
        return self.vehicle_type in ("moto", "camion")

    @property
    def has_pickup_point(self):
        """Vrai quand un commerçant a été désigné (sinon on retombe sur le client)."""
        return self.pickup_latitude is not None and self.pickup_longitude is not None

    @property
    def pickup_position(self):
        """Coordonnées du point de retrait, avec repli sur la position du client."""
        if self.has_pickup_point:
            return self.pickup_latitude, self.pickup_longitude
        return self.client_latitude, self.client_longitude

    @property
    def dropoff_position(self):
        """Coordonnées de livraison, avec repli sur la position du client."""
        if self.destination_latitude is not None and self.destination_longitude is not None:
            return self.destination_latitude, self.destination_longitude
        return self.client_latitude, self.client_longitude


class CourseOffer(models.Model):
    RESPONSE_CHOICES = [
        ("pending", "En attente"),
        ("accepted", "Acceptée"),
        ("rejected", "Refusée"),
        ("withdrawn", "Retirée"),
    ]

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="offers")
    livreur = models.ForeignKey(Livreur, on_delete=models.CASCADE, related_name="course_offers")
    response = models.CharField(max_length=12, choices=RESPONSE_CHOICES, default="pending")
    # Numéro de vague de diffusion : une offre retirée au profit d'une nouvelle
    # vague laisse la trace du numéro qui l'a générée.
    round_number = models.PositiveIntegerField(default=1)
    # Distance / ETA calculés au moment de la diffusion pour ce livreur :
    # c'est ce qui s'affiche sur la carte d'offre façon Uber.
    pickup_distance_km = models.FloatField(null=True, blank=True)
    pickup_eta_minutes = models.PositiveIntegerField(null=True, blank=True)
    dropoff_distance_km = models.FloatField(null=True, blank=True)
    dropoff_eta_minutes = models.PositiveIntegerField(null=True, blank=True)
    # Date d'expiration de l'offre (minuterie façon Uber). Une offre expirée
    # n'est plus proposable et passe automatiquement en "withdrawn".
    expires_at = models.DateTimeField(null=True, blank=True)
    notified_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["course", "livreur"], name="unique_course_offer_per_livreur"),
        ]


class CourseEvent(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="events")
    actor_type = models.CharField(max_length=16, blank=True)
    actor_id = models.PositiveIntegerField(null=True, blank=True)
    event_type = models.CharField(max_length=32)
    previous_status = models.CharField(max_length=24, blank=True)
    new_status = models.CharField(max_length=24, blank=True)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]

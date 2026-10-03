from django.db import models
from django.contrib.auth.models import User


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
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.nom

#table de position client 
class Course(models.Model):
    STATUS_CHOICES = [
        ("searching", "Recherche de chauffeur"),
        ("driver_accepted", "Chauffeur intéressé"),
        ("driver_selected", "Chauffeur sélectionné"),
        ("driver_arriving", "Chauffeur en route"),
        ("driver_arrived", "Chauffeur arrivé"),
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
    started_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancelled_by_type = models.CharField(max_length=16, blank=True)
    cancellation_reason = models.CharField(max_length=100, blank=True)
    cancellation_comment = models.TextField(blank=True)
    previous_status = models.CharField(max_length=24, blank=True)
    request_key = models.CharField(max_length=64, unique=True, null=True, blank=True)
    availability_before_course = models.BooleanField(null=True, blank=True)

    client_confirmed = models.BooleanField(default=False)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Course client {self.client_id} -> livreur {self.livreur_id}"


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
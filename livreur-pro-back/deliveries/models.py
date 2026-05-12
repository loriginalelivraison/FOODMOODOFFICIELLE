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

    note = models.FloatField(default=5)
    nombre_livraisons = models.PositiveIntegerField(default=0)

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
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.nom

#table de position client 
class Course(models.Model):
    client = models.ForeignKey(Client, on_delete=models.CASCADE)
    livreur = models.ForeignKey(Livreur, on_delete=models.CASCADE)

    client_latitude = models.FloatField(null=True, blank=True)
    client_longitude = models.FloatField(null=True, blank=True)

    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Course client {self.client_id} -> livreur {self.livreur_id}"
from django.contrib import admin
from .models import Livreur, DemandeLivraison

@admin.register(Livreur)
class LivreurAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "nom",
        "telephone",
        "ville",
        "vehicule",
        "disponible",
        "note",
        "nombre_livraisons",
        "photo",
    )
    list_filter = ("ville", "vehicule", "disponible")
    search_fields = ("nom", "telephone", "email", "ville")


@admin.register(DemandeLivraison)
class DemandeLivraisonAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "client_nom",
        "client_telephone",
        "adresse_depart",
        "adresse_arrivee",
        "livreur",
        "statut",
        "prix_estime",
        "tracking_code",
        "created_at",
    )
    list_filter = ("statut", "created_at")
    search_fields = (
        "client_nom",
        "client_telephone",
        "adresse_depart",
        "adresse_arrivee",
        "tracking_code",
    )
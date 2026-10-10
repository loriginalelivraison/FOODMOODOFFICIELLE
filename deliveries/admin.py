from django.contrib import admin
from .models import Livreur, DemandeLivraison, DriverDocument, CourseComplaint
from django.urls import path, reverse
from django.http import FileResponse, Http404
from django.utils.html import format_html


@admin.register(CourseComplaint)
class CourseComplaintAdmin(admin.ModelAdmin):
    list_display = ("id", "course_number", "reporter", "reporter_role", "reason", "created_at", "status")
    list_editable = ("status",)
    list_filter = ("status", "reporter_role", "reason", "created_at")
    search_fields = ("=course__id", "reporter__username", "comment")
    list_select_related = ("course", "reporter")
    fields = ("course_number", "course", "reporter", "reporter_role", "reason", "comment", "created_at", "status")
    readonly_fields = ("course_number", "course", "reporter", "reporter_role", "reason", "comment", "created_at")

    @admin.display(description="Course n°", ordering="course_id")
    def course_number(self, obj):
        return obj.course_id

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


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
    search_fields = ("nom", "telephone", "ville")


@admin.register(DriverDocument)
class DriverDocumentAdmin(admin.ModelAdmin):
    list_display = ("livreur", "kind", "status", "uploaded_at")
    list_filter = ("kind", "status")
    fields = ("livreur", "kind", "download", "status", "uploaded_at")
    readonly_fields = ("livreur", "kind", "download", "uploaded_at")

    def has_add_permission(self, request):
        return False

    def get_urls(self):
        return [path("<int:pk>/download/", self.admin_site.admin_view(self.download_view),
                     name="deliveries_driverdocument_download")] + super().get_urls()

    @admin.display(description="Document privé")
    def download(self, obj):
        return format_html('<a href="{}">Consulter le document</a>',
                           reverse("admin:deliveries_driverdocument_download", args=[obj.pk]))

    def download_view(self, request, pk):
        obj = self.get_object(request, pk)
        if not obj or not self.has_view_permission(request, obj):
            raise Http404()
        response = FileResponse(obj.file.open("rb"), as_attachment=True,
                                filename=f"{obj.kind}{'.png' if obj.file.name.endswith('.png') else '.jpg'}")
        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        return response


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

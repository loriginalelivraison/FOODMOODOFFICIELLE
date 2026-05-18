from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import LivreurViewSet, DemandeLivraisonViewSet, register_livreur, CommentaireLivreurViewSet, ClientViewSet, register_client, CourseViewSet

router = DefaultRouter()
router.register("livreurs", LivreurViewSet, basename="livreurs")
router.register("demandes", DemandeLivraisonViewSet, basename="demandes")
router.register(r"commentaires-livreurs", CommentaireLivreurViewSet, basename="commentaires-livreurs")
router.register(r"clients", ClientViewSet, basename="client")
router.register(r"courses", CourseViewSet, basename="courses")

urlpatterns = [
    path("clients/register/", register_client),
    path("livreurs/register/", register_livreur),
    path("", include(router.urls)),
   
   
]
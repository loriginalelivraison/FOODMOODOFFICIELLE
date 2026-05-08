from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import LivreurViewSet, DemandeLivraisonViewSet, register_livreur, CommentaireLivreurViewSet, ClientViewSet, register_client

router = DefaultRouter()
router.register("livreurs", LivreurViewSet)
router.register("demandes", DemandeLivraisonViewSet)
router.register(r"commentaires-livreurs", CommentaireLivreurViewSet, basename="commentaires-livreurs")
router.register(r"clients", ClientViewSet, basename="client")

urlpatterns = [
    path("clients/register/", register_client),
    path("livreurs/register/", register_livreur),
    path("", include(router.urls)),
   
   
]
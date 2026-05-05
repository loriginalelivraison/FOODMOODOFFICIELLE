from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import LivreurViewSet, DemandeLivraisonViewSet, register_livreur

router = DefaultRouter()
router.register("livreurs", LivreurViewSet)
router.register("demandes", DemandeLivraisonViewSet)

urlpatterns = [
    path("livreurs/register/", register_livreur),
    path("", include(router.urls))
   
]
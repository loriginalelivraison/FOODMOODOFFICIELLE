from io import BytesIO
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.files.storage import FileSystemStorage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from PIL import Image
from rest_framework.test import APIClient

from .models import Livreur


class DriverPhotoTests(TestCase):
    def setUp(self):
        self.driver = Livreur.objects.create(
            user=User.objects.create_user("photo-driver"), nom="Driver",
            telephone="0555001103", ville="Alger", vehicule="moto",
        )
        self.other_driver = Livreur.objects.create(
            user=User.objects.create_user("other-driver"), nom="Other",
            telephone="0555001104", ville="Alger", vehicule="moto",
        )
        self.api = APIClient()
        self.api.force_authenticate(self.driver.user)

    def test_owner_can_upload_and_view_photo_but_cannot_change_another_profile(self):
        url = f"/api/livreurs/{self.driver.id}/"
        image = BytesIO()
        Image.new("RGB", (2, 2), "red").save(image, format="PNG")
        upload = SimpleUploadedFile("portrait.png", image.getvalue(), content_type="image/png")

        with TemporaryDirectory() as directory:
            storage = FileSystemStorage(location=directory, base_url="/media/")
            with patch.object(Livreur._meta.get_field("photo"), "storage", storage):
                response = self.api.patch(url, {"photo": upload, "nom": "Renamed"}, format="multipart")
                self.assertEqual(response.status_code, 200)
                self.assertIn("/media/livreurs/portrait", response.data["photo"])
                self.assertEqual(response.data["nom"], "Renamed")
                self.assertEqual(self.api.get(url).data["photo"], response.data["photo"])
                self.assertEqual(self.api.get("/api/livreurs/me/").data["photo"], response.data["photo"])

                other_url = f"/api/livreurs/{self.other_driver.id}/"
                self.assertEqual(self.api.patch(other_url, {"nom": "Wrong"}, format="json").status_code, 404)

    def test_photo_over_five_megabytes_is_rejected(self):
        image = BytesIO()
        Image.new("RGB", (2, 2), "red").save(image, format="PNG")
        upload = SimpleUploadedFile(
            "large.png", image.getvalue() + b"\0" * (5 * 1024 * 1024), content_type="image/png"
        )
        response = self.api.patch(f"/api/livreurs/{self.driver.id}/", {"photo": upload}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertIn("photo", response.data)

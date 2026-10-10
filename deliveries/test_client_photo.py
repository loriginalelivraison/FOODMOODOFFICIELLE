from io import BytesIO
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.files.storage import FileSystemStorage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from PIL import Image
from rest_framework.test import APIClient

from .models import Client


class ClientPhotoTests(TestCase):
    def setUp(self):
        self.client_profile = Client.objects.create(
            user=User.objects.create_user("photo-client"), nom="Client", telephone="0555001101"
        )
        self.other_profile = Client.objects.create(
            user=User.objects.create_user("photo-other"), nom="Other", telephone="0555001102"
        )
        self.api = APIClient()
        self.api.force_authenticate(self.client_profile.user)

    def test_photo_is_optional_and_only_owner_can_upload_it(self):
        url = f"/api/clients/{self.client_profile.id}/"
        self.assertIsNone(self.api.get(url).data["photo"])
        self.assertEqual(self.api.patch(url, {"nom": "Updated"}, format="json").status_code, 200)

        image = BytesIO()
        Image.new("RGB", (2, 2), "red").save(image, format="PNG")
        upload = SimpleUploadedFile("portrait.png", image.getvalue(), content_type="image/png")
        with TemporaryDirectory() as directory:
            storage = FileSystemStorage(location=directory, base_url="/media/")
            with patch.object(Client._meta.get_field("photo"), "storage", storage):
                response = self.api.patch(url, {"photo": upload}, format="multipart")
                self.assertEqual(response.status_code, 200)
                self.assertIn("/media/clients/portrait", response.data["photo"])
                self.client_profile.refresh_from_db()
                self.assertTrue(self.client_profile.photo.name.startswith("clients/portrait"))
                self.assertEqual(self.api.get(url).data["photo"], response.data["photo"])
                name_update = self.api.patch(url, {"nom": "Renamed"}, format="json")
                self.assertEqual(name_update.status_code, 200)
                self.assertEqual(name_update.data["photo"], response.data["photo"])

                other_url = f"/api/clients/{self.other_profile.id}/"
                self.assertEqual(self.api.patch(other_url, {"nom": "Wrong"}, format="json").status_code, 404)

import io
import ntpath
import tempfile
from pathlib import Path
from unittest.mock import patch

from PIL import Image
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import Client, Course, CourseEvent, CourseOffer, DriverDocument, Livreur
from .firebase import send_client_notification, send_livreur_notification


class AccountSecurityTests(TestCase):
    def setUp(self):
        self.customer = Client.objects.create(user=User.objects.create_user("customer"), nom="Client", telephone="0101")
        self.driver = Livreur.objects.create(user=User.objects.create_user("driver"), nom="Driver", telephone="0102",
                                            ville="Alger", vehicule="voiture", est_en_ligne=True)
        self.other = Livreur.objects.create(user=User.objects.create_user("other"), nom="Other", telephone="0103",
                                           ville="Alger", vehicule="moto", est_en_ligne=True)
        self.customer_api = APIClient()
        self.customer_api.force_authenticate(self.customer.user)
        self.driver_api = APIClient()
        self.driver_api.force_authenticate(self.driver.user)
        self.other_api = APIClient()
        self.other_api.force_authenticate(self.other.user)
        self.private_root = tempfile.TemporaryDirectory()
        self.storage_settings = override_settings(PRIVATE_DOCUMENT_ROOT=self.private_root.name,
                                                  PRIVATE_DOCUMENT_BACKEND="filesystem")
        self.storage_settings.enable()
        self.addCleanup(self.private_root.cleanup)
        self.addCleanup(self.storage_settings.disable)

    def make_course(self, **kwargs):
        return Course.objects.create(client=self.customer, livreur=self.driver,
                                     status="driver_selected", active=True, client_confirmed=True, **kwargs)

    def image_upload(self):
        buffer = io.BytesIO()
        Image.new("RGB", (12, 12), "orange").save(buffer, "PNG")
        return SimpleUploadedFile("license.png", buffer.getvalue(), content_type="image/png")

    def documents_url(self, driver=None):
        return f"/api/livreurs/{(driver or self.driver).id}/documents/"

    def test_driver_cannot_book_via_either_course_endpoint(self):
        for api in (self.driver_api, self.other_api):
            for url in ("/api/courses/", "/api/courses/request/", "/api/demandes/"):
                response = api.post(url, {}, format="json")
                self.assertEqual(response.status_code, 403)
                self.assertIn("حساب عميل", str(response.data))
        self.assertEqual(Course.objects.count(), 0)

    @patch("deliveries.views.send_livreur_notification")
    def test_legacy_direct_booking_keeps_moto_role_and_posts_after_commit(self, send):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.customer_api.post("/api/courses/", {
                "client": self.customer.id, "livreur": self.other.id,
                "client_latitude": 36.75, "client_longitude": 3.06,
            }, format="json")
            send.assert_not_called()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["vehicle_type"], "moto")
        send.assert_called_once()

    def test_generic_course_updates_cannot_reactivate_cancelled_course(self):
        course = self.make_course()
        course.status = "cancelled"
        course.active = False
        course.save()
        for method in (self.customer_api.patch, self.customer_api.put):
            response = method(f"/api/courses/{course.id}/", {"active": True, "status": "in_progress"}, format="json")
            self.assertEqual(response.status_code, 405)
        course.refresh_from_db()
        self.assertFalse(course.active)

    @patch("deliveries.views.send_client_notification")
    @patch("deliveries.views.send_livreur_notification")
    def test_driver_cancellation_notifies_client_once_and_withdraws_offers(self, driver_push, client_push):
        course = self.make_course()
        CourseOffer.objects.create(course=course, livreur=self.driver, response="accepted")
        for _ in range(2):
            with self.captureOnCommitCallbacks(execute=True):
                response = self.driver_api.post(f"/api/courses/{course.id}/cancel/", {"reason": "vehicle_issue"}, format="json")
            self.assertEqual(response.status_code, 200)
        course.refresh_from_db()
        self.assertFalse(course.active)
        self.assertEqual(course.status, "cancelled")
        self.assertEqual(CourseEvent.objects.filter(course=course, event_type="cancelled").count(), 1)
        self.assertFalse(course.offers.filter(response__in=["pending", "accepted"]).exists())
        client_push.assert_called_once()
        self.assertIn("نعتذر", client_push.call_args.args[2])
        driver_push.assert_not_called()

    @patch("deliveries.views.send_client_notification")
    @patch("deliveries.views.send_livreur_notification")
    def test_client_cancellation_notifies_legacy_selected_driver_without_offer(self, driver_push, client_push):
        course = self.make_course()
        with self.captureOnCommitCallbacks(execute=True):
            response = self.customer_api.post(f"/api/courses/{course.id}/cancel/", {"reason": "changed_mind"}, format="json")
        self.assertEqual(response.status_code, 200)
        driver_push.assert_called_once()
        self.assertEqual(driver_push.call_args.args[0].id, self.driver.id)
        client_push.assert_not_called()

    def test_unrelated_driver_cannot_cancel(self):
        course = self.make_course()
        response = self.other_api.post(f"/api/courses/{course.id}/cancel/", {"reason": "vehicle_issue"}, format="json")
        self.assertEqual(response.status_code, 404)
        course.refresh_from_db()
        self.assertTrue(course.active)

    def test_public_driver_profile_hides_push_and_contact_details(self):
        self.driver.fcm_token = "private-token"
        self.driver.save()
        public = APIClient().get(f"/api/livreurs/{self.driver.id}/")
        self.assertNotIn("fcm_token", public.data)
        self.assertNotIn("telephone", public.data)
        own = self.driver_api.get("/api/livreurs/me/")
        self.assertEqual(own.data["telephone"], self.driver.telephone)
        self.assertNotIn("fcm_token", own.data)

    def test_driver_phone_only_visible_after_client_selection(self):
        course = Course.objects.create(client=self.customer, status="driver_accepted")
        CourseOffer.objects.create(course=course, livreur=self.driver, response="accepted")
        response = self.customer_api.get(f"/api/courses/{course.id}/")
        self.assertIsNone(response.data["accepted_drivers"][0]["telephone"])
        course.livreur = self.driver
        course.status = "driver_selected"
        course.save()
        response = self.customer_api.get(f"/api/courses/{course.id}/")
        self.assertEqual(response.data["accepted_drivers"][0]["telephone"], self.driver.telephone)

    def test_offline_driver_is_not_selectable(self):
        course = Course.objects.create(client=self.customer, status="driver_accepted")
        CourseOffer.objects.create(course=course, livreur=self.driver, response="accepted")
        self.driver.est_en_ligne = False
        self.driver.save()
        response = self.customer_api.post(f"/api/courses/{course.id}/select_driver/", {"livreur_id": self.driver.id}, format="json")
        self.assertEqual(response.status_code, 409)

    def test_client_push_token_is_private_unique_and_clearable(self):
        self.driver.fcm_token = "device-token"
        self.driver.save()
        url = f"/api/clients/{self.customer.id}/update_fcm_token/"
        response = self.customer_api.patch(url, {"fcm_token": "device-token"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.driver.refresh_from_db()
        self.customer.refresh_from_db()
        self.assertIsNone(self.driver.fcm_token)
        self.assertEqual(self.customer.fcm_token, "device-token")
        self.assertNotIn("fcm_token", self.customer_api.get("/api/clients/").data[0])
        self.assertEqual(self.other_api.patch(url, {"fcm_token": "other"}, format="json").status_code, 404)
        self.assertEqual(self.customer_api.delete(url).status_code, 200)

    def test_upload_replace_and_authenticated_download(self):
        url = self.documents_url()
        response = self.driver_api.post(url, {"kind": "license", "file": self.image_upload()}, format="multipart")
        self.assertEqual(response.status_code, 200)
        document = DriverDocument.objects.get(livreur=self.driver, kind="license")
        original = document.file.path
        self.assertTrue(Path(original).is_file())
        self.assertNotIn("file", response.data[0])
        with self.assertRaises(ValueError):
            _ = document.file.url
        document.status = "verified"
        document.save()
        with self.captureOnCommitCallbacks(execute=True):
            replacement = self.driver_api.post(url, {"kind": "license", "file": self.image_upload(), "status": "verified"}, format="multipart")
        self.assertEqual(replacement.status_code, 200)
        document.refresh_from_db()
        self.assertEqual(document.status, "pending")
        self.assertFalse(Path(original).exists())
        download_url = url + "license/download/"
        response = self.driver_api.get(download_url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Cache-Control"], "private, no-store")
        response.close()
        self.assertEqual(self.other_api.get(download_url).status_code, 404)
        self.assertEqual(APIClient().get(download_url).status_code, 401)
        self.assertEqual(self.customer_api.get(url).status_code, 404)

    def test_document_validation_checks_actual_bytes_and_size(self):
        bad_files = [SimpleUploadedFile("image.png", b"not an image", content_type="image/png"),
                     SimpleUploadedFile("too-large.png", b"x" * (5 * 1024 * 1024 + 1), content_type="image/png")]
        for upload in bad_files:
            response = self.driver_api.post(self.documents_url(), {"kind": "vehicle", "file": upload}, format="multipart")
            self.assertEqual(response.status_code, 400)
        self.assertEqual(DriverDocument.objects.count(), 0)

    def test_missing_documents_do_not_block_existing_driver(self):
        response = self.driver_api.patch(f"/api/livreurs/{self.driver.id}/set_online/")
        self.assertEqual(response.status_code, 200)
        documents = self.driver_api.get(self.documents_url())
        self.assertEqual([doc["status"] for doc in documents.data], ["missing", "missing"])

    @override_settings(PRIVATE_DOCUMENT_BACKEND="cloudinary")
    @patch("deliveries.private_storage.cloudinary.uploader.upload")
    @patch("deliveries.private_storage.cloudinary.uploader.destroy")
    @patch("deliveries.private_storage.requests.get")
    @patch("deliveries.private_storage.cloudinary.utils.private_download_url", return_value="https://example.test/private")
    def test_cloud_documents_use_authenticated_storage_and_proxy_download(self, private_url, get, destroy, upload):
        from .private_storage import PrivateDocumentStorage
        upload.return_value = {"type": "authenticated", "public_id": "drivers/7/random", "format": "png"}
        storage = PrivateDocumentStorage()
        for path in ("drivers/7/random.png", r"drivers\7\random.png"):
            with self.subTest(path=path):
                name = storage.save(path, self.image_upload())
                self.assertEqual(upload.call_args.kwargs["public_id"], "drivers/7/random")
                self.assertEqual(upload.call_args.kwargs["format"], "png")
                self.assertEqual(name, "drivers/7/random.png")
        self.assertEqual(upload.call_args.kwargs["type"], "authenticated")
        self.assertFalse(upload.call_args.kwargs["overwrite"])
        get.return_value.__enter__.return_value.iter_content.return_value = [b"private-image-data"]
        self.assertEqual(storage.open(name).read(), b"private-image-data")
        self.assertEqual(private_url.call_args.kwargs["type"], "authenticated")
        with self.assertRaises(ValueError):
            storage.url(name)
        storage.delete(name)
        self.assertEqual(destroy.call_args.kwargs["type"], "authenticated")

    @override_settings(PRIVATE_DOCUMENT_BACKEND="cloudinary")
    @patch("deliveries.private_storage.cloudinary.uploader.upload")
    def test_cloud_document_upload_normalizes_windows_paths(self, upload):
        def cloud_upload(content, **options):
            self.assertNotIn("\\", options["public_id"])
            self.assertTrue(options["public_id"].startswith(f"drivers/{self.driver.id}/"))
            self.assertEqual(options["type"], "authenticated")
            return {"type": "authenticated", "public_id": options["public_id"], "format": options["format"]}

        upload.side_effect = cloud_upload
        storage = DriverDocument._meta.get_field("file").storage
        # Reproduce Django's Windows filename generation on every platform.
        with patch.object(storage, "generate_filename", side_effect=ntpath.normpath):
            for kind in ("license", "vehicle"):
                with self.subTest(kind=kind):
                    response = self.driver_api.post(self.documents_url(), {
                        "kind": kind, "file": self.image_upload(),
                    }, format="multipart")
                    self.assertEqual(response.status_code, 200)
                    document = DriverDocument.objects.get(livreur=self.driver, kind=kind)
                    self.assertEqual(document.file.name, f"{upload.call_args.kwargs['public_id']}.png")
                    self.assertEqual(document.status, "pending")
                    self.assertNotIn("file", response.data[0])

    def test_document_file_is_deleted_when_driver_account_is_deleted(self):
        self.driver_api.post(self.documents_url(), {"kind": "license", "file": self.image_upload()}, format="multipart")
        document = DriverDocument.objects.get(livreur=self.driver)
        path = document.file.path
        with self.captureOnCommitCallbacks(execute=True):
            self.driver.delete()
        self.assertFalse(Path(path).exists())

    @patch("deliveries.firebase.init_firebase")
    @patch("deliveries.firebase.messaging.send")
    def test_push_payload_uses_custom_sound_recipient_and_unique_offer_round(self, send, initialize):
        self.customer.fcm_token = "customer-device"
        self.driver.fcm_token = "driver-device"
        send_client_notification(self.customer, "تم إلغاء الرحلة", "نعتذر", course_id=42, notification_type="course_cancelled")
        message = send.call_args.args[0]
        self.assertEqual(message.data["recipient_role"], "client")
        self.assertEqual(message.apns.payload.aps.sound, "winrak_notification.wav")
        self.assertIsNone(message.notification)
        self.assertEqual(message.apns.headers["apns-collapse-id"], message.data["event_id"])
        send_client_notification(self.customer, "بدأت الرحلة", "السائق في الطريق", course_id=42,
                                 notification_type="driver_arriving", extra_data={"event_id": "client:1:course:42:event:7"})
        message = send.call_args.args[0]
        self.assertEqual(message.data["event_id"], "client:1:course:42:event:7")
        self.assertEqual(message.apns.headers["apns-collapse-id"], "client:1:course:42:event:7")
        send_livreur_notification(self.driver, "طلب جديد", "500 دج", course_id=42,
                                 notification_type="course_offer", extra_data={"round": 2})
        message = send.call_args.args[0]
        self.assertEqual(message.data["event_id"], f"livreur:{self.driver.id}:course_offer:42:2")
        self.assertEqual(message.apns.headers["apns-collapse-id"], "course-42")
        self.assertEqual(message.apns.payload.aps.category, "COURSE_OFFER")

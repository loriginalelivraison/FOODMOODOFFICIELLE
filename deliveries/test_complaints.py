from django.contrib import admin
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Client, Course, CourseComplaint, CourseOffer, Livreur


class CourseComplaintTests(TestCase):
    def setUp(self):
        self.customer = Client.objects.create(
            user=User.objects.create_user("complaint-client"), nom="Client", telephone="30001",
        )
        self.driver = Livreur.objects.create(
            user=User.objects.create_user("complaint-driver"), nom="Driver",
            telephone="30002", ville="Alger", vehicule="voiture",
        )
        self.other_driver = Livreur.objects.create(
            user=User.objects.create_user("other-complaint-driver"), nom="Other",
            telephone="30003", ville="Alger", vehicule="voiture",
        )
        self.course = Course.objects.create(
            client=self.customer, livreur=self.driver, status="in_progress",
        )
        self.url = f"/api/courses/{self.course.id}/complaint/"
        self.client_api = APIClient()
        self.client_api.force_authenticate(self.customer.user)
        self.driver_api = APIClient()
        self.driver_api.force_authenticate(self.driver.user)
        self.other_api = APIClient()
        self.other_api.force_authenticate(self.other_driver.user)

    def test_client_complaint_is_saved_once_and_returned_from_history(self):
        self.assertIsNone(self.client_api.get(self.url).data["complaint"])
        first = self.client_api.post(self.url, {
            "reason": "driver_delay", "comment": "Le chauffeur est arrivé tard.",
            "status": "resolved", "reporter": self.other_driver.user_id,
        }, format="json")
        self.assertEqual(first.status_code, 201)
        complaint = CourseComplaint.objects.get(pk=first.data["id"])
        self.assertEqual(complaint.course, self.course)
        self.assertEqual(complaint.reporter, self.customer.user)
        self.assertEqual(complaint.reporter_role, "client")
        self.assertEqual(complaint.reason, "driver_delay")
        self.assertEqual(complaint.status, "new")
        self.assertIsNotNone(complaint.created_at)

        repeated = self.client_api.post(self.url, {
            "reason": "payment", "comment": "Second click",
        }, format="json")
        self.assertEqual(repeated.status_code, 200)
        self.assertEqual(repeated.data["id"], complaint.id)
        self.assertEqual(CourseComplaint.objects.filter(course=self.course, reporter=self.customer.user).count(), 1)
        self.assertEqual(self.client_api.get(self.url).data["complaint"]["id"], complaint.id)
        complaint.refresh_from_db()
        self.assertEqual(complaint.comment, "Le chauffeur est arrivé tard.")

    def test_driver_has_own_reasons_and_only_assigned_driver_can_report(self):
        self.assertEqual(self.driver_api.post(self.url, {"reason": "client_absent"}).status_code, 201)
        complaint = CourseComplaint.objects.get(reporter=self.driver.user)
        self.assertEqual(complaint.reporter_role, "livreur")
        self.assertEqual(complaint.comment, "")
        self.assertEqual(self.driver_api.post(self.url, {"reason": "driver_delay"}).status_code, 200)

        another_course = Course.objects.create(client=self.customer, status="searching")
        CourseOffer.objects.create(course=another_course, livreur=self.other_driver)
        offer_url = f"/api/courses/{another_course.id}/complaint/"
        self.assertEqual(self.other_api.post(offer_url, {"reason": "client_absent"}).status_code, 403)
        self.assertEqual(self.other_api.post(self.url, {"reason": "client_absent"}).status_code, 404)
        self.assertEqual(APIClient().post(self.url, {"reason": "driver_delay"}).status_code, 401)

    def test_invalid_reason_and_long_comment_are_rejected(self):
        self.assertEqual(self.client_api.post(self.url, {"reason": "client_absent"}).status_code, 400)
        self.assertEqual(self.client_api.post(self.url, {"reason": "driver_delay", "comment": "x" * 1001}).status_code, 400)
        self.assertEqual(CourseComplaint.objects.count(), 0)

    def test_admin_can_review_and_change_only_status(self):
        complaint = CourseComplaint.objects.create(
            course=self.course, reporter=self.customer.user, reporter_role="client", reason="payment",
        )
        self.assertIn(CourseComplaint, admin.site._registry)
        staff = User.objects.create_superuser("complaint-admin", "admin@example.test", "secret")
        self.client.force_login(staff)
        change_url = f"/admin/deliveries/coursecomplaint/{complaint.id}/change/"
        self.assertEqual(self.client.get(change_url).status_code, 200)
        response = self.client.post(change_url, {"status": "resolved", "_save": "Save"})
        self.assertEqual(response.status_code, 302)
        complaint.refresh_from_db()
        self.assertEqual(complaint.status, "resolved")
        self.assertEqual(complaint.reason, "payment")

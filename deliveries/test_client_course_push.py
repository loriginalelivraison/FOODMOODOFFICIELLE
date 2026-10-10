from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Client, Course, CourseOffer, Livreur


class ClientCoursePushTests(TestCase):
    def setUp(self):
        self.client = Client.objects.create(
            user=User.objects.create_user("push-client"), nom="Client",
            telephone="10001", fcm_token="client-device",
        )
        self.driver = Livreur.objects.create(
            user=User.objects.create_user("push-driver"), nom="Driver",
            telephone="10002", ville="Alger", vehicule="voiture",
            est_en_ligne=True, fcm_token="driver-device",
        )
        self.driver_api = APIClient()
        self.driver_api.force_authenticate(self.driver.user)

    @patch("deliveries.views.send_client_notification")
    def test_acceptance_and_distinct_price_offer_notify_once_each(self, push):
        other = Livreur.objects.create(
            user=User.objects.create_user("other-push-driver"), nom="Other",
            telephone="10003", ville="Alger", vehicule="voiture", est_en_ligne=True,
        )
        other_api = APIClient()
        other_api.force_authenticate(other.user)
        course = Course.objects.create(
            client=self.client, status="searching", final_price=Decimal("500.00"),
        )
        CourseOffer.objects.create(course=course, livreur=self.driver)
        CourseOffer.objects.create(course=course, livreur=other)
        url = f"/api/courses/{course.id}/respond/"

        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.driver_api.post(url, {"response": "accepted"}).status_code, 200)
            self.assertEqual(self.driver_api.post(url, {"response": "accepted"}).status_code, 200)
            self.assertEqual(other_api.post(url, {
                "response": "accepted", "offered_price": "650.00",
            }).status_code, 200)

        self.assertEqual(push.call_count, 2)
        first, second = push.call_args_list
        self.assertEqual(first.kwargs["notification_type"], "course_accepted")
        self.assertEqual(second.kwargs["notification_type"], "course_price_proposed")
        self.assertEqual(second.kwargs["extra_data"]["price"], "650")
        self.assertNotEqual(
            first.kwargs["extra_data"]["event_id"],
            second.kwargs["extra_data"]["event_id"],
        )
        self.assertTrue(all(call.kwargs["course_id"] == course.id for call in push.call_args_list))

    @patch("deliveries.views.send_client_notification")
    def test_driver_progress_and_completion_push_after_commit_without_repeats(self, push):
        course = Course.objects.create(
            client=self.client, livreur=self.driver,
            status="driver_selected", client_confirmed=True,
        )
        url = f"/api/courses/{course.id}/"

        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.driver_api.post(url + "enroute/").status_code, 200)
            self.assertEqual(self.driver_api.post(url + "enroute/").status_code, 200)
            self.assertEqual(self.driver_api.post(url + "arrive/").status_code, 200)
            self.assertEqual(self.driver_api.post(url + "start/").status_code, 200)
            self.assertEqual(self.driver_api.post(url + "start/").status_code, 200)
            self.assertEqual(self.driver_api.patch(url + "finish/").status_code, 200)
            self.assertEqual(self.driver_api.patch(url + "finish/").status_code, 200)

        self.assertEqual(
            [call.kwargs["notification_type"] for call in push.call_args_list],
            ["driver_arriving", "in_progress", "course_completed"],
        )
        self.assertEqual(len({
            call.kwargs["extra_data"]["event_id"] for call in push.call_args_list
        }), 3)

    @patch("deliveries.views.send_client_notification")
    def test_rolled_back_transition_does_not_send_push(self, push):
        course = Course.objects.create(
            client=self.client, livreur=self.driver, status="driver_selected",
        )
        from django.db import transaction

        with self.assertRaises(RuntimeError):
            with transaction.atomic():
                self.assertEqual(
                    self.driver_api.post(f"/api/courses/{course.id}/enroute/").status_code,
                    200,
                )
                raise RuntimeError("rollback")

        push.assert_not_called()
        course.refresh_from_db()
        self.assertEqual(course.status, "driver_selected")

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Client, Course, Livreur


class CourseTrackingTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.customer = Client.objects.create(
            user=User.objects.create(username="tracking-client"), nom="Client", telephone="0001",
        )
        cls.driver = Livreur.objects.create(
            user=User.objects.create(username="tracking-driver"), nom="Driver", telephone="0002",
            ville="Alger", vehicule="voiture", latitude=36.6, longitude=3.0,
        )
        cls.other_driver = Livreur.objects.create(
            user=User.objects.create(username="tracking-other"), nom="Other", telephone="0003",
            ville="Alger", vehicule="voiture",
        )

    def setUp(self):
        self.driver_api = APIClient()
        self.driver_api.force_authenticate(self.driver.user)
        self.client_api = APIClient()
        self.client_api.force_authenticate(self.customer.user)

    def make_course(self, vehicle="voiture", status="driver_selected", **overrides):
        fields = dict(
            client=self.customer, livreur=self.driver, vehicle_type=vehicle, status=status,
            client_latitude=36.75, client_longitude=3.05,
            pickup_address="Pickup", pickup_latitude=36.7, pickup_longitude=3.1,
            destination="Dropoff", destination_latitude=36.8, destination_longitude=3.2,
            pickup_route_geometry=[[3.05, 36.75], [3.1, 36.7]],
            trip_route_geometry=[[3.1, 36.7], [3.2, 36.8]],
            route_geometry=[[3.1, 36.7], [3.2, 36.8]],
            active=True, client_confirmed=True, availability_before_course=True,
        )
        fields.update(overrides)
        return Course.objects.create(**fields)

    def action(self, course, action):
        return self.driver_api.post(f"/api/courses/{course.id}/{action}/")

    def test_car_lifecycle_has_no_order_pickup(self):
        course = self.make_course()
        for action, state in (("enroute", "driver_arriving"), ("arrive", "driver_arrived")):
            response = self.action(course, action)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["status"], state)
        self.assertEqual(self.action(course, "pickup").status_code, 409)
        started = self.action(course, "start")
        self.assertEqual(started.status_code, 200)
        self.assertEqual(started.data["status"], "in_progress")
        self.assertIsNone(started.data["picked_up_at"])
        finished = self.driver_api.patch(f"/api/courses/{course.id}/finish/")
        self.assertEqual(finished.status_code, 200)
        self.assertEqual(finished.data["status"], "completed")
        self.assertEqual(list(course.events.values_list("event_type", flat=True)),
                         ["driver_arriving", "driver_arrived", "in_progress", "completed"])

    def test_delivery_lifecycle_requires_pickup_for_moto_and_truck(self):
        for vehicle in ("moto", "camion"):
            with self.subTest(vehicle=vehicle):
                course = self.make_course(vehicle)
                self.assertEqual(self.action(course, "pickup").status_code, 409)
                self.assertEqual(self.action(course, "arrive").status_code, 200)
                self.assertEqual(self.action(course, "start").status_code, 409)
                picked = self.action(course, "pickup")
                self.assertEqual(picked.status_code, 200)
                self.assertIsNotNone(picked.data["picked_up_at"])
                self.assertEqual(picked.data["navigation"]["stage"], "to_dropoff")
                self.assertEqual(picked.data["navigation"]["target_latitude"], 36.8)
                self.assertEqual(self.driver_api.patch(f"/api/courses/{course.id}/finish/").status_code, 409)
                self.assertEqual(self.action(course, "start").status_code, 200)
                finished = self.driver_api.patch(f"/api/courses/{course.id}/finish/")
                self.assertEqual(finished.status_code, 200)
                self.assertEqual(finished.data["navigation"]["stage"], "done")

    def test_repeated_transitions_and_finish_do_not_duplicate_rewards(self):
        course = self.make_course("moto", "driver_arrived")
        first = self.action(course, "pickup")
        second = self.action(course, "pickup")
        self.assertEqual(first.data["picked_up_at"], second.data["picked_up_at"])
        self.assertEqual(course.events.filter(event_type="picked_up").count(), 1)
        self.action(course, "start")
        self.assertEqual(self.action(course, "start").status_code, 200)
        self.driver_api.patch(f"/api/courses/{course.id}/finish/")
        self.customer.refresh_from_db()
        points = self.customer.points
        self.driver_api.patch(f"/api/courses/{course.id}/finish/")
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.points, points)
        self.assertEqual(course.events.filter(event_type="completed").count(), 1)

    def test_assigned_driver_and_terminal_states_are_enforced(self):
        course = self.make_course("moto", "driver_arrived")
        self.driver_api.force_authenticate(self.other_driver.user)
        self.assertEqual(self.action(course, "pickup").status_code, 404)
        self.driver_api.force_authenticate(self.driver.user)
        for state in ("completed", "cancelled"):
            course.status = state
            course.active = False
            course.save()
            for action in ("arrive", "pickup", "start"):
                self.assertEqual(self.action(course, action).status_code, 409)

    def test_old_car_in_pickup_state_can_resume_without_new_pickup(self):
        course = self.make_course("voiture", "picked_up")
        self.assertEqual(self.action(course, "start").status_code, 200)

    def test_navigation_uses_selected_pickup_and_live_driver_position(self):
        for vehicle in ("voiture", "moto"):
            with self.subTest(vehicle=vehicle):
                course = self.make_course(vehicle, "driver_arriving")
                response = self.client_api.get(f"/api/courses/{course.id}/")
                nav = response.data["navigation"]
                self.assertEqual(nav["target_latitude"], 36.7)
                self.assertEqual(nav["target_longitude"], 3.1)
                self.assertEqual(nav["route_geometry"], [[3.0, 36.6], [3.1, 36.7]])
                self.assertTrue(nav["route_is_estimate"])
                update = self.driver_api.patch(f"/api/livreurs/{self.driver.id}/update_position/",
                                              {"latitude": 36.65, "longitude": 3.02}, format="json")
                self.assertEqual(update.status_code, 200)
                response = self.client_api.get(f"/api/courses/{course.id}/")
                self.assertEqual(response.data["navigation"]["route_geometry"][0], [3.02, 36.65])
                self.assertEqual(response.data["accepted_drivers"][0]["latitude"], 36.65)
                Livreur.objects.filter(pk=self.driver.pk).update(latitude=36.6, longitude=3.0)

    def test_navigation_never_uses_client_to_store_route_for_driver(self):
        course = self.make_course("moto", livreur=None)
        response = self.client_api.get(f"/api/courses/{course.id}/")
        self.assertIsNone(response.data["navigation"]["route_geometry"])

    def test_trip_navigation_uses_selected_destination(self):
        course = self.make_course("voiture", "in_progress")
        nav = self.client_api.get(f"/api/courses/{course.id}/").data["navigation"]
        self.assertEqual(nav["target_latitude"], 36.8)
        self.assertEqual(nav["target_longitude"], 3.2)
        self.assertEqual(nav["route_geometry"], course.trip_route_geometry)

from unittest.mock import patch
from decimal import Decimal
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Client, Course, CourseEvent, CourseOffer, Livreur
from .course_services import current_surcharge_percent


@override_settings(
	COURSE_MIN_PRICE_DZD="100",
	COURSE_SURCHARGE_START="22:00",
	COURSE_SURCHARGE_END="06:00",
	COURSE_SURCHARGE_PERCENT="15",
	COURSE_SEARCH_RADIUS_KM=40,
)
class CourseRequestTests(TestCase):
	def setUp(self):
		self.client_user = User.objects.create_user(username="client", password="pass")
		self.client_profile = Client.objects.create(
			user=self.client_user,
			nom="Client WinRak",
			telephone="0555000001",
		)
		self.client_api = APIClient()
		self.client_api.force_authenticate(self.client_user)

		self.drivers = []
		for index, available in enumerate([False, True], start=1):
			user = User.objects.create_user(username=f"driver{index}", password="pass")
			self.drivers.append(Livreur.objects.create(
				user=user,
				nom=f"Chauffeur {index}",
				telephone=f"055500000{index + 1}",
				ville="Alger",
				vehicule="moto",
				disponible=available,
				est_en_ligne=True,
				latitude=36.75 + index * 0.001,
				longitude=3.06,
				fcm_token=f"token-{index}",
			))

	def create_request(self, price=500, vehicle_type="moto", request_key="client-request-1"):
		return self.client_api.post("/api/courses/request/", {
			"destination": "Place des Martyrs, Alger",
			"proposed_price": price,
			"client_latitude": 36.75,
			"client_longitude": 3.06,
			"request_key": request_key,
			"vehicle_type": vehicle_type,
		}, format="json")

	def test_surcharge_uses_configured_local_time_window(self):
		local_zone = ZoneInfo("Africa/Algiers")
		self.assertEqual(current_surcharge_percent(datetime(2026, 1, 1, 22, 0, tzinfo=local_zone)), Decimal("15"))
		self.assertEqual(current_surcharge_percent(datetime(2026, 1, 2, 5, 59, tzinfo=local_zone)), Decimal("15"))
		self.assertEqual(current_surcharge_percent(datetime(2026, 1, 2, 6, 0, tzinfo=local_zone)), Decimal("0"))

	def test_driver_fcm_token_is_cleared_and_unique_to_current_driver(self):
		previous_token = self.drivers[0].fcm_token
		previous_driver_api = APIClient()
		previous_driver_api.force_authenticate(self.drivers[0].user)
		cleared = previous_driver_api.delete(
			f"/api/livreurs/{self.drivers[0].id}/clear_fcm_token/"
		)
		self.assertEqual(cleared.status_code, 200)
		self.drivers[0].refresh_from_db()
		self.assertIsNone(self.drivers[0].fcm_token)

		current_driver_api = APIClient()
		current_driver_api.force_authenticate(self.drivers[1].user)
		updated = current_driver_api.patch(
			f"/api/livreurs/{self.drivers[1].id}/update_fcm_token/",
			{"fcm_token": previous_token},
			format="json",
		)
		self.assertEqual(updated.status_code, 200)
		self.drivers[0].refresh_from_db()
		self.drivers[1].refresh_from_db()
		self.assertIsNone(self.drivers[0].fcm_token)
		self.assertEqual(self.drivers[1].fcm_token, previous_token)

	@patch("deliveries.views.resolve_destination", return_value=(36.76, 3.07))
	@patch("deliveries.views.resolve_route", return_value=(2.5, [[3.06, 36.75], [3.07, 36.76]]))
	def test_quote_is_public_and_returns_route_geometry(self, route, destination):
		anonymous_client = APIClient()
		response = anonymous_client.post("/api/courses/quote/", {
			"destination": "Place des Martyrs, Alger",
			"client_latitude": 36.75,
			"client_longitude": 3.06,
		}, format="json")

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["proposed_price"], Decimal("125"))
		self.assertEqual(response.data["estimated_distance_km"], 2.5)
		self.assertEqual(response.data["route_geometry"], [[3.06, 36.75], [3.07, 36.76]])
		route.assert_called_once_with(36.75, 3.06, 36.76, 3.07)

	@patch("deliveries.views.resolve_destination", return_value=(36.76, 3.07))
	@patch("deliveries.views.resolve_route", return_value=(2.5, [[3.06, 36.75], [3.07, 36.76]]))
	@patch("deliveries.views.send_livreur_notification")
	def test_only_matching_vehicle_drivers_receive_search_notifications(self, send_notification, route, destination):
		for index, vehicle_type in enumerate(("voiture", "camion"), start=3):
			user = User.objects.create_user(username=f"driver{index}", password="pass")
			matching_driver = Livreur.objects.create(
				user=user,
				nom=f"Chauffeur {vehicle_type}",
				telephone=f"055500000{index + 1}",
				ville="Alger",
				vehicule=vehicle_type,
				disponible=True,
				est_en_ligne=True,
				latitude=36.751,
				longitude=3.06,
				fcm_token=f"token-{vehicle_type}",
			)
			with self.captureOnCommitCallbacks(execute=True):
				response = self.create_request(
					vehicle_type=vehicle_type,
					request_key=f"request-{vehicle_type}",
				)

			self.assertEqual(response.status_code, 201)
			course = Course.objects.get(pk=response.data["id"])
			self.assertEqual(course.vehicle_type, vehicle_type)
			self.assertEqual(
				list(CourseOffer.objects.filter(course=course).values_list("livreur_id", flat=True)),
				[matching_driver.id],
			)
			self.assertEqual(
				[call.args[0].id for call in send_notification.call_args_list],
				[matching_driver.id],
			)
			send_notification.reset_mock()

	@patch("deliveries.views.resolve_destination", return_value=(36.76, 3.07))
	@patch("deliveries.views.resolve_route", return_value=(2.5, [[3.06, 36.75], [3.07, 36.76]]))
	@patch("deliveries.views.send_livreur_notification")
	def test_request_rejects_price_below_minimum(self, send_notification, route, destination):
		response = self.create_request(99)

		self.assertEqual(response.status_code, 400)
		self.assertEqual(Course.objects.count(), 0)
		send_notification.assert_not_called()

	@patch("deliveries.views.resolve_destination", return_value=(36.76, 3.07))
	@patch("deliveries.views.resolve_route", return_value=(2.5, [[3.06, 36.75], [3.07, 36.76]]))
	@patch("deliveries.views.send_livreur_notification")
	@patch("deliveries.views.current_surcharge_percent", return_value=Decimal("15"))
	def test_request_includes_unavailable_drivers_and_records_trip_data(self, surcharge, send_notification, route, destination):
		with self.captureOnCommitCallbacks(execute=True):
			response = self.create_request()

		self.assertEqual(response.status_code, 201)
		course = Course.objects.get(pk=response.data["id"])
		self.assertEqual(course.status, "searching")
		self.assertEqual(course.livreur_id, None)
		self.assertEqual(course.proposed_price, 500)
		self.assertEqual(course.final_price, 575)
		self.assertEqual(course.estimated_distance_km, 2.5)
		self.assertEqual(CourseOffer.objects.filter(course=course).count(), 2)
		self.assertEqual(CourseEvent.objects.filter(course=course, event_type="created").count(), 1)
		self.assertEqual(send_notification.call_count, 2)
		notification_call = send_notification.call_args_list[0]
		self.assertEqual(notification_call.args[1], "رحلة جديدة")
		self.assertEqual(notification_call.args[2], "575 دج")
		self.assertEqual(notification_call.kwargs["course_id"], course.id)
		self.assertEqual(notification_call.kwargs["notification_type"], "course_offer")
		self.assertEqual(notification_call.kwargs["extra_data"]["price"], "575")
		self.assertEqual(notification_call.kwargs["extra_data"]["destination"], course.destination or "تفاصيل الرحلة")
		self.assertEqual(notification_call.kwargs["extra_data"]["pickup_address"], course.pickup_address or course.pickup_name or "موقع العميل")

	@patch("deliveries.views.resolve_destination_label", return_value="الجزائر الوسطى")
	@patch("deliveries.views.resolve_route", return_value=(2.5, [[3.06, 36.75], [3.07, 36.76]]))
	@patch("deliveries.views.send_livreur_notification")
	def test_request_accepts_destination_coordinates_from_map(self, send_notification, route, label):
		response = self.client_api.post("/api/courses/request/", {
			"destination_latitude": 36.76,
			"destination_longitude": 3.07,
			"proposed_price": 500,
			"client_latitude": 36.75,
			"client_longitude": 3.06,
			"request_key": "map-request-1",
		}, format="json")

		self.assertEqual(response.status_code, 201)
		course = Course.objects.get(pk=response.data["id"])
		self.assertEqual(course.destination_latitude, 36.76)
		self.assertEqual(course.destination_longitude, 3.07)
		self.assertEqual(course.destination, "الجزائر الوسطى")
		route.assert_called_once_with(36.75, 3.06, 36.76, 3.07)

	@patch("deliveries.views.resolve_destination", return_value=(36.76, 3.07))
	@patch("deliveries.views.resolve_route", return_value=(2.5, [[3.06, 36.75], [3.07, 36.76]]))
	@patch("deliveries.views.send_livreur_notification")
	def test_multiple_acceptances_then_single_atomic_selection(self, send_notification, route, destination):
		course_response = self.create_request()
		course_id = course_response.data["id"]

		for driver in self.drivers:
			driver_api = APIClient()
			driver_api.force_authenticate(driver.user)
			accepted = driver_api.post(f"/api/courses/{course_id}/respond/", {"response": "accepted"}, format="json")
			self.assertEqual(accepted.status_code, 200)

		selected = self.client_api.post(
			f"/api/courses/{course_id}/select_driver/",
			{"livreur_id": self.drivers[0].id},
			format="json",
		)
		self.assertEqual(selected.status_code, 200)
		self.assertEqual(selected.data["livreur"], self.drivers[0].id)
		self.assertEqual(selected.data["status"], "driver_selected")
		self.drivers[0].refresh_from_db()
		self.assertFalse(self.drivers[0].disponible)

		stale_api = APIClient()
		stale_api.force_authenticate(self.drivers[1].user)
		stale = stale_api.post(f"/api/courses/{course_id}/respond/", {"response": "accepted"}, format="json")
		self.assertEqual(stale.status_code, 409)
		self.assertEqual(CourseOffer.objects.get(course_id=course_id, livreur=self.drivers[1]).response, "withdrawn")

		cancelled = self.client_api.post(
			f"/api/courses/{course_id}/cancel/",
			{"reason": "changed_mind"},
			format="json",
		)
		self.assertEqual(cancelled.status_code, 200)
		self.drivers[0].refresh_from_db()
		self.assertFalse(self.drivers[0].disponible)

	@patch("deliveries.views.resolve_destination", return_value=(36.76, 3.07))
	@patch("deliveries.views.resolve_route", return_value=(2.5, [[3.06, 36.75], [3.07, 36.76]]))
	@patch("deliveries.views.send_livreur_notification")
	def test_client_cancellation_invalidates_old_offers(self, send_notification, route, destination):
		course_response = self.create_request()
		course_id = course_response.data["id"]
		cancelled = self.client_api.post(
			f"/api/courses/{course_id}/cancel/",
			{"reason": "changed_mind"},
			format="json",
		)
		self.assertEqual(cancelled.status_code, 200)
		self.assertEqual(cancelled.data["status"], "cancelled")

		driver_api = APIClient()
		driver_api.force_authenticate(self.drivers[0].user)
		stale = driver_api.post(f"/api/courses/{course_id}/respond/", {"response": "accepted"}, format="json")
		self.assertEqual(stale.status_code, 409)


@override_settings(
	COURSE_MIN_PRICE_DZD="100",
	COURSE_SEARCH_RADIUS_KM=40,
	COURSE_OFFER_TTL_SECONDS=60,
)
class DriverOnlineOfferTests(TestCase):
	"""Parcours livreur façon Uber : en ligne, offre chronométrée, commande récupérée."""

	def setUp(self):
		self.client_user = User.objects.create_user(username="client-uber", password="pass")
		self.client_profile = Client.objects.create(
			user=self.client_user,
			nom="Client Uber",
			telephone="0555111001",
		)
		self.client_api = APIClient()
		self.client_api.force_authenticate(self.client_user)

		user = User.objects.create_user(username="driver-uber", password="pass")
		self.driver = Livreur.objects.create(
			user=user,
			nom="Livreur Uber",
			telephone="0555111002",
			ville="Alger",
			vehicule="moto",
			disponible=False,
			est_en_ligne=False,
			latitude=36.751,
			longitude=3.06,
			fcm_token="token-uber",
		)
		self.driver_api = APIClient()
		self.driver_api.force_authenticate(user)

	def create_request(self, request_key="uber-request-1"):
		return self.client_api.post("/api/courses/request/", {
			"destination": "Place des Martyrs, Alger",
			"proposed_price": 500,
			"client_latitude": 36.75,
			"client_longitude": 3.06,
			"request_key": request_key,
			"vehicle_type": "moto",
		}, format="json")

	def set_online(self):
		return self.driver_api.patch(f"/api/livreurs/{self.driver.id}/set_online/")

	def set_offline(self):
		return self.driver_api.patch(f"/api/livreurs/{self.driver.id}/set_offline/")

	def request_with_stubs(self, request_key="uber-request-1"):
		"""Crée une demande en neutralisant les appels réseau et le push FCM."""
		with patch("deliveries.views.resolve_destination", return_value=(36.76, 3.07)), \
				patch("deliveries.views.resolve_route", return_value=(2.5, [[3.06, 36.75], [3.07, 36.76]])), \
				patch("deliveries.views.send_livreur_notification"):
			return self.create_request(request_key)

	def test_offline_driver_receives_no_offer(self):
		with patch("deliveries.views.send_livreur_notification") as send_notification:
			response = self.request_with_stubs()

		self.assertEqual(response.status_code, 201)
		self.assertEqual(CourseOffer.objects.count(), 0)
		send_notification.assert_not_called()

	def test_going_online_allows_receiving_and_accepting_offers(self):
		online = self.set_online()
		self.assertEqual(online.status_code, 200)
		self.driver.refresh_from_db()
		self.assertTrue(self.driver.est_en_ligne)
		self.assertTrue(self.driver.disponible)

		course_id = self.request_with_stubs().data["id"]
		offers = self.driver_api.get("/api/courses/offers/")
		self.assertEqual(offers.status_code, 200)
		self.assertEqual([course["id"] for course in offers.data], [course_id])

		accepted = self.driver_api.post(
			f"/api/courses/{course_id}/respond/", {"response": "accepted"}, format="json"
		)
		self.assertEqual(accepted.status_code, 200)

	def test_going_offline_withdraws_pending_offers(self):
		self.set_online()
		course_id = self.request_with_stubs().data["id"]

		offline = self.set_offline()
		self.assertEqual(offline.status_code, 200)
		self.assertEqual(offline.data["withdrawn_offers"], 1)
		self.driver.refresh_from_db()
		self.assertFalse(self.driver.est_en_ligne)
		self.assertEqual(
			CourseOffer.objects.get(course_id=course_id, livreur=self.driver).response,
			"withdrawn",
		)
		self.assertEqual(self.driver_api.get("/api/courses/offers/").data, [])

	def test_browser_driver_without_push_token_can_receive_and_accept_offers(self):
		self.set_online()
		for index, token in enumerate((None, "")):
			with self.subTest(token=token):
				Livreur.objects.filter(pk=self.driver.pk).update(fcm_token=token)
				response = self.request_with_stubs(request_key=f"browser-offer-{index}")
				self.assertEqual(response.status_code, 201)
				course_id = response.data["id"]
				offers = self.driver_api.get("/api/courses/offers/")
				self.assertEqual(offers.status_code, 200)
				self.assertEqual([course["id"] for course in offers.data], [course_id])
				accepted = self.driver_api.post(
					f"/api/courses/{course_id}/respond/", {"response": "accepted"}, format="json",
				)
				self.assertEqual(accepted.status_code, 200)
				self.assertEqual(accepted.data["status"], "driver_accepted")
				cancelled = self.client_api.post(
					f"/api/courses/{course_id}/cancel/", {"reason": "changed_mind"}, format="json",
				)
				self.assertEqual(cancelled.status_code, 200)

	def test_offline_driver_cannot_accept_an_offer(self):
		self.set_online()
		course_id = self.request_with_stubs().data["id"]
		self.set_offline()

		stale = self.driver_api.post(
			f"/api/courses/{course_id}/respond/", {"response": "accepted"}, format="json"
		)
		self.assertEqual(stale.status_code, 409)

	def test_offer_exposes_countdown_and_expires(self):
		self.set_online()
		course_id = self.request_with_stubs().data["id"]

		offered = self.driver_api.get("/api/courses/offers/").data[0]
		self.assertEqual(offered["my_offer_response"], "pending")
		self.assertGreater(offered["my_offer_expires_in"], 0)
		self.assertLessEqual(offered["my_offer_expires_in"], 60)

		CourseOffer.objects.filter(course_id=course_id).update(
			expires_at=timezone.now() - timedelta(seconds=1)
		)

		self.assertEqual(self.driver_api.get("/api/courses/offers/").data, [])
		self.assertEqual(CourseOffer.objects.get(course_id=course_id).response, "withdrawn")

		stale = self.driver_api.post(
			f"/api/courses/{course_id}/respond/", {"response": "accepted"}, format="json"
		)
		self.assertEqual(stale.status_code, 409)

	def accept_and_assign(self, course_id):
		self.driver_api.post(f"/api/courses/{course_id}/respond/", {"response": "accepted"}, format="json")
		return self.client_api.post(
			f"/api/courses/{course_id}/select_driver/",
			{"livreur_id": self.driver.id},
			format="json",
		)

	def test_driver_can_confirm_pickup_before_starting_the_delivery(self):
		self.set_online()
		course_id = self.request_with_stubs().data["id"]
		self.accept_and_assign(course_id)

		self.assertEqual(self.driver_api.post(f"/api/courses/{course_id}/enroute/").status_code, 200)
		self.assertEqual(self.driver_api.post(f"/api/courses/{course_id}/arrive/").status_code, 200)

		pickup = self.driver_api.post(f"/api/courses/{course_id}/pickup/")
		self.assertEqual(pickup.status_code, 200)
		self.assertEqual(pickup.data["status"], "picked_up")
		self.assertIsNotNone(pickup.data["picked_up_at"])

		started = self.driver_api.post(f"/api/courses/{course_id}/start/")
		self.assertEqual(started.status_code, 200)
		self.assertEqual(started.data["status"], "in_progress")

	def test_pickup_is_rejected_before_the_driver_arrives(self):
		self.set_online()
		course_id = self.request_with_stubs().data["id"]
		self.accept_and_assign(course_id)

		too_early = self.driver_api.post(f"/api/courses/{course_id}/pickup/")
		self.assertEqual(too_early.status_code, 409)

	def test_finishing_a_course_sends_the_driver_back_online(self):
		self.set_online()
		course_id = self.request_with_stubs().data["id"]
		self.accept_and_assign(course_id)
		self.driver_api.post(f"/api/courses/{course_id}/arrive/")
		self.driver_api.post(f"/api/courses/{course_id}/pickup/")
		self.driver_api.post(f"/api/courses/{course_id}/start/")

		finished = self.driver_api.patch(f"/api/courses/{course_id}/finish/")
		self.assertEqual(finished.status_code, 200)
		self.assertTrue(finished.data["active"] is False)
		self.driver.refresh_from_db()
		self.assertTrue(self.driver.est_en_ligne)
		self.assertTrue(self.driver.disponible)

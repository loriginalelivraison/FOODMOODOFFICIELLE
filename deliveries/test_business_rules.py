from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .course_services import broadcast_course_offers, dispatch_expired_courses
from .models import Client, CommentaireClient, CommentaireLivreur, Course, CourseOffer, DemandeLivraison, Livreur


class BusinessRulesTests(TestCase):
    def setUp(self):
        self.customer = Client.objects.create(
            user=User.objects.create_user("rules-client"), nom="Client", telephone="0555001001"
        )
        self.other_customer = Client.objects.create(
            user=User.objects.create_user("rules-other"), nom="Autre", telephone="0555001002"
        )
        self.driver = Livreur.objects.create(
            user=User.objects.create_user("rules-driver"), nom="Chauffeur", telephone="0555001003",
            ville="Alger", vehicule="voiture", est_en_ligne=True, disponible=True,
            latitude=36.75, longitude=3.06,
        )
        self.customer_api = APIClient()
        self.customer_api.force_authenticate(self.customer.user)
        self.driver_api = APIClient()
        self.driver_api.force_authenticate(self.driver.user)
        self.other_api = APIClient()
        self.other_api.force_authenticate(self.other_customer.user)
        self.payload = {
            "destination": "Alger", "destination_latitude": 36.8, "destination_longitude": 3.1,
            "client_latitude": 36.75, "client_longitude": 3.06, "proposed_price": "500",
            "vehicle_type": "voiture", "request_key": "rules-request",
        }
        route = patch("deliveries.views.resolve_route", return_value=(5.0, [[3.06, 36.75], [3.1, 36.8]]))
        route.start()
        self.addCleanup(route.stop)

    def make_course(self, **kwargs):
        values = {"client": self.customer, "livreur": self.driver,
                  "status": "in_progress", "active": True, "client_confirmed": True,
                  "availability_before_course": True}
        values.update(kwargs)
        return Course.objects.create(**values)

    def test_delivery_purchase_details_are_saved_for_driver(self):
        response = self.customer_api.post("/api/courses/request/", {
            **self.payload,
            "vehicle_type": "moto",
            "purchase_details": "  خبز وحليب  ",
        }, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["purchase_details"], "خبز وحليب")
        self.assertEqual(Course.objects.get(pk=response.data["id"]).purchase_details, "خبز وحليب")

    def test_second_active_request_rejected_but_original_can_be_retried(self):
        first = self.customer_api.post("/api/courses/request/", self.payload, format="json")
        self.assertEqual(first.status_code, 201)
        repeated = self.customer_api.post("/api/courses/request/", self.payload, format="json")
        self.assertEqual(repeated.status_code, 200)
        self.assertEqual(repeated.data["id"], first.data["id"])
        different = self.customer_api.post("/api/courses/request/", {
            **self.payload, "request_key": "second-request",
        }, format="json")
        self.assertEqual(different.status_code, 409)
        self.assertEqual(int(different.data["course_id"]), first.data["id"])
        direct = self.customer_api.post("/api/courses/", {
            "client": self.customer.id, "livreur": self.driver.id,
        }, format="json")
        self.assertEqual(direct.status_code, 409)
        self.assertEqual(Course.objects.count(), 1)

    def test_incomplete_or_invalid_coordinates_rejected_on_quote_and_request(self):
        invalid_values = (
            {"destination_longitude": None}, {"destination_latitude": "oops"},
            {"pickup_latitude": 36.7}, {"pickup_longitude": 3.0},
            {"pickup_latitude": 99, "pickup_longitude": 3.0},
            {"client_latitude": "NaN"}, {"destination_longitude": "Infinity"},
        )
        for url in ("/api/courses/quote/", "/api/courses/request/"):
            for invalid in invalid_values:
                with self.subTest(url=url, invalid=invalid):
                    response = self.customer_api.post(url, {**self.payload, **invalid}, format="json")
                    self.assertEqual(response.status_code, 400)
        self.assertFalse(Course.objects.exists())

    def test_extreme_price_rejected_without_creating_course(self):
        for price in ("NaN", "Infinity", "99999999999999999", "500.123", "1e99999999"):
            with self.subTest(price=price):
                response = self.customer_api.post("/api/courses/request/", {
                    **self.payload, "proposed_price": price,
                }, format="json")
                self.assertEqual(response.status_code, 400)
        self.assertFalse(Course.objects.exists())

    def test_gps_does_not_override_offline_or_busy_availability(self):
        for online in (False, True):
            self.driver.est_en_ligne = online
            self.driver.disponible = False
            self.driver.save()
            response = self.driver_api.patch(f"/api/livreurs/{self.driver.id}/update_position/", {
                "latitude": 36.8, "longitude": 3.1,
            }, format="json")
            self.assertEqual(response.status_code, 200)
            self.driver.refresh_from_db()
            self.assertFalse(self.driver.disponible)
            self.assertEqual(self.driver.est_en_ligne, online)
        for invalid in ({"latitude": 99, "longitude": 3}, {"latitude": "NaN", "longitude": 3}):
            self.assertEqual(self.driver_api.patch(
                f"/api/livreurs/{self.driver.id}/update_position/", invalid, format="json"
            ).status_code, 400)

    def test_offline_choice_survives_course_finish_or_cancel(self):
        for action in ("finish", "cancel"):
            self.driver.est_en_ligne = True
            self.driver.save()
            course = self.make_course()
            self.assertEqual(self.driver_api.patch(
                f"/api/livreurs/{self.driver.id}/set_offline/"
            ).status_code, 200)
            if action == "finish":
                response = self.driver_api.patch(f"/api/courses/{course.id}/finish/")
            else:
                response = self.driver_api.post(f"/api/courses/{course.id}/cancel/", {
                    "reason": "vehicle_issue",
                }, format="json")
            self.assertEqual(response.status_code, 200)
            self.driver.refresh_from_db()
            self.assertFalse(self.driver.est_en_ligne)
            self.assertFalse(self.driver.disponible)

    def test_unassigned_and_unstarted_courses_cannot_award_points(self):
        for state, driver in (("searching", None), ("driver_selected", self.driver)):
            course = self.make_course(status=state, livreur=driver)
            response = self.customer_api.patch(f"/api/courses/{course.id}/finish/")
            self.assertEqual(response.status_code, 409)
            course.refresh_from_db()
            self.assertTrue(course.active)
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.points, 0)

    def test_going_offline_withdraws_acceptance_and_reopens_search(self):
        course = self.make_course(livreur=None, status="driver_accepted")
        offer = CourseOffer.objects.create(course=course, livreur=self.driver, response="accepted")
        response = self.driver_api.patch(f"/api/livreurs/{self.driver.id}/set_offline/")
        self.assertEqual(response.status_code, 200)
        offer.refresh_from_db()
        course.refresh_from_db()
        self.assertEqual(offer.response, "withdrawn")
        self.assertEqual(course.status, "searching")

    def test_rejection_preserves_another_drivers_acceptance(self):
        another = Livreur.objects.create(
            user=User.objects.create_user("rules-driver2"), nom="Autre chauffeur", vehicule="voiture",
            est_en_ligne=True, telephone="0555001004", ville="Alger",
        )
        course = self.make_course(livreur=None, status="driver_accepted")
        CourseOffer.objects.create(course=course, livreur=another, response="accepted")
        CourseOffer.objects.create(course=course, livreur=self.driver)
        response = self.driver_api.post(f"/api/courses/{course.id}/respond/", {
            "response": "rejected",
        }, format="json")
        self.assertEqual(response.status_code, 200)
        course.refresh_from_db()
        self.assertEqual(course.status, "driver_accepted")
        self.assertEqual(course.broadcast_round, 1)

    def test_driver_price_is_shown_to_client_and_used_when_selected(self):
        course = self.make_course(livreur=None, status="searching", client_confirmed=False,
                                  final_price=Decimal("500.00"))
        offer = CourseOffer.objects.create(course=course, livreur=self.driver)
        for invalid in ("99", "NaN", "100.123", "999999999"):
            with self.subTest(invalid=invalid):
                response = self.driver_api.post(f"/api/courses/{course.id}/respond/", {
                    "response": "accepted", "offered_price": invalid,
                }, format="json")
                self.assertEqual(response.status_code, 400)
                offer.refresh_from_db()
                self.assertEqual(offer.response, "pending")

        accepted = self.driver_api.post(f"/api/courses/{course.id}/respond/", {
            "response": "accepted", "offered_price": "650.00",
        }, format="json")
        self.assertEqual(accepted.status_code, 200)
        offer.refresh_from_db()
        self.assertEqual(offer.offered_price, Decimal("650.00"))
        self.assertEqual(self.driver_api.get(f"/api/courses/{course.id}/").data["my_offer_price"], Decimal("650.00"))
        client_view = self.customer_api.get(f"/api/courses/{course.id}/")
        self.assertEqual(client_view.data["accepted_drivers"][0]["offered_price"], Decimal("650.00"))
        selected = self.customer_api.post(f"/api/courses/{course.id}/select_driver/", {
            "livreur_id": self.driver.id,
        }, format="json")
        self.assertEqual(selected.status_code, 200)
        self.assertEqual(Decimal(selected.data["final_price"]), Decimal("650.00"))

    @override_settings(COURSE_OFFER_MAX_ROUNDS=2)
    def test_rejection_does_not_exceed_dispatch_round_limit(self):
        course = self.make_course(livreur=None, status="searching", broadcast_round=2)
        CourseOffer.objects.create(course=course, livreur=self.driver)
        self.driver_api.post(f"/api/courses/{course.id}/respond/", {"response": "rejected"}, format="json")
        course.refresh_from_db()
        self.assertEqual(course.broadcast_round, 2)

    def test_selected_driver_is_withdrawn_from_other_requests(self):
        selected = self.make_course(livreur=None, status="driver_accepted")
        other = self.make_course(client=self.other_customer, livreur=None, status="driver_accepted")
        for course in (selected, other):
            CourseOffer.objects.create(course=course, livreur=self.driver, response="accepted")
        response = self.customer_api.post(f"/api/courses/{selected.id}/select_driver/", {
            "livreur_id": self.driver.id,
        }, format="json")
        self.assertEqual(response.status_code, 200)
        other.refresh_from_db()
        self.assertEqual(other.status, "searching")
        self.assertEqual(other.offers.get().response, "withdrawn")

    @override_settings(COURSE_OFFER_ROUND_DELAY_SECONDS=15)
    def test_empty_first_dispatch_can_retry_when_driver_comes_online(self):
        self.driver.est_en_ligne = False
        self.driver.save()
        course = self.make_course(livreur=None, status="searching", final_price=500,
                                  client_latitude=36.75, client_longitude=3.06)
        now = timezone.now()
        self.assertEqual(broadcast_course_offers(course, now=now), [])
        course.refresh_from_db()
        self.assertEqual(course.last_offer_at, now)
        self.driver.est_en_ligne = True
        self.driver.save()
        self.assertEqual(dispatch_expired_courses(now=now + timedelta(seconds=16)), [course.id])
        self.assertEqual(course.offers.count(), 1)
        # Repeating the same maintenance pass cannot duplicate the offer.
        self.assertEqual(dispatch_expired_courses(now=now + timedelta(seconds=16)), [])

    def test_legacy_requests_are_private_and_cannot_be_modified_by_customers(self):
        request = DemandeLivraison.objects.create(
            client_nom=self.customer.nom, client_telephone=self.customer.telephone,
            livreur=self.driver, adresse_depart="A", adresse_arrivee="B", tracking_code="private",
        )
        url = f"/api/demandes/{request.id}/"
        self.assertEqual(APIClient().get(url).status_code, 401)
        self.assertEqual(self.other_api.get(url).status_code, 404)
        self.assertEqual(self.customer_api.get(url).status_code, 200)
        self.assertEqual(self.driver_api.get(url).status_code, 200)
        self.assertEqual(self.customer_api.patch(url, {"statut": "livree"}, format="json").status_code, 403)
        self.assertEqual(self.customer_api.delete(url).status_code, 403)

    def test_legacy_request_uses_authenticated_identity_and_unique_tracking(self):
        for _ in range(2):
            response = self.customer_api.post("/api/demandes/", {
                "client_nom": "Faux", "client_telephone": self.other_customer.telephone,
                "adresse_depart": "A", "adresse_arrivee": "B", "statut": "livree",
            }, format="json")
            self.assertEqual(response.status_code, 201)
            self.assertEqual(response.data["client_nom"], self.customer.nom)
            self.assertEqual(response.data["client_telephone"], self.customer.telephone)
            self.assertEqual(response.data["statut"], "en_attente")
        self.assertEqual(DemandeLivraison.objects.values("tracking_code").distinct().count(), 2)

    def test_reviews_require_completed_course_and_valid_rating(self):
        payload = {"livreur": self.driver.id, "message": "Merci", "note": 5, "nom_client": "Faux"}
        self.assertEqual(APIClient().post("/api/commentaires-livreurs/", payload).status_code, 401)
        self.assertEqual(self.customer_api.post("/api/commentaires-livreurs/", payload).status_code, 403)
        self.make_course(status="completed", active=False)
        response = self.customer_api.post("/api/commentaires-livreurs/", payload)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["nom_client"], self.customer.nom)
        self.driver.refresh_from_db()
        self.assertEqual(self.driver.note, 5)
        for note in (0, 6):
            self.assertEqual(self.customer_api.post("/api/commentaires-livreurs/", {
                **payload, "note": note,
            }).status_code, 400)
        self.assertEqual(self.other_api.delete(f"/api/commentaires-livreurs/{response.data['id']}/").status_code, 403)

    def test_driver_can_review_customer_once_after_completed_course(self):
        course = self.make_course()
        url = f"/api/courses/{course.id}/review-client/"
        payload = {"note": 4, "message": "Client ponctuel", "client": self.other_customer.id}
        self.assertEqual(APIClient().post(url, payload, format="json").status_code, 401)
        self.assertEqual(self.customer_api.post(url, payload, format="json").status_code, 403)
        self.assertEqual(self.driver_api.post(url, payload, format="json").status_code, 409)
        course.status = "completed"
        course.active = False
        course.save(update_fields=["status", "active"])
        other_driver = Livreur.objects.create(
            user=User.objects.create_user("rules-review-driver"), nom="Autre chauffeur",
            telephone="0555001099", ville="Alger", vehicule="voiture",
        )
        other_driver_api = APIClient()
        other_driver_api.force_authenticate(other_driver.user)
        self.assertEqual(other_driver_api.post(url, payload, format="json").status_code, 403)
        for note in (0, 6):
            self.assertEqual(self.driver_api.post(url, {**payload, "note": note}, format="json").status_code, 400)
        response = self.driver_api.post(url, payload, format="json")
        self.assertEqual(response.status_code, 201)
        review = CommentaireClient.objects.get(course=course)
        self.assertEqual(review.client_id, self.customer.id)
        self.assertEqual(review.livreur_id, self.driver.id)
        self.assertEqual(review.note, 4)
        self.assertEqual(self.driver_api.post(url, payload, format="json").status_code, 409)
        self.assertTrue(self.driver_api.get(f"/api/courses/{course.id}/").data["client_review_submitted"])

    def test_customer_reviews_and_photo_only_visible_to_assigned_driver(self):
        previous = self.make_course(status="completed", active=False)
        CommentaireClient.objects.create(course=previous, client=self.customer, livreur=self.driver,
                                         note=5, message="Très bien")
        self.customer.photo = "clients/profile.jpg"
        self.customer.save(update_fields=["photo"])
        course = self.make_course(livreur=None, status="driver_accepted", client_confirmed=False)
        CourseOffer.objects.create(course=course, livreur=self.driver, response="accepted")
        url = f"/api/courses/{course.id}/"
        candidate = self.driver_api.get(url).data
        self.assertIsNone(candidate["client_name"])
        self.assertIsNone(candidate["client_photo"])
        self.assertIsNone(candidate["client_rating"])
        self.assertIsNone(candidate["client_review_count"])
        self.assertEqual(candidate["client_reviews"], [])
        course.livreur = self.driver
        course.client_confirmed = True
        course.status = "driver_selected"
        course.save(update_fields=["livreur", "client_confirmed", "status"])
        assigned = self.driver_api.get(url).data
        self.assertEqual(assigned["client_name"], self.customer.nom)
        self.assertIn("clients/profile.jpg", assigned["client_photo"])
        self.assertEqual(assigned["client_rating"], 5)
        self.assertEqual(assigned["client_review_count"], 1)
        self.assertEqual(assigned["client_reviews"][0]["message"], "Très bien")
        self.assertEqual(self.other_api.get(url).status_code, 404)
        course.active = False
        course.status = "completed"
        course.save(update_fields=["active", "status"])
        completed = self.driver_api.get(url).data
        self.assertIsNone(completed["client_photo"])
        self.assertEqual(completed["client_reviews"], [])

    def test_profile_patch_cannot_change_login_identity_or_driver_availability(self):
        response = self.customer_api.patch(f"/api/clients/{self.customer.id}/", {
            "telephone": "0555009999", "points": 100,
        }, format="json")
        self.assertEqual(response.status_code, 200)
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.telephone, "0555001001")
        self.assertEqual(self.customer.points, 0)
        response = self.driver_api.patch(f"/api/livreurs/{self.driver.id}/", {
            "est_en_ligne": False, "disponible": False, "latitude": 99,
        }, format="json")
        self.assertEqual(response.status_code, 200)
        self.driver.refresh_from_db()
        self.assertTrue(self.driver.est_en_ligne)
        self.assertTrue(self.driver.disponible)
        self.assertEqual(self.driver.latitude, 36.75)

    def test_accounts_with_active_courses_cannot_be_deleted(self):
        self.make_course()
        self.assertEqual(self.customer_api.delete(f"/api/clients/{self.customer.id}/").status_code, 409)
        self.assertEqual(self.driver_api.delete(f"/api/livreurs/{self.driver.id}/").status_code, 409)

    def test_deleting_customer_also_removes_login(self):
        user_id = self.customer.user_id
        response = self.customer_api.delete(f"/api/clients/{self.customer.id}/")
        self.assertEqual(response.status_code, 204)
        self.assertFalse(User.objects.filter(pk=user_id).exists())

    def test_driver_registration_persists_optional_gps_and_starts_online(self):
        response = APIClient().post("/api/livreurs/register/", {
            "nom": "Nouveau", "telephone": "0555999001", "password": "Transport!Safe48",
            "ville": "Alger", "vehicule": "moto", "latitude": 36.7, "longitude": 3.0,
        }, format="json")
        self.assertEqual(response.status_code, 201)
        driver = Livreur.objects.get(pk=response.data["id"])
        self.assertEqual(driver.latitude, 36.7)
        self.assertEqual(driver.longitude, 3.0)
        self.assertTrue(driver.est_en_ligne)
        self.assertTrue(driver.disponible)

    def test_invalid_registration_never_leaves_orphan_login(self):
        valid = {"nom": "Nouveau", "telephone": "0555999001", "password": "Transport!Safe48",
                 "ville": "Alger", "vehicule": "moto"}
        for invalid in ({"vehicule": "avion"}, {"ville": ""}, {"nom": " "},
                        {"password": "123"}, {"latitude": 36.7}, {"telephone": "oops"}):
            response = APIClient().post("/api/livreurs/register/", {**valid, **invalid}, format="json")
            self.assertEqual(response.status_code, 400)
            self.assertFalse(User.objects.filter(username="0555999001").exists())

    def test_customer_contact_only_shared_with_assigned_driver_during_course(self):
        course = self.make_course(livreur=None, status="driver_accepted", client_confirmed=False)
        CourseOffer.objects.create(course=course, livreur=self.driver, response="accepted")
        url = f"/api/courses/{course.id}/"
        candidate = self.driver_api.get(url)
        self.assertIsNone(candidate.data["client_name"])
        self.assertIsNone(candidate.data["client_phone"])
        course.livreur = self.driver
        course.client_confirmed = True
        course.status = "driver_selected"
        course.save()
        assigned = self.driver_api.get(url)
        self.assertEqual(assigned.data["client_name"], self.customer.nom)
        self.assertEqual(assigned.data["client_phone"], self.customer.telephone)
        self.assertEqual(self.other_api.get(url).status_code, 404)
        course.active = False
        course.status = "completed"
        course.save()
        completed = self.driver_api.get(url)
        self.assertIsNone(completed.data["client_name"])
        self.assertIsNone(completed.data["client_phone"])


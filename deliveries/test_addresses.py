from unittest.mock import patch

from django.test import SimpleTestCase
from rest_framework.test import APIClient

from .course_services import resolve_destination_label


class CourseAddressTests(SimpleTestCase):
    @patch("deliveries.views.resolve_destination_label", return_value="Rue Didouche Mourad, Alger")
    def test_address_is_available_before_login(self, resolve):
        response = APIClient().get("/api/courses/address/", {
            "latitude": "36.7538", "longitude": "3.0588",
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["address"], "Rue Didouche Mourad, Alger")
        resolve.assert_called_once_with(36.7538, 3.0588, full_address=True)

    @patch("deliveries.views.resolve_destination_label")
    def test_invalid_coordinates_do_not_call_geocoder(self, resolve):
        for params in ({}, {"latitude": "invalid", "longitude": 3},
                       {"latitude": "nan", "longitude": 3},
                       {"latitude": 91, "longitude": 3},
                       {"latitude": 36, "longitude": 181}):
            with self.subTest(params=params):
                self.assertEqual(APIClient().get("/api/courses/address/", params).status_code, 400)
        resolve.assert_not_called()

    @patch("deliveries.views.resolve_destination_label", return_value=None)
    def test_unavailable_address_is_reported(self, resolve):
        response = APIClient().get("/api/courses/address/", {"latitude": 36, "longitude": 3})
        self.assertEqual(response.status_code, 422)

    @patch("deliveries.course_services.requests.get")
    def test_full_address_keeps_existing_label_behavior(self, get):
        get.return_value.json.return_value = {
            "name": "Place des Martyrs", "display_name": "Place des Martyrs, Alger, Algérie",
        }
        self.assertEqual(resolve_destination_label(36, 3), "Place des Martyrs")
        self.assertEqual(resolve_destination_label(36, 3, full_address=True),
                         "Place des Martyrs, Alger, Algérie")

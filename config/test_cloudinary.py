import os
import runpy
from pathlib import Path
from unittest.mock import patch

from django.test import SimpleTestCase


class CloudinaryConfigurationTests(SimpleTestCase):
    def read_settings(self, environment):
        # Load settings without local credentials or changing the running SDK.
        with patch.dict(os.environ, environment, clear=True), \
                patch("dotenv.load_dotenv"), patch("cloudinary.config") as configure:
            loaded = runpy.run_path(str(Path(__file__).with_name("settings.py")))
        return loaded["CLOUDINARY_STORAGE"], configure.call_args.kwargs

    def test_cloudinary_url_credentials_are_not_erased(self):
        storage, sdk = self.read_settings({
            "CLOUDINARY_URL": "cloudinary://test-key:test-secret@url-cloud",
            "CLOUDINARY_CLOUD_NAME": "",
            "CLOUDINARY_API_KEY": "",
            "CLOUDINARY_API_SECRET": "",
        })
        self.assertEqual(storage, {
            "CLOUD_NAME": "url-cloud", "API_KEY": "test-key", "API_SECRET": "test-secret",
        })
        self.assertEqual(sdk["cloud_name"], "url-cloud")
        self.assertTrue(sdk["secure"])

    def test_separate_credentials_are_supported(self):
        storage, sdk = self.read_settings({
            "CLOUDINARY_CLOUD_NAME": "explicit-cloud",
            "CLOUDINARY_API_KEY": "explicit-key",
            "CLOUDINARY_API_SECRET": "explicit-secret",
        })
        self.assertEqual(storage["CLOUD_NAME"], "explicit-cloud")
        self.assertEqual(sdk["api_key"], "explicit-key")
        self.assertEqual(sdk["api_secret"], "explicit-secret")

    def test_missing_credentials_do_not_load_local_secrets(self):
        storage, sdk = self.read_settings({})
        self.assertEqual(storage, {"CLOUD_NAME": "", "API_KEY": "", "API_SECRET": ""})
        self.assertEqual(sdk["cloud_name"], "")

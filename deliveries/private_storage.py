import uuid
import os
import io
import time
from pathlib import Path
import cloudinary.api
import cloudinary.uploader
import cloudinary.utils
import requests

from django.conf import settings
from django.core.files.base import File
from django.core.files.storage import FileSystemStorage
from django.utils.deconstruct import deconstructible


@deconstructible
class PrivateDocumentStorage(FileSystemStorage):
    """Authenticated Cloudinary assets in production, private files locally.

    Downloads pass through the API after its permission checks. Neither public
    delivery URLs nor temporary signed URLs are returned to a browser.
    """

    def __init__(self):
        super().__init__(file_permissions_mode=0o600, directory_permissions_mode=0o700)

    @property
    def base_location(self):
        return settings.PRIVATE_DOCUMENT_ROOT

    @property
    def location(self):
        return os.path.abspath(self.base_location)

    @property
    def use_cloudinary(self):
        return settings.PRIVATE_DOCUMENT_BACKEND == "cloudinary"

    def _save(self, name, content):
        if not self.use_cloudinary:
            return super()._save(name, content)
        # Django generates OS-native paths; Cloudinary IDs require forward slashes.
        public_id, image_format = name.replace("\\", "/").rsplit(".", 1)
        result = cloudinary.uploader.upload(
            content, public_id=public_id, format=image_format,
            resource_type="image", type="authenticated", overwrite=False,
        )
        if result.get("type") != "authenticated":
            raise OSError("Private upload could not be confirmed")
        return f"{result['public_id']}.{result['format']}"

    def get_available_name(self, name, max_length=None):
        if not self.use_cloudinary:
            return super().get_available_name(name, max_length=max_length)
        # UUID filenames and overwrite=False prevent collisions without an
        # additional Admin API request on every upload.
        return name

    def _open(self, name, mode="rb"):
        if not self.use_cloudinary:
            return super()._open(name, mode)
        public_id, image_format = name.rsplit(".", 1)
        url = cloudinary.utils.private_download_url(
            public_id, image_format, type="authenticated", resource_type="image",
            expires_at=int(time.time()) + 60,
        )
        buffer = io.BytesIO()
        try:
            with requests.get(url, stream=True, timeout=20) as response:
                response.raise_for_status()
                for chunk in response.iter_content(65536):
                    buffer.write(chunk)
                    if buffer.tell() > 6 * 1024 * 1024:
                        raise OSError("Private download exceeds the allowed size")
        except requests.RequestException:
            # Signed URLs contain credentials: do not include upstream errors.
            raise OSError("Private document is temporarily unavailable") from None
        buffer.seek(0)
        return File(buffer, name=name)

    def delete(self, name):
        if not self.use_cloudinary:
            return super().delete(name)
        if name:
            cloudinary.uploader.destroy(name.rsplit(".", 1)[0], resource_type="image",
                                        type="authenticated", invalidate=True)

    def exists(self, name):
        if not self.use_cloudinary:
            return super().exists(name)
        try:
            cloudinary.api.resource(name.rsplit(".", 1)[0], resource_type="image", type="authenticated")
            return True
        except cloudinary.exceptions.NotFound:
            return False

    def path(self, name):
        if self.use_cloudinary:
            raise NotImplementedError("Cloudinary documents have no local path")
        return super().path(name)

    def url(self, name):
        raise ValueError("Private documents require authenticated access")


def document_path(instance, filename):
    return f"drivers/{instance.livreur_id}/{uuid.uuid4().hex}{Path(filename).suffix.lower()}"

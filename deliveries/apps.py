from django.apps import AppConfig


class DeliveriesConfig(AppConfig):
    name = 'deliveries'

    def ready(self):
        from . import signals  # noqa: F401

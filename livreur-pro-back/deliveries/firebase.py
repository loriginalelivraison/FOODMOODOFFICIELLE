import os
import firebase_admin

from firebase_admin import credentials, messaging
from django.conf import settings


def init_firebase():
    if firebase_admin._apps:
        return

    path = os.path.join(settings.BASE_DIR, "firebase-service-account.json")
    cred = credentials.Certificate(path)
    firebase_admin.initialize_app(cred)


def send_livreur_notification(livreur, title, body):
    if not livreur.fcm_token:
        return False

    init_firebase()

    message = messaging.Message(
        notification=messaging.Notification(
            title=title,
            body=body,
        ),
        token=livreur.fcm_token,
    )

    messaging.send(message)
    return True
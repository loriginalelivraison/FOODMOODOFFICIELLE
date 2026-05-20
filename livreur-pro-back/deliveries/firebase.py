import os
import json
import firebase_admin

from firebase_admin import credentials, messaging
from django.conf import settings


def init_firebase():
    if firebase_admin._apps:
        return

    firebase_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")

    if firebase_json:
        cred = credentials.Certificate(json.loads(firebase_json))
    else:
        path = os.path.join(settings.BASE_DIR, "firebase-service-account.json")
        cred = credentials.Certificate(path)

    firebase_admin.initialize_app(cred)


def send_livreur_notification(livreur, title, body):
    if not livreur.fcm_token:
        print("AUCUN FCM TOKEN POUR CE LIVREUR")
        return False

    try:
        init_firebase()

        message = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=body,
            ),
            android=messaging.AndroidConfig(priority="high"),
            token=livreur.fcm_token,
        )

        response = messaging.send(message)
        print("FCM envoyé avec succès :", response)
        return True

    except Exception as e:
        print("ERREUR ENVOI FCM :", str(e))
        return False
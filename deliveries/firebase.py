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
        print("AUCUN FCM TOKEN POUR CE LIVREUR")
        return False

    init_firebase()

    message = messaging.Message(
        notification=messaging.Notification(
            title=title,
            body=body,
        ),
        token=livreur.fcm_token,
    )

    try:
        response = messaging.send(message)
        print("FCM envoyé avec succès :", response)
        return True
    except Exception as e:
        print("ERREUR ENVOI FCM :", str(e))
        return False
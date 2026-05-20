import os
import json
import base64
import firebase_admin

from firebase_admin import credentials, messaging


def init_firebase():
    if firebase_admin._apps:
        return

    firebase_b64 = os.environ.get("FIREBASE_SERVICE_ACCOUNT_B64")

    if not firebase_b64:
        raise Exception("FIREBASE_SERVICE_ACCOUNT_B64 manquant")

    firebase_json = base64.b64decode(firebase_b64).decode("utf-8")

    cred = credentials.Certificate(json.loads(firebase_json))

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
            android=messaging.AndroidConfig(
                priority="high",
            ),
            token=livreur.fcm_token,
        )

        response = messaging.send(message)

        print("FCM envoyé avec succès :", response)

        return True

    except Exception as e:
        print("ERREUR ENVOI FCM :", str(e))
        return False
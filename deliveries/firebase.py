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


def send_livreur_notification(livreur, title, body, course_id=None, notification_type="course_accepted", extra_data=None):
    if not livreur.fcm_token:
        print("AUCUN FCM TOKEN POUR CE LIVREUR")
        return False

    try:
        init_firebase()

        message = messaging.Message(
            data={
                "type": notification_type,
                "title": title,
                "body": body,
                **({"course_id": str(course_id)} if course_id is not None else {}),
                **{key: str(value) for key, value in (extra_data or {}).items()},
            },
            android=messaging.AndroidConfig(
                priority="high",
            ),
            apns=messaging.APNSConfig(
                headers={"apns-priority": "10"},
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(
                        alert=messaging.ApsAlert(title=title, body=body),
                        sound="default",
                        category="COURSE_OFFER" if notification_type == "course_offer" else None,
                    ),
                ),
            ),
            token=livreur.fcm_token,
        )

        response = messaging.send(message)

        print("FCM envoyé avec succès :", response)

        return True

    except Exception as e:
        print("ERREUR ENVOI FCM :", str(e))
        return False
import os
import json
import base64
import firebase_admin

from firebase_admin import credentials, messaging
from .models import Client, Livreur


def save_fcm_token(account, token):
    if token:
        Livreur.objects.filter(fcm_token=token).update(fcm_token=None)
        Client.objects.filter(fcm_token=token).update(fcm_token=None)
    account.fcm_token = token
    account.save(update_fields=["fcm_token"])


def send_client_notification(client, title, body, **kwargs):
    return send_livreur_notification(client, title, body, recipient_role="client", **kwargs)


def init_firebase():
    if firebase_admin._apps:
        return

    firebase_b64 = os.environ.get("FIREBASE_SERVICE_ACCOUNT_B64")

    if not firebase_b64:
        raise Exception("FIREBASE_SERVICE_ACCOUNT_B64 manquant")

    firebase_json = base64.b64decode(firebase_b64).decode("utf-8")

    cred = credentials.Certificate(json.loads(firebase_json))

    firebase_admin.initialize_app(cred)


def send_livreur_notification(livreur, title, body, course_id=None, notification_type="course_accepted", extra_data=None, recipient_role="livreur"):
    if not livreur.fcm_token:
        print("AUCUN FCM TOKEN POUR CE DESTINATAIRE")
        return False

    try:
        init_firebase()
        event_id = (extra_data or {}).get("event_id") or f"{recipient_role}:{livreur.id}:{notification_type}:{course_id}:{(extra_data or {}).get('round', 1)}"

        message = messaging.Message(
            data={
                "type": notification_type,
                "title": title,
                "body": body,
                "recipient_role": recipient_role,
                "account_id": str(livreur.id),
                "event_id": event_id,
                **({"course_id": str(course_id)} if course_id is not None else {}),
                **{key: str(value) for key, value in (extra_data or {}).items()},
            },
            android=messaging.AndroidConfig(
                priority="high",
            ),
            apns=messaging.APNSConfig(
                headers={"apns-priority": "10", "apns-collapse-id": event_id if recipient_role == "client" else f"course-{course_id}"},
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(
                        alert=messaging.ApsAlert(title=title, body=body),
                        sound="winrak_notification.wav",
                        category="COURSE_OFFER" if notification_type == "course_offer" else "COURSE_EVENT",
                        thread_id=f"course-{course_id}",
                    ),
                ),
            ),
            token=livreur.fcm_token,
        )

        response = messaging.send(message)

        print("FCM envoyé avec succès :", response)

        return True

    except messaging.UnregisteredError:
        type(livreur).objects.filter(pk=livreur.pk, fcm_token=livreur.fcm_token).update(fcm_token=None)
        return False
    except Exception:
        print("ERREUR ENVOI FCM")
        return False

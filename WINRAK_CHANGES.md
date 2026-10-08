# WinRak — modifications et déploiement

## Comportement livré

- Annulation atomique, retrait des offres et notification du destinataire après validation de la transaction. Une répétition de la requête ne crée pas de second événement. Message arabe affiché six secondes avant le retour à l’accueil, avec retour immédiat possible par bouton. Les écritures GPS ne peuvent plus rétablir une ancienne valeur de `active` après une annulation. Le mobile déclenche une actualisation à réception du push ; le navigateur conserve le repli par interrogation périodique de l’API (quatre à cinq secondes sur les écrans de suivi).
- Le rôle Client est vérifié dans React et sur les points d’entrée Django de réservation, y compris la réservation directe existante et l’ancien point d’entrée `demandes`. Les tarifs, les itinéraires, les offres multiples et les étapes de livraison restent pris en charge.
- Les marqueurs affichent les informations disponibles sans proposer un suivi individuel sans réservation. Les coordonnées invalides et les chauffeurs hors ligne sont filtrés. Le téléphone est réservé au propriétaire du profil et au client ayant confirmé son chauffeur pour une course active. Le sérialiseur chauffeur en double, qui annulait les protections, a été supprimé.
- Accueil chauffeur distinct de « Mon compte » via `?section=account`, résumé des demandes, état vide, récompenses et carte à la demande. Compte organisé en informations, véhicule, documents et paramètres ; rôle et véhicule visibles. Navigation mobile corrigée en RTL.
- Permis et photo du véhicule : JPEG/PNG réels, 5 Mo maximum, noms aléatoires, statut absent/en revue/vérifié/refusé. Chaque remplacement retourne en revue. Consultation réservée au propriétaire et aux personnes ayant la permission de consulter les documents ; validation dans l’administration Django. Aucun numéro de permis ni URL de document n’est publié. Les comptes existants restent utilisables sans documents.
- Documents persistants sur le Cloudinary déjà utilisé par le projet, avec `type=authenticated`. Les URL signées temporaires restent côté serveur ; l’API renvoie les fichiers après contrôle d’accès avec `Cache-Control: private, no-store`. Stockage local privé possible pour le développement. Suppression du fichier après suppression du document/compte.
- Jetons FCM privés pour clients et chauffeurs, retrait lors de la déconnexion, transfert du jeton lors d’un changement de compte. Routage des notifications selon le rôle et l’événement. Actions accepter/refuser pour les offres ; ouvrir pour les événements iOS. Déduplication des événements par compte/course/vague, avec mémoire persistante native sur Android.
- Son officiel fourni : PCM WAV stéréo 16 bits, 44,1 kHz, 3,52 secondes. Ressources Android et iOS intégrées ; canal `winrak_events_v2` pour les installations ayant l’ancien canal. Les anciens canaux sont conservés, mais les nouveaux événements utilisent le nouveau canal. Au premier plan iOS, la présentation FCM est désactivée au profit d’une seule notification locale.
- Nom WinRak sur Android/iOS, dans le navigateur et les métadonnées web. Icône officielle existante conservée sur mobile et réutilisée pour le favicon React. Aucun nouveau logo ; domaines et cibles de déploiement conservés.

## Fichiers principaux

| Partie | Fichiers |
| --- | --- |
| Backend | `deliveries/views.py`, `serializers.py`, `models.py`, `firebase.py`, `course_services.py`, `admin.py`, `apps.py`, nouveaux `private_storage.py` et `signals.py` |
| Migration | `deliveries/migrations/0022_client_fcm_token_driverdocument.py` |
| Configuration | `config/settings.py`, `config/test_settings.py`, `.gitignore` ; valeurs Cloudinary existantes déplacées dans le `.env` local ignoré par Git |
| React | `src/livreursapi.js`, pages `Couriers`, `ClientCourse`, `LivreurCourse`, `ClientDashboard`, `LivreurDashboard`, `Tracking` ; composants `Layout`, `CouriersMap`, `MapboxMap`, `CourseCancelledState`, `LivreurOrders`, nouveau `DriverDocuments` ; `utils/cancellation.js`, `styles.css`, `index.html`, `public/winrak-icon.png` |
| Flutter et Android | `lib/main.dart`, plugin Java `WinrakNotificationsPlugin.java`, manifeste Android, `res/raw/winrak_notification.wav`, `res/raw/keep.xml` |
| iOS et web Flutter | `Runner/Info.plist`, `Runner/winrak_notification.wav`, `Runner.xcodeproj/project.pbxproj`, `web/index.html`, `web/manifest.json` |
| Vérification | `deliveries/test_accounts_notifications.py`, `test/course_notification_test.dart`, `livreur-pro/scripts/verify-winrak.mjs` |

## Vérifications

Les vérifications s’exécutent sans envoyer de push réels ni téléverser de document réel vers Cloudinary. Les tests backend utilisent une base SQLite en mémoire. Les contrôles navigateur interceptent les appels API avec des comptes fictifs.

Résultats : 45 tests Django, 8 tests Flutter et 12 tests JavaScript réussis. Analyse Flutter sans problème ; contrôles Django et migrations cohérents. Parcours en navigateur vérifiés sur une largeur de 390 pixels, dont offre et acceptation, documents, rôle, annulation et délai de retour. Compilation React réussie ; les avertissements de taille des bundles Mapbox et de dépendances sont non bloquants. Compilation Android debug réussie. La compilation iOS et la réception FCM réelle restent à valider sur macOS/appareils.

```powershell
# À la racine
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run
.\.venv\Scripts\python.exe manage.py test deliveries --settings=config.test_settings --noinput

# Dans livreur-pro
npm run build
$testFiles = @(rg --files src/utils -g '*.test.js')
node --test $testFiles
npm run dev -- --port 5174
# Autre terminal, avec Playwright disponible :
node scripts/verify-winrak.mjs

# Dans flutter/foodmood_app, avec le SDK Flutter installé
flutter analyze --no-pub
flutter test --no-pub
flutter build apk --debug --no-pub
```

Les captures de vérification sont dans `verification/` (ignoré par Git). La commande navigateur utilise `http://localhost:5174` par défaut ; `WINRAK_PREVIEW_URL` permet de choisir un autre port. Playwright est utilisé pour les contrôles, sans modifier les dépendances de production.

## Mise en production

1. Conserver les sauvegardes habituelles de la base. Définir sur le backend les variables `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` avec les valeurs existantes. Elles remplacent les valeurs auparavant présentes dans le code. Conserver la configuration Firebase et les autres variables existantes.
2. Utiliser `PRIVATE_DOCUMENT_BACKEND=cloudinary` (valeur par défaut). Les documents n’utilisent pas le répertoire éphémère de l’hébergement. En développement, `PRIVATE_DOCUMENT_BACKEND=filesystem` et `PRIVATE_DOCUMENT_ROOT` permettent un répertoire privé ; ne pas le servir via le serveur web ou `MEDIA_URL`. Le choix du stockage doit rester stable après les premiers téléversements.
3. Depuis la racine du backend : `python manage.py migrate`. La migration ajoute le jeton FCM client et la table des documents ; aucune obligation de validation n’est ajoutée aux comptes existants. Attribuer à l’équipe de vérification les permissions Django `view_driverdocument` et `change_driverdocument`.
4. Déployer le backend et le frontend avec les procédures existantes. Redémarrer le backend pour charger les variables. Les clients web déjà connectés doivent ouvrir la nouvelle version ; le téléphone enregistre son jeton client après connexion.
5. Publier une nouvelle version mobile : l’ancienne application ne contient pas la ressource sonore ni le nouveau routage client. Utiliser le processus de signature/versionnement habituel pour l’AAB/APK de production. L’APK debug de contrôle ne remplace pas une version signée de distribution.
6. Sur macOS, ajouter le `GoogleService-Info.plist` de l’application iOS Firebase dans la cible Runner (il n’est pas présent dans ce dépôt), vérifier l’identifiant de bundle, les capacités Push Notifications, la configuration APNs dans Firebase et la signature. Le WAV est déjà référencé dans les ressources Runner. Compiler puis vérifier sur appareil iOS.
7. Sur de vrais appareils Android et iOS : vérifier les permissions, les offres accepter/refuser, le clic client/chauffeur, l’annulation dans chaque sens, le son au premier plan/en arrière-plan/application fermée, l’absence de double son, la mise à jour d’une ancienne installation, le changement de compte, la sélection de photo et le téléchargement privé. Vérifier un téléversement et une consultation privés sur le Cloudinary de production.

La livraison FCM et le son restent soumis aux permissions, aux réglages de canal/silence et aux restrictions du système. Après un arrêt forcé dans les réglages Android, l’utilisateur doit rouvrir l’application pour rétablir la réception. Voir la [documentation Firebase](https://firebase.google.com/docs/cloud-messaging/flutter/receive-messages). Le WAV respecte les contraintes décrites par [Apple](https://developer.apple.com/documentation/usernotifications/unnotificationsound). Le stockage utilise les [ressources authentifiées Cloudinary](https://cloudinary.com/documentation/control_access_to_media).

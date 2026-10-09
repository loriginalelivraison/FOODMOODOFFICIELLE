# WinRak mobile

Application Flutter Android/iOS qui affiche le site `https://www.winrak.fr`.
Les écrans, les comptes clients et conducteurs (livreurs ou chauffeurs), les
réservations et les règles métier sont partagés avec `../../livreur-pro` et
le backend Django. Les changements React doivent être déployés sur le domaine
du site pour apparaître dans l'application mobile.

## Développement et vérification

Utiliser un SDK Flutter compatible avec `pubspec.yaml` (Dart 3.11 minimum),
Android SDK pour Android et macOS/Xcode pour iOS. Le SDK installé indiqué par
`android/local.properties` est prioritaire sur toute copie incomplète du SDK
présente dans le dépôt.

Depuis ce dossier :

```sh
flutter pub get
flutter analyze
flutter test
flutter build apk --release
```

Firebase doit être configuré pour chaque identifiant d'application, avec les
fichiers Android/iOS de l'environnement ciblé et les capacités APNs sur iOS.
Sans Firebase initialisé, le site reste accessible, sans notifications push.
`backendUrl` dans `lib/main.dart` et `webAppUrl` dans `lib/web_session.dart`
identifient la production.

## Session et position

- Le site est la source de la session : clés `access`, `role` (`client` ou
  `livreur`) et profil JSON dans `client` ou `livreur`.
- Le jeton FCM est enregistré pour le compte actuellement connecté.
- Sur Android, le service GPS démarre uniquement pour un conducteur connecté
  avec `livreurOnline === 'true'` ou un `activeDriverCourseId` valide, après
  autorisation GPS et depuis une application visible.
- `authChanged`, le retour au premier plan et une synchronisation toutes les
  cinq secondes mettent à jour les fonctions natives. La déconnexion et la
  mise hors ligne sans course arrêtent le service.
- La position est envoyée toutes les quinze secondes et lors d'un changement
  d'authentification, avec délais limites et sans requêtes concurrentes.
- Le suivi iOS utilise la géolocalisation du site au premier plan. Le suivi
  iOS continu en arrière-plan nécessite une implémentation native dédiée ;
  il n'est pas assuré par cette enveloppe WebView.

## Navigation

Seuls les domaines HTTPS `winrak.fr` et `www.winrak.fr` sont ouverts dans la
WebView. Téléphone, WhatsApp, cartes et autres liens externes ouvrent l'application
associée. Le bouton retour Android parcourt l'historique avant de quitter.
Une erreur de chargement affiche une action pour réessayer. Les permissions
photos/caméra et GPS sont demandées à l'usage.

## Validation sur appareils avant publication

1. Se connecter comme client, puis comme livreur/chauffeur : vérifier les rôles
   et l'absence de service GPS natif pour le client.
2. Passer conducteur en ligne, autoriser GPS, commencer une course et verrouiller
   l'écran : vérifier les positions côté client. Terminer puis passer hors ligne
   et se déconnecter : vérifier l'arrêt de la notification permanente GPS.
3. Refuser GPS/notifications, couper puis rétablir le réseau : vérifier la
   récupération et le bouton de nouvelle tentative.
4. Tester retour Android, téléphone, cartes, WhatsApp, photo et appareil photo.
5. Tester les notifications à chaud, en arrière-plan et à froid, puis accepter
   et refuser une offre. Voir `packages/winrak_notifications/README.md`.

Les tests unitaires ne remplacent pas les essais GPS, permissions, Firebase/APNs
et restrictions batterie sur appareils réels.

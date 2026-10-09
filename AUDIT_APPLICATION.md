# Revue des parcours WinRak — 9 octobre 2026

## Règles harmonisées

- Le client demande une course avec départ, destination, véhicule et prix. Une seule course active est autorisée ; une nouvelle tentative retrouve la course existante.
- Les chauffeurs et livreurs partagent le rôle technique `livreur`. Le véhicule détermine le vocabulaire : voiture pour un trajet, moto/camion pour une livraison.
- Le conducteur accepte une offre ; le client confirme son choix. Les autres offres du conducteur sélectionné sont retirées pour éviter des engagements incompatibles.
- Le conducteur confirme son arrivée, la prise en charge pour une livraison, puis le démarrage. La fin de course exige un conducteur affecté et le statut `in_progress`.
- Le GPS ne change pas la disponibilité. Une fin ou annulation conserve le choix du conducteur de rester hors ligne.
- Les coordonnées de contact du client sont réservées au conducteur affecté pendant la course et au client propriétaire.
- Une course active empêche la suppression du compte. Les avis exigent un client authentifié ayant une course terminée avec ce conducteur.

## Écrans et session

- Navigation adaptée au rôle, sans deux onglets menant au même écran.
- Suivi client unique dans `/course/:id` ; les anciens profils publics orientent vers le formulaire de réservation complet.
- Compte client : demande actuelle, historique ouvrable, statut précis, paramètres et erreurs récupérables. Les avis d'autres clients ne sont plus présentés comme les siens.
- Fin proposée seulement au bon moment ; annulation avec confirmation et motif ; notation sans fermeture automatique.
- Inscription : validation cohérente, récupération de la connexion si la création a réussi, erreurs GPS distinctes des erreurs serveur.
- Déconnexion : nettoyage des données de session et de course, conservation des préférences, retrait des notifications et passage du conducteur hors ligne si le serveur est joignable.
- Mobile : pont de session WebView, suivi Android réservé aux conducteurs disponibles/en course, navigation retour et écran d'erreur avec nouvelle tentative.

## Vérification

Les tests Django utilisent `config.test_settings` et une base isolée. Aucun test ne modifie la base utilisateur `db.sqlite3`.

Résultats : 69 tests Django complets puis 20 tests ciblés après l'ajout du contrôle de confidentialité (70 scénarios distincts), 36 tests JavaScript et 14 tests Flutter réussis. Analyse Flutter sans anomalie ; compilation web réussie ; cinq parcours navigateur réussis sur données simulées. Captures mobile et ordinateur examinées.

```powershell
.venv/Scripts/python.exe -B manage.py test deliveries --settings=config.test_settings --noinput
cd livreur-pro
npm test
npm run build
# Avec Vite lancé sur http://127.0.0.1:5186 et Playwright disponible :
node scripts/verify-workflows.mjs
```

Les contrôles navigateur utilisent des comptes et réponses API simulés. Ils couvrent les actions du compte client, l'annulation, la notation, l'historique, la navigation et les protections de rôle. Les captures se trouvent dans `verification/audit-*.png`.

## Portée restante avant publication

Les tests locaux ne valident pas l'envoi Firebase/APNs réel, les positions GPS sur téléphone verrouillé, les restrictions batterie ni une compilation iOS. Le suivi iOS en arrière-plan nécessite encore une implémentation native dédiée. Les scénarios d'appareil sont décrits dans `flutter/foodmood_app/README.md`.

La compilation web conserve un avertissement de taille pour le module Mapbox. Aucun déploiement n'a été effectué dans cette revue.

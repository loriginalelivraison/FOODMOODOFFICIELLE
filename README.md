# WinRak

Application de mise en relation entre clients, chauffeurs et livreurs.

- `config/`, `deliveries/`, `manage.py` : backend Django REST à la racine.
- `livreur-pro/` : interface React/Vite utilisée sur le web et dans l'application mobile.
- `flutter/foodmood_app/` : application Flutter et fonctions natives Android/iOS.
- `verification/` : captures des vérifications visuelles locales.

Le dossier `livreur-pro-back/` ne contient pas le backend actif. Lancer Django depuis la racine de ce dépôt.

## Démarrage local

Les variables d'environnement privées restent dans les fichiers `.env` locaux. Configurer notamment la base de données et les services de cartes, stockage et notifications nécessaires à l'environnement choisi.

### API Django

```powershell
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt
.venv/Scripts/python.exe manage.py migrate
.venv/Scripts/python.exe manage.py runserver
```

### Interface web

Dans un deuxième terminal :

```powershell
cd livreur-pro
npm install
npm run dev
```

`VITE_API_BASE_URL` doit désigner l'API, par exemple `http://127.0.0.1:8000/api` en local. Les variables Vite sont intégrées lors de la compilation.

### Application mobile

Voir [le README mobile](flutter/foodmood_app/README.md) pour la configuration Flutter, Firebase, la synchronisation des comptes et les essais sur appareil. La WebView charge le site configuré dans `lib/web_session.dart` ; les modifications React locales ne changent pas automatiquement le site de production.

## Vérifications

```powershell
.venv/Scripts/python.exe -B manage.py test deliveries --settings=config.test_settings --noinput
cd livreur-pro
npm test
npm run build
```

Les tests Django utilisent une base isolée. Le script navigateur `livreur-pro/scripts/verify-workflows.mjs` nécessite Playwright/Chrome et un serveur Vite local sur le port 5186, ou `WINRAK_PREVIEW_URL`.

La [revue des parcours et règles métier](AUDIT_APPLICATION.md) décrit les corrections, leur couverture et les vérifications sur appareil restant nécessaires avant publication.
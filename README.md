# FoodMood / Livreur Pro

Projet complet composé de 3 applications :

- Frontend web : React + Vite dans [livreur-pro](livreur-pro)
- Backend API : Django REST Framework dans [livreur-pro-back](livreur-pro-back)
- Application mobile : Flutter dans [flutter/foodmood_app](flutter/foodmood_app)

## Structure du dépôt

```text
livreurs-pro/
├── README.md
├── .env
├── manage.py
├── requirements.txt
├── runtime.txt
├── Dockerfile
├── Procfile
├── db.sqlite3
├── staticfiles/
├── config/
├── deliveries/
├── livreur-pro/            # Frontend React
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.*
├── livreur-pro-back/       # Backend Django
│   ├── config/
│   ├── deliveries/
│   ├── manage.py
│   ├── requirements.txt
│   └── db.sqlite3
└── flutter/
    └── foodmood_app/      # App Flutter
        ├── lib/
        ├── android/
        ├── ios/
        ├── web/
        └── pubspec.yaml
```

## Lancer les projets

### 1) Backend Django

```bash
cd livreur-pro-back
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### 2) Frontend React

```bash
cd livreur-pro
npm install
npm run dev
```

### 3) Application Flutter

```bash
cd flutter/foodmood_app
flutter pub get
flutter run
```

## Rôle de chaque partie

- Frontend : interface web pour les clients et les livreurs
- Backend : API, authentification, données et logique métier
- Flutter : application mobile native pour les utilisateurs

## Déploiement

- Frontend Vercel / hosting statique
- Backend Django / serveur Python
- Flutter APK / AAB / iOS build

## Bonnes pratiques

- Garder un environnement séparé par application
- Stocker les variables sensibles dans un fichier .env
- Vérifier les dépendances avant chaque build
- Maintenir une API stable entre le front et le backend

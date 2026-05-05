# LivreurPro — React App professionnelle

Application front-end React type Uber pour mettre en relation des clients avec des livreurs disponibles.

## Fonctionnalités incluses

- Accueil professionnel responsive
- Liste des livreurs avec recherche et filtre de disponibilité
- Inscription livreur avec formulaire complet
- Tracking public simulé sans inscription client
- Dashboard admin simplifié
- Architecture propre par composants/pages/data
- Design adapté mobile, tablette et desktop

## Installation

```bash
npm install
npm run dev
```

Puis ouvrir l'URL affichée par Vite, souvent :

```bash
http://localhost:5173
```

## Architecture

```txt
src/
  components/       composants réutilisables
  data/             données mockées
  pages/            pages principales
  App.jsx           routes React
  main.jsx          point d'entrée
  styles.css        design global responsive
```

## Prochaine étape professionnelle

Pour transformer ce front en vraie plateforme complète :

- Backend Node.js/Express ou Django
- Base PostgreSQL
- Auth livreur/admin
- Validation KYC des livreurs
- API de géolocalisation temps réel
- WebSocket pour tracking live
- Paiement Stripe
- Notifications SMS/email/push
- Hébergement Render/Vercel

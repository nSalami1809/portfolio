# Nawaf Nemrod Salami — Portfolio

Portfolio personnel de [Nawaf Nemrod Salami](https://nawafsalami-itech.vercel.app), développeur web fullstack & DevOps basé à Libreville, Gabon. Bilingue FR/EN, avec un back-office complet permettant de piloter tout le contenu et l'activité commerciale sans toucher au code.

**Site en ligne :** https://nawafsalami-itech.vercel.app

## Stack

- **Next.js 16** (App Router, Turbopack) + **TypeScript**
- **Tailwind CSS v4**, **Framer Motion**, Three.js / React Three Fiber (fonds animés)
- **MongoDB** (contenu, devis/factures, statistiques, sauvegardes)
- Authentification admin par mot de passe + OTP par e-mail (JWT, `jose`)
- **Vercel Blob** pour les fichiers (images, CV, signatures, pièces jointes clients)
- IA : **Google Gemini** (`@ai-sdk/google` + Vercel AI SDK) pour le chatbot et les traductions FR→EN

## Fonctionnalités

**Site public** (`/fr`, `/en`) — accueil, parcours (`/resume`), vision, projets, blog, offres, CGV, et un chatbot flottant capable de renseigner un visiteur, générer un devis chiffré et le lui envoyer par e-mail.

**Back-office** (`/admin`) — CRUD sur tout le contenu public (projets, blog, expériences, compétences, témoignages, offres) sans redéploiement, avec :
- **Cycle commercial complet** : devis → signature électronique du client (OTP) → contrat → livraison → PV de recette signé → facturation (acompte/solde) → reçus, avec relances automatiques et un espace client de suivi.
- **Signature de documents Word** : upload d'un `.docx`, repérage de chaque emplacement où le mot « signature » apparaît, sélection manuelle, puis génération d'une copie du document avec la signature enregistrée et un bloc de preuve électronique (nom, date, empreinte SHA-256) insérés automatiquement.
- Statistiques d'activité, sauvegardes chiffrées de la base, notifications push et par e-mail, gestion des prospects et du calendrier.

**Multilingue** — tout le contenu saisi en français dans l'admin est traduit à la volée vers l'anglais (mis en cache), avec un routage par préfixe `/fr` / `/en`.

## Démarrer en local

```bash
npm install
cp .env.local.example .env.local   # puis renseigner les variables (voir le fichier)
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000). Le back-office est accessible sur `/admin` (compte configuré via `ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH`).

Variables d'environnement principales (détails et instructions de génération dans `.env.local.example`) :

| Variable | Rôle |
|---|---|
| `MONGODB_URI`, `MONGODB_DB` | Base de données |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `JWT_SECRET`, `ADMIN_ACCESS_TOKEN` | Authentification admin |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Envoi d'e-mails (Nodemailer) |
| `NEXT_PUBLIC_SITE_URL` | URL canonique (SEO, QR codes, liens absolus) |
| `BLOB_READ_WRITE_TOKEN` | Stockage de fichiers (Vercel Blob) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Chatbot et traduction (Google AI Studio) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Notifications push admin |
| `BACKUP_ENCRYPTION_KEY` | Chiffrement des sauvegardes |

## Tests

```bash
npm test        # vitest run
npm run lint
```

## Déploiement

Déployé sur [Vercel](https://vercel.com). `npm run build` doit passer sans erreur avant tout déploiement.

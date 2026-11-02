<div align="center">

# ⚡ ChatPulse

**Le QG de votre équipe e-sport : une messagerie temps réel pensée pour les structures compétitives.**

Équipes, rôles CEO / Coach / Joueur, salons privés pour le staff, planning des scrims et matchs avec salons dédiés, invitations, notifications en direct.

![NestJS](https://img.shields.io/badge/NestJS-12-E0234E?logo=nestjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-4-010101?logo=socketdotio&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)
![CI](https://github.com/JulienFra/chat-app-5idev/actions/workflows/ci.yml/badge.svg)

Projet 1 — Messagerie temps réel (B2B) · 5IDEV · 2026-2027

</div>

---

## Sommaire

- [Le produit](#-le-produit)
- [Fonctionnalités](#-fonctionnalités)
- [Offres Free et Premium](#-offres-free-et-premium)
- [Stack technique](#-stack-technique)
- [Architecture](#-architecture)
- [Modèle de données](#-modèle-de-données)
- [Démarrer en local](#-démarrer-en-local)
- [Tests](#-tests)
- [CI/CD et déploiement](#-cicd-et-déploiement)
- [Sécurité](#-sécurité)
- [Conformité (RGPD, cookies)](#-conformité-rgpd-cookies)
- [Structure du dépôt](#-structure-du-dépôt)
- [Équipe](#-équipe)

---

## 🎮 Le produit

Les équipes e-sport s'organisent souvent sur des serveurs Discord bricolés : rôles mal gérés, scrims perdus dans le fil de discussion, staff et joueurs mélangés. **ChatPulse** est un SaaS B2B qui structure tout ça :

- une **équipe** = un espace avec ses membres, ses rôles et ses salons ;
- le **staff** (CEO et coachs) a son salon privé `#admin` ;
- chaque **scrim** ou **match** planifié crée automatiquement son salon (`#scrim-vitality-30-10`), archivé 7 jours après ;
- tout arrive **en direct** : messages, invitations, changements de rôle, « X est en train d'écrire… ».

> 🌐 **Production** : `http://82.25.58.90/`

---

## ✨ Fonctionnalités

### Messagerie
- 💬 **Messages privés** (1:1) et **salons d'équipe** (`#général`, `#admin`, salons d'événements)
- ⚡ **Temps réel** avec Socket.io : messages, nouveaux salons, invitations, rôles, présence
- ✍️ Indicateur **« en train d'écrire »**
- 🟢 **Présence en ligne** des membres
- 🔔 **Notifications** : badges de non-lus persistants (calculés côté serveur), toasts empilés, notifications natives du navigateur

### Équipes et rôles
- 🛡️ Rôles **CEO / Coach / Joueur** ; un seul CEO = le propriétaire de l'équipe
- 🔒 `#admin` visible uniquement par le CEO et les coachs, synchronisé automatiquement à chaque changement de rôle
- ⚙️ Paramètres d'équipe : renommer, transférer la propriété, exclure, quitter, supprimer (avec confirmation)
- 👥 Colonne des membres cliquable : changer un rôle, exclure, envoyer un message privé

### Invitations
- 🔍 Recherche de joueurs **par pseudo** (unique, sans espace, insensible à la casse)
- 📩 Invitation à **accepter ou refuser**, reçue en direct (toast + badge)
- 🚫 **Anti-spam** : 1 invitation en attente par joueur et par équipe, 24 h de délai après un refus, 20 envois par heure, expiration après 7 jours

### Événements
- 📅 Planifier un **scrim** ou un **match officiel**
- #️⃣ Salon dédié créé automatiquement en Premium (`scrim-equipe-rouge-30-10`, suffixe `-2` en cas de doublon, date à l'heure de Bruxelles)
- 🗄️ **Archives** repliables 7 jours après l'événement (le salon reste accessible)
- ⚠️ Onglet **« Mes events »** : tous les événements de toutes mes équipes, avec **alerte si deux se chevauchent**

### Compte
- 🔐 Inscription / connexion (JWT), changement de mot de passe
- ★ Interrupteur **Premium (mode démo)** dans le profil, pour tester les deux offres

### Interface
- 🎨 Interface façon Discord : rail d'équipes, salons, conversation, membres
- 📱 **Responsive** : sur mobile, navigation puis conversation en plein écran
- 🏠 Landing page avec grille tarifaire et FAQ

---

## 💎 Offres Free et Premium

L'offre dépend du plan **du propriétaire** de l'équipe. Toutes les limites sont vérifiées **côté serveur**.

| | Rookie (Free) | Team Pro (Premium) |
|---|---|---|
| Équipes créées | 1 | 10 |
| Places par équipe (invitations en attente comprises) | 5 | 20 |
| Rôles CEO / Coach / Joueur | — (seul le créateur gère) | ✅ |
| Salon `#général` | ✅ | ✅ |
| Salon `#admin` (staff) | — | ✅ |
| Événements au calendrier | ✅ | ✅ |
| Salon dédié par événement | — | ✅ |

> Passage Premium → Free : rien n'est supprimé, mais la création d'équipes, de membres et d'événements est bloquée tant que les limites sont dépassées.

---

## 🧰 Stack technique

| Couche | Choix | Pourquoi |
|---|---|---|
| Backend | **NestJS 12** (TypeScript) | Modules, injection de dépendances, guards et pipes de validation : une API structurée et testable |
| Temps réel | **Socket.io** (`@nestjs/websockets`) | Rooms par conversation et par utilisateur, reconnexion automatique |
| Base de données | **PostgreSQL 16** | Relationnel, contraintes d'intégrité, transactions |
| ORM | **Prisma 7** | Schéma typé, migrations versionnées |
| Auth | **JWT** + **bcrypt** | Sans état, compatible HTTP et WebSocket |
| Validation | **class-validator** / **class-transformer** | DTO validés à l'entrée de chaque route |
| Frontend | **React 19** + **Vite 8** | Rapide en développement, build léger |
| Style | **Tailwind CSS 4** | Interface cohérente, responsive, sans CSS à maintenir |
| Qualité | **oxlint**, **Jest**, **Supertest**, **Vitest** | Lint rapide, tests unitaires et de bout en bout |
| Infra | VPS **Ubuntu 24.04** (HOSTKEY), **Nginx**, **PM2**, **Docker** | Contrôle total, WebSockets supportés, coût faible |
| CI/CD | **GitHub Actions** | Lint, tests, build et déploiement automatique sur `main` |

---

## 🏗️ Architecture

```mermaid
flowchart LR
    subgraph Client["Navigateur"]
        UI["React 19 + Vite<br/>Tailwind"]
    end

    subgraph VPS["VPS Ubuntu (HOSTKEY)"]
        NGINX["Nginx<br/>fichiers statiques + reverse proxy"]
        subgraph API["NestJS (PM2)"]
            REST["API REST /api/*<br/>JwtAuthGuard + ValidationPipe"]
            WS["Gateway Socket.io<br/>rooms conv:* et user:*"]
        end
        DB[("PostgreSQL 16<br/>Docker, 127.0.0.1 uniquement")]
    end

    GH["GitHub Actions<br/>lint · tests · build · deploy"]

    UI -- "HTTP /api" --> NGINX
    UI <-- "WebSocket /socket.io" --> NGINX
    NGINX --> REST
    NGINX <--> WS
    REST -- Prisma --> DB
    WS -- Prisma --> DB
    REST -. "émet après écriture" .-> WS
    GH -- "SSH" --> VPS
```

**Principe du temps réel : enregistrer d'abord, diffuser ensuite.** Un message passe par l'API REST (validation, droits, enregistrement en base), puis le service demande au gateway de le diffuser dans la room `conv:<id>`. Chaque socket rejoint à la connexion sa room personnelle `user:<id>` et les rooms de ses conversations ; quand un accès change (invitation acceptée, rôle modifié, exclusion), `syncChannels` met à jour les accès en base **et** fait rejoindre ou quitter les rooms en direct.

### Modules backend

| Module | Rôle |
|---|---|
| `auth` | Inscription, connexion, JWT, `JwtAuthGuard` |
| `users` | Profil, recherche par pseudo, mot de passe, plan (démo) |
| `teams` | Équipes, rôles, limites des plans, synchronisation des salons, événements |
| `invitations` | Invitations avec règles anti-spam |
| `conversations` | Liste des conversations, messages privés, non-lus |
| `messages` | Envoi et lecture des messages |
| `realtime` | Gateway Socket.io : rooms, diffusion, « en train d'écrire », présence |
| `prisma` | Accès à la base |

---

## 🗃️ Modèle de données

```mermaid
erDiagram
    User ||--o{ Team : "possède (CEO)"
    User ||--o{ TeamMember : "fait partie"
    Team ||--o{ TeamMember : "membres + rôle"
    Team ||--o{ Conversation : "salons"
    Team ||--o{ Event : "scrims / matchs"
    Team ||--o{ Invitation : "invitations"
    Event |o--o| Conversation : "salon dédié"
    User ||--o{ Membership : "accès"
    Conversation ||--o{ Membership : "qui voit le salon"
    Conversation ||--o{ Message : "contient"
    User ||--o{ Message : "écrit"
    User ||--o{ Invitation : "envoie / reçoit"

    User {
        uuid id
        string email
        string displayName
        string passwordHash
        enum plan "FREE | PREMIUM"
    }
    Team {
        uuid id
        string name
        uuid ownerId
    }
    TeamMember {
        enum role "CEO | COACH | PLAYER"
    }
    Conversation {
        enum type "DIRECT | GENERAL | ADMIN | EVENT"
        string name
    }
    Membership {
        datetime lastReadAt
    }
    Message {
        string content
        datetime createdAt
    }
    Event {
        enum type "SCRIM | MATCH"
        string opponent
        datetime startsAt
    }
    Invitation {
        enum status "PENDING | ACCEPTED | DECLINED | CANCELLED"
    }
```

Points clés :
- **`Membership`** décide qui voit quel salon : `#général` = tous les membres, `#admin` = CEO + coachs.
- **`lastReadAt`** permet de calculer les **non-lus côté serveur** en une seule requête SQL.
- L'**archivage** et l'**expiration des invitations** sont calculés à la lecture : pas de tâche planifiée.

---

## 🚀 Démarrer en local

### Prérequis

- **Node.js 22**
- **Docker** (pour PostgreSQL)
- Git

### 1. Cloner et lancer la base de données

```bash
git clone https://github.com/JulienFra/chat-app-5idev.git
cd chat-app-5idev
docker compose up -d
```

### 2. Backend

```bash
cd backend
cp .env.example .env
```

Dans `backend/.env` :

```env
PORT=3000
DATABASE_URL="postgresql://chatapp:chatapp_dev_password@localhost:5432/chatapp?schema=public"
JWT_SECRET="une-longue-chaine-aleatoire"
```

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run start:dev
```

L'API tourne sur **http://localhost:3000/api**.

### 3. Frontend

Dans un deuxième terminal :

```bash
cd frontend
npm install
npm run dev
```

Ouvre **http://localhost:5173**. Vite redirige `/api` et `/socket.io` vers le backend.

> 💡 Pour tester le temps réel, ouvre un deuxième compte dans une fenêtre de navigation privée.

### Scripts utiles

| Où | Commande | Rôle |
|---|---|---|
| backend | `npm run start:dev` | API en mode développement |
| backend | `npm run lint` | Lint (oxlint) |
| backend | `npm test` | Tests unitaires (Jest) |
| backend | `npm run test:e2e` | Tests de bout en bout (Jest + Supertest, vraie base) |
| backend | `npx prisma studio` | Explorer la base de données |
| frontend | `npm run dev` | Interface en mode développement |
| frontend | `npm run lint` | Lint (oxlint) |
| frontend | `npm test` | Tests unitaires (Vitest) |
| frontend | `npm run build` | Build de production |

---

## 🧪 Tests

| Type | Outil | Ce qui est vérifié |
|---|---|---|
| Unitaires backend | Jest | Génération des noms de salons d'événements (accents, longueur, fuseau horaire de Bruxelles) |
| **Bout en bout** | Jest + Supertest | L'application complète sur une vraie base PostgreSQL : authentification, pseudo unique, recherche, limites Free/Premium, invitations, accès `#admin` selon le rôle, droits sur les messages, validation et salons des événements |
| Unitaires frontend | Vitest | Détection des événements qui se chevauchent, archivage, tri des événements |

Les tests e2e créent leurs propres comptes (`@e2e.test`) et les suppriment à la fin : ils peuvent être relancés à volonté.

```bash
cd backend && npm test && npm run test:e2e -- --runInBand
cd ../frontend && npm test
```

---

## 🔄 CI/CD et déploiement

```mermaid
flowchart LR
    PR["Pull request"] --> L["Lint & Style"]
    PR --> T["Tests backend<br/>unitaires + e2e<br/>(PostgreSQL de test)"]
    PR --> F["Frontend<br/>lint · Vitest · build"]
    L & T & F --> M{"Merge sur main"}
    M --> D["Deploy to VPS (SSH)<br/>git pull · npm ci · prisma migrate deploy<br/>build · pm2 restart · copie du frontend"]
```

- La branche `main` est **protégée** : tout passe par une pull request, et les 3 jobs doivent être verts.
- Le déploiement applique automatiquement les **migrations Prisma** (`migrate deploy`).
- **PM2** relance l'API après un redémarrage du serveur (`pm2 startup` + `pm2 save`).
- **Nginx** sert le frontend compilé et redirige `/api/` et `/socket.io/` (WebSocket) vers NestJS.
- PostgreSQL tourne dans Docker, **accessible uniquement depuis le serveur** (`127.0.0.1`).

---

## 🔐 Sécurité

- Mots de passe **hachés avec bcrypt**, jamais renvoyés par l'API
- **JWT** (7 jours) vérifié sur chaque route protégée **et** à la connexion WebSocket
- **Validation stricte** des entrées (`ValidationPipe` avec `whitelist` et `forbidNonWhitelisted`)
- **Contrôle des droits côté serveur** sur chaque action : membre d'un salon, rôle CEO/coach, plan de l'équipe
- Un utilisateur ne peut signaler « en train d'écrire » que dans une conversation dont il est membre
- Requêtes SQL brutes **paramétrées** (`$queryRaw` en template)
- Secrets uniquement dans des **variables d'environnement** (jamais dans le dépôt)
- Serveur : connexion SSH par clé uniquement, pare-feu UFW (22, 80, 443)

---

## ⚖️ Conformité (RGPD, cookies)

- **Pas de cookies publicitaires ni de mesure d'audience.** Le site utilise seulement le stockage local du navigateur, strictement nécessaire à la connexion : un bandeau informe l'utilisateur, sans demande de consentement (directive ePrivacy, art. 5.3).
- Pages **Mentions légales**, **Politique de confidentialité** (données traitées, finalités, durée de conservation, droits, plainte auprès de l'APD), **Cookies**, **Conditions d'utilisation et de vente** et **Contact**, accessibles depuis le pied de page, l'inscription et le profil.
- Le plan Premium est une **démonstration** : aucun paiement n'est demandé ni encaissé.

---

## 📁 Structure du dépôt

```
chat-app-5idev/
├── .github/workflows/ci.yml     # CI/CD : lint, tests, build, déploiement
├── docker-compose.yml           # PostgreSQL pour le développement
├── backend/                     # API NestJS
│   ├── prisma/
│   │   ├── schema.prisma        # Modèle de données
│   │   └── migrations/          # Migrations versionnées
│   ├── src/
│   │   ├── auth/                # Inscription, connexion, JWT
│   │   ├── users/               # Profil, recherche, plan
│   │   ├── teams/               # Équipes, rôles, salons, événements
│   │   ├── invitations/         # Invitations anti-spam
│   │   ├── conversations/       # Conversations, non-lus
│   │   ├── messages/            # Messages
│   │   ├── realtime/            # Gateway Socket.io
│   │   └── prisma/              # Service Prisma
│   └── test/                    # Tests e2e
└── frontend/                    # Interface React
    └── src/
        ├── ChatPage.tsx         # Rail d'équipes, salons, conversation
        ├── LandingPage.tsx      # Accueil, tarifs, FAQ
        ├── LegalPage.tsx        # Pages légales et contact
        ├── events.ts            # Conflits, archives, horloge partagée
        └── components/          # Conversation, membres, modales, toasts…
```

---

## 👥 Équipe

| Membre | Contributions principales |
|---|---|
| **Julien Francis** | Infrastructure (VPS, Nginx, PM2, Docker), CI/CD, temps réel (rooms Socket.io, live), non-lus côté serveur, toasts, pseudo unique et recherche, profil, invitations, refonte en équipes e-sport (rôles, salons, interface Discord), correctifs des événements et onglet « Mes events », tests unitaires et e2e, pages légales |
| **Florentin Muraille** | Authentification JWT sécurisée, rôles & permissions, landing page & tarifs, temps réel (notifications, présence, indicateur de frappe), gestion des événements/scrims (salons dédiés et archivage), upload d'images sécurisé avec limites de taille (Free/Premium) et visionneuse Lightbox |

---

<div align="center">

Projet réalisé dans le cadre du cours **5IDEV — Projet d'intégration de développement**, 2026-2027.

</div>

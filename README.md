# ClaudeSounds

**Music distribution, publishing and marketing for independent artists and labels.**

ClaudeSounds lets an artist or label upload a release, deliver it to the major streaming stores, register publishing works and writer splits, run marketing campaigns across playlist pitching / social ads / PR / email / influencer channels, and track streams, listeners and royalties from a single dashboard.

---

## Table of contents

1. [What it does](#what-it-does)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Install](#install)
5. [Database setup](#database-setup)
6. [Environment variables](#environment-variables)
7. [Local development](#local-development)
8. [Production deployment](#production-deployment)
9. [API reference](#api-reference)
10. [Design system rules](#design-system-rules)
11. [Project structure](#project-structure)
12. [Troubleshooting](#troubleshooting)

---

## What it does

| Area | Capability |
| --- | --- |
| **Distribution** | Create releases (single / EP / album) with tracks, ISRCs, durations, explicit flags and songwriter credits. Deliver a release to Spotify, Apple Music, Amazon Music, YouTube Music, Deezer and Tidal and track per-store delivery status. |
| **Publishing** | Register publishing works with ISWC and society, attach writer/publisher splits that must total exactly 100%, and advance registration status from *unregistered* → *submitted* → *registered*. |
| **Marketing** | Plan and run campaigns with a budget, spend, schedule, linked release and channel; monitor impressions, clicks, CTR and budget utilisation. |
| **Analytics** | 30/7/90-day stream and listener totals with period-over-period deltas, daily time series, top releases with platform breakdown, and royalty statements (gross / fee / net / paid status). |

---

## Architecture

```
                    Browser
                       │
     ┌─────────────────┴──────────────────┐
     │                                    │
 Next.js 14 App Router              Express API
 https://claudesounds.arx-app.com   https://claudesounds-api.arx-app.com:4107
 (port 4107, `npm run start`)      (port $PORT, `npm run server`)
     │                                    │
 lib/api.js  ──── fetch(credentials:'include') ───▶ /api/*
                                          │
                                   mysql2/promise pool
                                          │
                                      MySQL 8
                       (app tables + express-mysql-session `sessions`)
```

* **Frontend** — Next.js App Router (JSX, no TypeScript). One global stylesheet (`app/globals.css`) imported exactly once from `app/layout.jsx`. Client data fetching only happens inside `useEffect`, so the production build never needs the API to be online.
* **Backend** — Express with `cors({ credentials: true })` restricted to `https://*.arx-app.com` (plus `localhost` in development), `express-session` persisted in MySQL through `express-mysql-session`, and bcrypt-hashed passwords.
* **Database** — MySQL 8, `utf8mb4`, accessed through a single shared `mysql2/promise` pool (`server/config/db.js`). All SQL is parameterised.
* **Sessions** — HTTP-only cookie, `sameSite: 'none'`, `secure` when `SSL_ENABLED=true`, `domain` from `SESSION_COOKIE_DOMAIN` so the cookie is shared between the web host and the API host, 7-day max age.

---

## Prerequisites

* **Node.js 18+** (Node 20 LTS recommended)
* **npm 9+**
* **MySQL 8.0+** with a database and user already created
* Optional for TLS termination inside Node: certificate, private key and (optionally) CA chain files
* Optional for process management: **PM2** (`npm i -g pm2`)

---

## Install

```bash
git clone <your-repo-url> claudesounds
cd claudesounds
npm install
cp .env.example .env
# edit .env with your real database credentials and session secret
```

There is a **single root `package.json`** covering both the Next.js app and the Express API. The available scripts are exactly:

```json
{
  "dev":    "next dev -p 4107",
  "build":  "next build",
  "start":  "next start -p 4107",
  "server": "node server/index.js"
}
```

---

## Database setup

`schema.sql` creates every table (with `ON DELETE CASCADE` foreign keys and indexes) and inserts realistic seed data: one demo artist account, 4 releases with tracks and store deliveries, publishing works and splits, campaigns, 30 days of stream stats and 3 royalty statements.

```bash
# create the database if it does not exist yet
mysql -h "$DB_HOST" -u "$DB_USER" -p -e "CREATE DATABASE IF NOT EXISTS claudesounds CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# import schema + seed data
mysql -h "$DB_HOST" -u "$DB_USER" -p claudesounds < schema.sql
```

### Tables

| Table | Purpose |
| --- | --- |
| `users` | Accounts (`artist` / `label` / `admin`) with bcrypt `password_hash`. |
| `sessions` | `express-mysql-session` store (`session_id`, `expires`, `data`). |
| `releases` | Title, artist name, type, genre, label, UPC, release date, status, artwork accent colour. |
| `tracks` | Per-release track number, title, ISRC, duration, explicit flag, songwriters. |
| `store_deliveries` | One row per store per release with delivery status. |
| `publishing_works` | Work title, ISWC, society, registration status, optional linked track. |
| `publishing_splits` | Writer/publisher name, role and `share_percent` (must total 100). |
| `campaigns` | Name, channel, status, budget/spend in cents, dates, clicks, impressions. |
| `stream_stats` | Daily streams, listeners and revenue per release per platform. |
| `royalty_statements` | Period label, gross/fee/net cents, paid status. |

> The seeded demo account's password hash is a bcrypt placeholder — replace it with a hash you generate, or simply sign up a fresh account through `/signup`.

---

## Environment variables

Copy `.env.example` to `.env`. Every variable below is read by `server/index.js`, `server/config/db.js` or `next.config.js`.

| Variable | Required | Example | Description |
| --- | --- | --- | --- |
| `PORT` | yes | `4107` | Port the Express API binds to (assigned by the deploy script). |
| `NODE_ENV` | yes | `production` | Node environment. Stack traces are hidden when `production`. |
| `DB_HOST` | yes | `localhost` | MySQL host name. |
| `DB_USER` | yes | `claudesounds` | MySQL user name. |
| `DB_PASSWORD` | yes | `change-me` | MySQL password. |
| `DB_NAME` | yes | `claudesounds` | MySQL database name. |
| `SESSION_SECRET` | yes | `change-me-to-a-long-random-string` | Secret used to sign the session cookie. |
| `SESSION_COOKIE_DOMAIN` | no | `.arx-app.com` | Cookie domain so the session is shared across `*.arx-app.com`. Leave blank for localhost. |
| `SSL_ENABLED` | no | `true` | `true` terminates TLS directly in the Express process. |
| `SSL_CERT_PATH` | when SSL | `/home/arx-app/backends/certs/certificate.crt` | Absolute path to the TLS certificate. |
| `SSL_KEY_PATH` | when SSL | `/home/arx-app/backends/certs/private.key` | Absolute path to the TLS private key. |
| `SSL_CA_PATH` | no | `/home/arx-app/backends/certs/ca_bundle.crt` | Optional CA chain file. |
| `NEXT_PUBLIC_API_URL` | yes | `https://claudesounds-api.arx-app.com:4107` | Public API base URL used by the browser. Baked in at build time. |

**Never commit a real `.env`.** Only `.env.example` (placeholders only) belongs in version control.

---

## Local development

Run the API and the web app in two terminals.

**Terminal 1 — API**

```bash
npm run server
# ➜ ClaudeSounds API listening on http://0.0.0.0:4107
```

**Terminal 2 — Next.js dev server**

```bash
npm run dev
# ➜ http://localhost:4107
```

> Both default to port `4107`. For local work set `PORT=4000` in `.env` so the API and the Next dev server do not collide, and set `NEXT_PUBLIC_API_URL=http://localhost:4000` so the browser client points at it.

Sanity checks:

```bash
curl http://localhost:4000/health
# {"status":"ok"}

curl http://localhost:4000/health/db
# {"status":"ok","database":"connected"}
```

Because `lib/AuthProvider.jsx` only calls `/api/auth/me` inside `useEffect` and treats network failures or `401` as *anonymous*, the frontend still renders correctly when the API is offline.

---

## Production deployment

### Option A — `START.sh`

```bash
chmod +x START.sh
./START.sh
```

`START.sh` loads `.env` if present, installs dependencies (`npm install --omit=dev`, falling back to `npm install`), runs `npm run build`, creates `logs/`, then starts the API (`nohup node server/index.js > logs/api.log 2>&1 &`) and the Next.js production server (`nohup npm run start > logs/web.log 2>&1 &`), echoing both PIDs.

### Option B — PM2 for the web tier

```bash
npm run build
pm2 start ecosystem.config.js
pm2 save
pm2 logs claudesounds
```

`ecosystem.config.js` starts `node_modules/.bin/next start` from `/home/arx-app/backends/claudesounds` with `NODE_ENV=production` and `PORT=4107`. Run the API alongside it:

```bash
pm2 start server/index.js --name claudesounds-api
```

### TLS

When `SSL_ENABLED=true`, `server/index.js` reads `SSL_CERT_PATH`, `SSL_KEY_PATH` and the optional `SSL_CA_PATH` and serves HTTPS directly on `0.0.0.0:$PORT`. Otherwise it falls back to plain HTTP (put it behind a reverse proxy in that case). `app.set('trust proxy', 1)` is enabled so secure cookies work behind a proxy.

---

## API reference

Base URL: `https://claudesounds-api.arx-app.com:4107`
All responses are JSON. All authenticated endpoints require the session cookie (`credentials: 'include'`). Failures return `{ "error": "message", "details": { ... } }` with an appropriate status code.

### Health

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | – | `{ "status": "ok" }` liveness probe. |
| `GET` | `/health/db` | – | Pings MySQL through the shared pool. |

### Auth — `/api/auth`

| Method | Path | Auth | Body / Query | Returns |
| --- | --- | --- | --- | --- |
| `POST` | `/api/auth/signup` | – | `{ email, password (min 8), displayName, artistName, role? }` | `{ user }` and sets the session cookie. |
| `POST` | `/api/auth/login` | – | `{ email, password }` | `{ user }` or `401`. |
| `POST` | `/api/auth/logout` | – | – | `{ ok: true }`, destroys the session. |
| `GET` | `/api/auth/me` | ✅ | – | `{ user }` or `401`. |

`user` shape: `{ id, email, displayName, artistName, role }`.

### Releases — `/api/releases` (all require auth)

| Method | Path | Body / Query | Description |
| --- | --- | --- | --- |
| `GET` | `/api/releases` | `?status=&search=` | Releases owned by the session user with track and delivery counts. |
| `POST` | `/api/releases` | `{ title, artistName, releaseType, primaryGenre, releaseDate, label?, upc?, artworkColor?, tracks: [{ title, isrc?, durationSeconds?, explicit?, songwriters? }] }` | Creates a `draft` release plus its tracks in one transaction. |
| `GET` | `/api/releases/:id` | – | Release + `tracks` + `deliveries`. `404` when not owned. |
| `PATCH` | `/api/releases/:id` | any of `{ title, artistName, releaseType, primaryGenre, label, upc, releaseDate, status, artworkColor }` | Partial update. |
| `DELETE` | `/api/releases/:id` | – | Cascade-deletes tracks, deliveries and stats. |
| `POST` | `/api/releases/:id/deliver` | – | Sets status `in_review` and creates pending deliveries for Spotify, Apple Music, Amazon Music, YouTube Music, Deezer and Tidal. |

### Publishing — `/api/publishing` (all require auth)

| Method | Path | Body | Description |
| --- | --- | --- | --- |
| `GET` | `/api/publishing/works` | – | Works with aggregated split percentage and writer count. |
| `POST` | `/api/publishing/works` | `{ workTitle, iswc?, society?, trackId?, splits: [{ writerName, role, sharePercent }] }` | Splits must total exactly `100`; inserted in a transaction. |
| `GET` | `/api/publishing/works/:id` | – | Work plus its splits. |
| `PATCH` | `/api/publishing/works/:id` | `{ registrationStatus: 'unregistered' \| 'submitted' \| 'registered' }` | Advances registration. |
| `DELETE` | `/api/publishing/works/:id` | – | Removes the work and its splits. |

### Campaigns — `/api/campaigns` (all require auth)

| Method | Path | Body / Query | Description |
| --- | --- | --- | --- |
| `GET` | `/api/campaigns` | `?status=` | Campaigns joined to the release title with derived `ctr` and budget utilisation. |
| `POST` | `/api/campaigns` | `{ name, channel, status, budget (dollars), startDate, endDate, releaseId? }` | Budget is converted to `budget_cents`. `releaseId` must be owned by the user. |
| `PATCH` | `/api/campaigns/:id` | any of `{ name, channel, status, budget, spend, startDate, endDate }` | Partial update. |
| `DELETE` | `/api/campaigns/:id` | – | Deletes the campaign. |

Channels: `playlist_pitch`, `social_ads`, `pr`, `email`, `influencer`.
Statuses: `draft`, `scheduled`, `running`, `completed`, `paused`.

### Analytics — `/api/analytics` (all require auth)

| Method | Path | Query | Description |
| --- | --- | --- | --- |
| `GET` | `/api/analytics/overview` | – | 30-day streams/listeners, active releases, live deliveries, running campaigns, unpaid royalties, plus percentage change vs the previous 30 days. |
| `GET` | `/api/analytics/timeseries` | `?days=7\|30\|90` | `[{ date, streams, listeners, revenueCents }]` with zero-filled gaps. |
| `GET` | `/api/analytics/top-releases` | – | Top 5 releases by streams with platform breakdown. |
| `GET` | `/api/analytics/royalties` | – | Royalty statements ordered by `issued_at` descending. |

### Example

```bash
# log in and keep the cookie
curl -c jar.txt -X POST https://claudesounds-api.arx-app.com:4107/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@claudesounds.app","password":"your-password"}'

# use the session
curl -b jar.txt https://claudesounds-api.arx-app.com:4107/api/analytics/overview
```

---

## Design system rules

There is **exactly one styling approach**: the single global stylesheet `app/globals.css`, imported once from `app/layout.jsx`. No CSS modules, no Tailwind, no CSS-in-JS, no inline `style` attributes.

The stylesheet is layered in this order:

1. **Reset** — `box-sizing: border-box`, zeroed margins on `body`, headings, `p`, lists and `figure`, `img/svg/video { display:block; max-width:100% }`.
2. **Token layer (`:root`)** — colour roles (`--bg`, `--surface`, `--surface-raised`, `--border`, `--text`, `--text-muted`, `--accent`, `--accent-hover`, `--success`, `--warning`, `--danger`), a spacing scale `--space-1 … --space-16` (4/8/12/16/24/32/48/64), a type scale `--text-xs … --text-4xl` with matching leading tokens, radii (`--radius-sm/md/lg/full`), shadows (`--shadow-1/2/3`) and z-index tokens (`--z-dropdown 100`, `--z-sticky 200`, `--z-overlay 300`, `--z-modal 400`, `--z-toast 500`).
3. **Base typography** — bare `h1`–`h6` with `line-height: 1.15`, `text-wrap: balance` and asymmetric `margin-block` (top noticeably larger than bottom), `p` with `line-height: 1.6` and `text-wrap: pretty`, list, link, blockquote and code styling with visible focus states.
4. **Layout** — `.container` (max-width 1200px, auto inline margin, token padding), `.app-shell` grid (`auto 1fr auto`, min-height `100dvh`) and `.stack` / `.cluster` / `.grid` utilities that space children with `gap` only — never child margins, spacer divs or `<br>`.
5. **Components** — `.btn` (`--sm/--md/--lg`, ≥44px hit area, `--primary/--ghost/--danger` variants with hover/focus-visible/active/disabled states), `.field`, `.input`, `.select`, `.textarea`, `.card`, `.badge` status variants, `.table-wrap` with `overflow-x: auto`, `.modal`/`.modal__backdrop`, `.spinner`, `.empty-state`, `.skeleton` with reserved heights, `.stat-card` and `.chart`.

Additional constraints enforced across the codebase:

* Mobile-first with `min-width` breakpoints at **640 / 768 / 1024px**; everything works at **360px with no horizontal scroll**.
* `overflow-wrap: break-word` only on user-content containers (`.release-title`, `.campaign-name`, `.table td`) — never on `body`, `*`, headings, buttons, badges or numbers, and never `overflow-wrap: anywhere`.
* Truncating flex children get `min-width: 0` plus `text-overflow: ellipsis`.
* Transitions are under 200ms on specific properties (never `transition: all`), and a `@media (prefers-reduced-motion: reduce)` block disables motion.
* No hardcoded hex values outside `:root`, no magic pixel values, no ad-hoc z-index.
* Every data-reading view is wrapped in `AsyncView` so **loading**, **empty** and **retryable error** states are always explicit, and skeletons reserve fixed heights so the layout never reflows.
* Charts are dependency-free inline SVG that read their colours from CSS custom properties. No remote images anywhere — artwork is a CSS gradient derived from `release.artwork_color`.

---

## Project structure

```
claudesounds/
├── package.json                  Single root manifest (Next.js + Express)
├── next.config.js                reactStrictMode, poweredByHeader:false, NEXT_PUBLIC_API_URL
├── ecosystem.config.js           PM2 app definition for the Next.js production server
├── START.sh                      Install → build → start API + web in the background
├── .env.example                  Documented placeholder environment file
├── schema.sql                    MySQL 8 schema + seed data
├── README.md                     This file
│
├── server/                       Express API
│   ├── index.js                  App bootstrap: cors, session, routers, health, https/http listen
│   ├── config/
│   │   └── db.js                 mysql2/promise pool + checkDatabaseConnection
│   ├── middleware/
│   │   ├── auth.js               requireAuth, attachUser
│   │   └── errorHandler.js       notFound, errorHandler
│   ├── utils/
│   │   └── validate.js           isEmail, isOneOf, toInt, badRequest, validateBody…
│   ├── controllers/
│   │   ├── auth.controller.js        signup, login, logout, me
│   │   ├── releases.controller.js    list, get, create, update, delete, deliver
│   │   ├── publishing.controller.js  works + splits (must total 100%)
│   │   ├── campaigns.controller.js   campaigns with CTR / budget utilisation
│   │   └── analytics.controller.js   overview, timeseries, top releases, royalties
│   └── routes/
│       ├── auth.routes.js        → /api/auth
│       ├── releases.routes.js    → /api/releases
│       ├── publishing.routes.js  → /api/publishing
│       ├── campaigns.routes.js   → /api/campaigns
│       └── analytics.routes.js   → /api/analytics
│
├── app/                          Next.js App Router
│   ├── globals.css               THE single global stylesheet (imported once)
│   ├── layout.jsx                Root layout: metadata + AuthProvider + AppShell
│   ├── page.jsx                  Marketing landing page
│   ├── not-found.jsx             404 page
│   ├── login/page.jsx            Sign in
│   ├── signup/page.jsx           Create account
│   ├── dashboard/page.jsx        Stats, stream chart, recent releases, active campaigns
│   ├── releases/
│   │   ├── page.jsx              Catalogue with search + status filter
│   │   ├── new/page.jsx          Create release
│   │   └── [id]/page.jsx         Detail: tracks, deliveries, streams, edit/deliver/delete
│   ├── publishing/page.jsx       Works, splits, registration status
│   ├── marketing/page.jsx        Campaign management
│   └── analytics/page.jsx        Range selector, chart, top releases, royalties
│
├── components/
│   ├── layout/
│   │   ├── AppShell.jsx          header / main.container / footer grid
│   │   ├── SiteHeader.jsx        Sticky nav, active route, auth area, mobile menu
│   │   └── SiteFooter.jsx        Three link columns + blurb
│   ├── ui/
│   │   ├── Button.jsx  Field.jsx  Card.jsx  Modal.jsx  Table.jsx
│   │   ├── Badge.jsx   Spinner.jsx EmptyState.jsx AsyncView.jsx StatCard.jsx
│   ├── charts/
│   │   └── BarChart.jsx          Dependency-free inline-SVG bar chart
│   ├── releases/
│   │   ├── ReleaseCard.jsx       Gradient artwork tile + meta + status
│   │   └── ReleaseForm.jsx       Release + dynamic track rows
│   └── marketing/
│       └── CampaignForm.jsx      Campaign fields with date-order validation
│
└── lib/
    ├── api.js                    fetch client (credentials:'include', ApiError)
    ├── AuthProvider.jsx          Auth context: user, status, signup/login/logout/refresh
    ├── useRequireAuth.js         Redirects anonymous users to /login?next=…
    └── format.js                 Number, currency, date, duration and status formatters
```

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `ER_ACCESS_DENIED_ERROR` on start | Check `DB_USER` / `DB_PASSWORD` / `DB_HOST` in `.env` and that the user has rights on `DB_NAME`. |
| `/health/db` returns 500 | MySQL is unreachable or `DB_NAME` does not exist. Import `schema.sql` first. |
| Login succeeds but `/api/auth/me` returns 401 | The session cookie is not being stored. Ensure `SSL_ENABLED=true` in production (cookies need `secure` with `sameSite: 'none'`), and that `SESSION_COOKIE_DOMAIN` matches the shared parent domain (`.arx-app.com`). |
| CORS error in the browser console | The origin must be `https://*.arx-app.com` (or `localhost` when `NODE_ENV !== 'production'`). |
| Frontend calls the wrong host | `NEXT_PUBLIC_API_URL` is inlined at build time — change it and re-run `npm run build`. |
| Port already in use | Another process holds `4107`. Change `PORT` in `.env` for the API, or pass a different port to `next start`. |
| `EADDRNOTAVAIL` / cert errors on boot | Verify `SSL_CERT_PATH` and `SSL_KEY_PATH` exist and are readable, or set `SSL_ENABLED=false` and terminate TLS at a proxy. |

---

© ClaudeSounds. Built with Next.js, Express and MySQL.
# Integration Notes for claudesounds

## Overview

**ClaudeSounds** is a music distribution, publishing and marketing platform for independent artists and labels. Users upload releases, deliver them to streaming stores (Spotify, Apple Music, Amazon Music, YouTube Music, Deezer, Tidal), register publishing works and writer splits, run marketing campaigns across channels, and track streams, listeners and royalty statements.

The project is a **single repository with one root `package.json`** serving two processes:

| Layer | Technology | Entry point | Public URL (reference deploy) |
| --- | --- | --- | --- |
| Frontend | Next.js (App Router, JSX, server + client components) | `app/layout.jsx` | `https://claudesounds.arx-app.com` |
| Backend | Express 4 REST API | `server/index.js` | `https://claudesounds-api.arx-app.com:4107` |
| Database | MySQL 8 (`mysql2/promise` pool) | `schema.sql` | Configured via `DB_*` env vars |

Authentication is **session-based**: passwords are hashed with `bcrypt` (10 rounds), sessions are signed with `SESSION_SECRET` and persisted in MySQL through `express-mysql-session`. The session cookie is issued with `domain=SESSION_COOKIE_DOMAIN` (e.g. `.arx-app.com`), `httpOnly`, `sameSite: 'none'` and `secure` when TLS is enabled, so the browser app on one subdomain can authenticate against the API on another. Every browser request from `lib/api.js` sends `credentials: 'include'`.

Styling is deliberately constrained: **one global stylesheet**, `app/globals.css`, imported exactly once from `app/layout.jsx`. It defines a `:root` design-token layer (colour roles, spacing scale, type scale, radii, shadows, z-index) and all shared component classes (`.btn`, `.card`, `.input`, `.badge`, `.table-wrap`, `.modal`, `.skeleton`, …). There are no CSS modules, no Tailwind and no CSS-in-JS anywhere in the codebase. Shared primitives in `components/ui/` compose those global classes.

---

## Prerequisites

* **Node.js 18.17 or newer** (Next.js App Router requirement; Node 20 LTS recommended) and **npm 9+**.
  ```bash
  node -v
  npm -v
  ```
* **MySQL 8.0** server reachable from the API host, with a database and user you can create tables in. `utf8mb4` is required.
* **Build toolchain for `bcrypt`** — `bcrypt` is a native module. On Debian/Ubuntu:
  ```bash
  sudo apt-get install -y build-essential python3
  ```
  (If you prefer to avoid native compilation you may swap `bcrypt` for `bcryptjs` in `package.json` and update the import in `server/controllers/auth.controller.js`.)
* **PM2** (optional, for production process supervision):
  ```bash
  npm install -g pm2
  ```
* **TLS certificate + key** if you terminate HTTPS inside the Express process (see `SSL_*` variables). The reference deploy expects them at `/home/arx-app/backends/certs/`.
* `mysql` CLI client available on the machine that imports `schema.sql`.

---

## Installation

```bash
# 1. Clone / copy the project and enter it
cd /home/arx-app/backends/claudesounds

# 2. Install all dependencies (frontend + backend share one package.json)
npm install

# 3. Create your environment file from the documented template
cp .env.example .env
$EDITOR .env        # fill in DB_*, SESSION_SECRET, SSL_* and NEXT_PUBLIC_API_URL

# 4. Create the database (skip if it already exists)
mysql -h "$DB_HOST" -u root -p -e \
  "CREATE DATABASE IF NOT EXISTS claudesounds CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 5. Import the schema and demo seed data
mysql -h "$DB_HOST" -u "$DB_USER" -p "$DB_NAME" < schema.sql
```

`schema.sql` creates `users`, `sessions` (express-mysql-session compatible), `releases`, `tracks`, `store_deliveries`, `publishing_works`, `publishing_splits`, `campaigns`, `stream_stats` and `royalty_statements`, all with `ON DELETE CASCADE` foreign keys and supporting indexes. It then seeds one demo artist account, 4 releases with tracks and store deliveries, publishing works with splits, campaigns, 30 days of `stream_stats` and 3 royalty statements.

> **Important:** the seeded demo user's `password_hash` is a **placeholder bcrypt hash** (see the comment in `schema.sql`). Generate a real one before you rely on it, or just sign up through `/signup`:
> ```bash
> node -e "require('bcrypt').hash('your-password',10).then(console.log)"
> ```
> Then `UPDATE users SET password_hash='<hash>' WHERE email='<demo email>';`

Dependencies installed: `next`, `react`, `react-dom`, `express`, `cors`, `dotenv`, `mysql2`, `bcrypt`, `express-session`, `express-mysql-session`.

The `scripts` block in `package.json` is exactly:

```json
{
  "dev": "next dev -p 4107",
  "build": "next build",
  "start": "next start -p 4107",
  "server": "node server/index.js"
}
```

There is no `concurrently` — the web server and API are started as two separate processes.

---

## Environment Variables

All variables are read from `.env` (loaded by `dotenv` in `server/index.js` and by `START.sh`). `.env.example` documents each one with placeholder values and contains no real secrets. Never commit `.env`.

| Variable | Description | Example |
| --- | --- | --- |
| `PORT` | Port the Express API binds to (assigned by the deploy script). The API listens on `0.0.0.0:$PORT`. | `4107` |
| `NODE_ENV` | Node environment. Set to `production` on the server; controls stack-trace hiding in `server/middleware/errorHandler.js` and localhost CORS allowances. | `production` |
| `DB_HOST` | MySQL host name used by the `mysql2/promise` pool in `server/config/db.js`. | `db.internal.example.com` |
| `DB_USER` | MySQL user name. | `claudesounds` |
| `DB_PASSWORD` | MySQL password. | `your-secret-here` |
| `DB_NAME` | MySQL database name (must match the database `schema.sql` was imported into). | `claudesounds` |
| `SESSION_SECRET` | Secret used to sign the session cookie. Use a long random string; rotating it invalidates all existing sessions. | `change-me-to-a-long-random-string` |
| `SESSION_COOKIE_DOMAIN` | Cookie domain so the session cookie is shared across `*.arx-app.com` (frontend and API live on different subdomains). | `.arx-app.com` |
| `SSL_ENABLED` | Set to `'true'` to terminate TLS directly in the Express process. Also flips the session cookie to `secure: true`. | `true` |
| `SSL_CERT_PATH` | Absolute path to the TLS certificate file. | `/home/arx-app/backends/certs/certificate.crt` |
| `SSL_KEY_PATH` | Absolute path to the TLS private key file. | `/home/arx-app/backends/certs/private.key` |
| `SSL_CA_PATH` | Optional absolute path to a CA chain file. Omit if your certificate is self-contained. | `/home/arx-app/backends/certs/ca_bundle.crt` |
| `NEXT_PUBLIC_API_URL` | Public base URL of the ClaudeSounds API used by the browser. Inlined at build time via `next.config.js` and consumed by `lib/api.js`. | `https://claudesounds-api.arx-app.com:4107` |

**Notes**

* `NEXT_PUBLIC_API_URL` is baked into the client bundle during `npm run build`. If you change it you must rebuild — restarting is not enough. `next.config.js` falls back to `https://claudesounds-api.arx-app.com:4107`, and `lib/api.js` carries the same literal fallback.
* `SESSION_COOKIE_DOMAIN` must be a parent domain of **both** the frontend and API hostnames, otherwise the browser will drop the session cookie and every authenticated call returns `401 { "error": "Authentication required" }`.
* Because the cookie uses `sameSite: 'none'`, HTTPS is mandatory in any deployment where the frontend and API are on different origins.

---

## Running the Application

### Local development

Run the API and the Next.js dev server in **two terminals**.

```bash
# Terminal 1 — Express API (reads .env, hot restart via nodemon if you add it yourself)
npm run server

# Terminal 2 — Next.js dev server
npm run dev
```

For local work set in `.env`:

```
NODE_ENV=development
SSL_ENABLED=false
SESSION_COOKIE_DOMAIN=
NEXT_PUBLIC_API_URL=http://localhost:4107
```

The CORS callback in `server/index.js` allows `localhost` origins when `NODE_ENV !== 'production'`. Leave `SESSION_COOKIE_DOMAIN` empty locally so the cookie defaults to `localhost`.

> Both `npm run dev` and `npm run server` default to port `4107`. Locally, give the API a different `PORT` (e.g. `PORT=50108 npm run server`) and point `NEXT_PUBLIC_API_URL` at it, or run the Next.js dev server on another port with `npx next dev -p 3000`.

Health checks:

```bash
curl http://localhost:4107/health      # -> {"status":"ok"}
curl http://localhost:4107/health/db   # exercises checkDatabaseConnection()
```

### Production — one-shot script

`START.sh` is the canonical deploy entry point. It loads `.env`, installs dependencies, builds `.next`, then backgrounds both processes with logs in `logs/`:

```bash
chmod +x START.sh
./START.sh
```

It performs, in order:

1. `npm install --omit=dev || npm install`
2. `npm run build`
3. `mkdir -p logs` then `nohup node server/index.js > logs/api.log 2>&1 &`
4. `nohup npm run start > logs/web.log 2>&1 &`
5. Echoes both PIDs.

Tail the logs with `tail -f logs/api.log logs/web.log`.

### Production — PM2

`ecosystem.config.js` supervises the **Next.js web process**:

```bash
npm run build
pm2 start ecosystem.config.js
pm2 logs claudesounds
pm2 save
```

It runs `node_modules/.bin/next start` with `cwd: /home/arx-app/backends/claudesounds`, `NODE_ENV=production` and `PORT=4107`. Adjust `cwd` if you deploy elsewhere.

The Express API is **not** in `ecosystem.config.js`; start it via `START.sh`, or register it yourself:

```bash
pm2 start server/index.js --name claudesounds-api --cwd /home/arx-app/backends/claudesounds
pm2 save
pm2 startup      # generate the boot script
```

### API surface

All routes are mounted in `server/index.js`. Everything except `/health*` and the auth signup/login endpoints requires a valid session (`requireAuth` in `server/middleware/auth.js`).

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness — `{ status: 'ok' }` |
| `GET` | `/health/db` | Database ping via `checkDatabaseConnection()` |
| `POST` | `/api/auth/signup` | Create account, hash password, start session |
| `POST` | `/api/auth/login` | Verify bcrypt hash, start session |
| `POST` | `/api/auth/logout` | Destroy session, clear cookie |
| `GET` | `/api/auth/me` | Current user or `401` |
| `GET` / `POST` | `/api/releases` | List (with `status`/`search` params) / create |
| `GET` / `PATCH` / `DELETE` | `/api/releases/:id` | Detail (tracks + deliveries) / update / delete |
| `POST` | `/api/releases/:id/deliver` | Set `in_review`, queue store deliveries |
| `GET` / `POST` | `/api/publishing/works` | List works with split totals / create work + splits |
| `GET` / `PATCH` / `DELETE` | `/api/publishing/works/:id` | Detail / advance `registration_status` / delete |
| `GET` / `POST` | `/api/campaigns` | List (with derived CTR & budget utilisation) / create |
| `PATCH` / `DELETE` | `/api/campaigns/:id` | Update / delete |
| `GET` | `/api/analytics/overview` | 30-day totals + period-over-period deltas |
| `GET` | `/api/analytics/timeseries?days=N` | Zero-filled daily streams |
| `GET` | `/api/analytics/top-releases` | Top 5 by streams with platform breakdown |
| `GET` | `/api/analytics/royalties` | Royalty statements, newest first |

Unmatched paths hit `notFound` → `404 { "error": "Not found" }`; thrown errors hit `errorHandler` → `{ error, details? }` with the status from `err.status`/`err.statusCode` (default 500).

---

## Project Structure

```
claudesounds/
├── package.json              Single manifest for web + API; 4 scripts only
├── next.config.js            reactStrictMode, poweredByHeader:false, NEXT_PUBLIC_API_URL
├── ecosystem.config.js       PM2 app definition for `next start` on port 4107
├── START.sh                  install → build → background API → background web
├── .env.example              Every variable documented with placeholders
├── README.md                 Full product/architecture/API/design-system docs
├── schema.sql                MySQL 8 utf8mb4 schema + demo seed data
│
├── server/                   Express API
│   ├── index.js              App bootstrap: CORS, session store, routers, http/https listen
│   ├── config/db.js          mysql2/promise pool (limit 10, keepAlive, utf8mb4) + checkDatabaseConnection
│   ├── middleware/
│   │   ├── auth.js           requireAuth, attachUser
│   │   └── errorHandler.js   notFound, errorHandler
│   ├── utils/validate.js     isEmail, isNonEmptyString, isOneOf, toInt, isIsoDate, badRequest, validateBody
│   ├── controllers/          auth, releases, publishing, campaigns, analytics — parameterised SQL only
│   └── routes/               One router per domain, mounted under /api/*
│
├── app/                      Next.js App Router
│   ├── globals.css           THE single stylesheet: reset, :root tokens, typography, layout, components
│   ├── layout.jsx            Root layout; imports globals.css once; wraps AuthProvider + AppShell
│   ├── page.jsx              Marketing landing page
│   ├── not-found.jsx         404 page
│   ├── login/page.jsx        Session login, redirects to ?next or /dashboard
│   ├── signup/page.jsx       Account creation (artist/label)
│   ├── dashboard/page.jsx    StatCards, streams BarChart, recent releases, active campaigns
│   ├── releases/
│   │   ├── page.jsx          Catalogue with search + status filter
│   │   ├── new/page.jsx      ReleaseForm → api.releases.create
│   │   └── [id]/page.jsx     Detail: tracks, deliveries, deliver/edit/delete, 30-day chart
│   ├── publishing/page.jsx   Works, writer splits (must total 100%), registration status
│   ├── marketing/page.jsx    Campaign stats, filters, CampaignForm modal, campaigns table
│   └── analytics/page.jsx    Range selector, charts, top releases, royalty statements
│
├── components/
│   ├── layout/               AppShell (100dvh grid), SiteHeader (sticky + mobile menu), SiteFooter
│   ├── ui/                   Button, Field/Input/Textarea/Select, Card, Modal (portal + focus trap),
│   │                         Table, Badge/StatusBadge, Spinner, EmptyState, AsyncView, StatCard
│   ├── charts/BarChart.jsx   Dependency-free inline SVG, aspect-ratio box, token colours
│   ├── releases/             ReleaseCard, ReleaseForm (dynamic track rows)
│   └── marketing/            CampaignForm (rendered inside Modal)
│
└── lib/
    ├── api.js                fetch client; credentials:'include'; ApiError; never runs at module scope
    ├── AuthProvider.jsx      useAuth() context: user, status, signup/login/logout/refresh
    ├── useRequireAuth.js     Redirects anonymous users to /login?next=<path>
    └── format.js             Number, compact number, currency-from-cents, date, duration, % change helpers
```

**Conventions worth preserving**

* `app/globals.css` is imported in exactly one place (`app/layout.jsx`). Do not add a second stylesheet import, a CSS module, or an inline `style` attribute.
* No hardcoded hex values outside `:root`; no ad-hoc z-index values outside the `--z-*` tokens.
* Spacing comes from flex/grid `gap` and the heading `margin-block` rhythm — never spacer divs, `<br>`, or margins on flex children.
* Every data-reading view is wrapped in `components/ui/AsyncView.jsx`, so loading skeletons (fixed heights, no reflow), empty states and retryable errors are always explicit.
* `lib/AuthProvider.jsx` fetches `/api/auth/me` inside `useEffect` only; the build succeeds even when the API is offline.

---

## Next Steps / Production Considerations

**Security**

1. Replace `SESSION_SECRET` with a long random value: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. Store it in a secret manager, not in the repo.
2. Create a dedicated MySQL user restricted to `DB_NAME` with `SELECT, INSERT, UPDATE, DELETE` only — no `DROP`/`GRANT`. The pool sets `multipleStatements: false`; keep it that way.
3. Add rate limiting to `/api/auth/login` and `/api/auth/signup` (e.g. `express-rate-limit`) to blunt credential stuffing, and consider raising bcrypt cost from 10 to 12 as hardware allows.
4. Add `helmet` in `server/index.js` for security headers, and tighten the CORS origin callback from a `*.arx-app.com` wildcard to an explicit allow-list.
5. Verify certificate file permissions (`chmod 600` on `SSL_KEY_PATH`, owned by the service user) and automate renewal; the process must be restarted to pick up new certificates.

**Reliability & operations**

6. Put both processes under PM2 (`pm2 start ecosystem.config.js` plus a `claudesounds-api` app) with `pm2 save` and `pm2 startup` so they survive reboots. `START.sh` uses bare `nohup` and provides no restart-on-crash.
7. Rotate `logs/api.log` and `logs/web.log` with `logrotate` or `pm2-logrotate` — they grow unbounded.
8. Wire `/health` and `/health/db` into your uptime monitor and load-balancer health checks.
9. Prune the `sessions` table: `express-mysql-session` clears expired rows periodically, but add a monitoring query and an index check if session volume grows.
10. Schedule `mysqldump` backups of `DB_NAME` and rehearse a restore. Test schema changes against a copy before running them in production.

**Application maturity**

11. Replace `schema.sql` re-imports with a migration tool (e.g. `node-migrate` or Flyway) once the schema starts evolving; re-running the seed block will duplicate demo data.
12. Delete the seeded demo artist, releases, campaigns and `stream_stats` before going live, or gate them behind a `NODE_ENV !== 'production'` import step.
13. Real distribution requires actual DSP delivery — `POST /api/releases/:id/deliver` currently inserts `pending` rows for the six stores. Integrate real DDEX/partner APIs and a background worker that advances `store_deliveries.status` to `delivered`/`live`/`failed`.
14. Audio and artwork upload are out of scope today (artwork is a CSS gradient derived from `releases.artwork_color`). Adding real assets means object storage (S3-compatible), signed URLs, MIME/size validation and a CDN — plus a `next.config.js` `images` remote-pattern entry.
15. Add server-side ownership assertions to every new controller you write; the existing controllers scope all queries by `req.session.userId` and must stay that way. Keep all SQL parameterised.
16. Add automated tests (API integration tests against a throwaway MySQL database, plus a smoke test that each App Router page renders) and run `npm run build` in CI to catch client/server component boundary errors.

**Performance**

17. Put a reverse proxy (nginx/Caddy) in front of both processes for HTTP/2, gzip/brotli and static-asset caching of `.next/static`; you can then set `SSL_ENABLED=false` and terminate TLS at the proxy.
18. Watch `stream_stats` growth — the analytics queries aggregate over 30–90 day windows. Add a composite index on `(release_id, stat_date)` if it is not already sufficient, and consider nightly roll-up tables once row counts pass a few million.
19. Tune the pool `connectionLimit` (currently 10) against your MySQL `max_connections` and the number of API instances you run.

## Database Provisioning

A mysql database has been automatically provisioned for this app.

- **Database:** app_claudesounds
- **Host:** testdb.gridiron-app.com
- **Port:** 3306
- **User:** claudesounds
- **Credentials stored in Vault at:** `secret/data/mysql/claudesounds`

Retrieve the password securely from Vault and set it as an environment variable (e.g. `DB_PASSWORD`) in your deployment settings — do not commit it to source control.

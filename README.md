<p align="center">
  <img src=".github/readme-assets/banner.png" alt="CardGoose — board games for Print &amp; Play and Tabletop Simulator" width="100%" />
</p>

<p align="center">
  A tool to make board games for <strong>Print &amp; Play</strong> and <a href="https://www.tabletopsimulator.com/">Tabletop Simulator</a>.
</p>

---

## About

Designing board games is hard. It requires **rapid iteration** and the ability to make changes **on-the-fly**. CardGoose makes it easier with data-driven components and custom templates to build your ideas in minutes.

## Key Features

- Import data from Google Sheets & refresh for live updates
- Component layout editor for card design
  - Deck preview to evaluate changes
- Custom images (direct upload to Cloudflare R2)
- TTS export (coming soon)

# Getting started

## Stack

| Component | Service |
| --- | --- |
| Database | Supabase Postgres |
| Auth | Supabase Auth |
| Object storage | Cloudflare R2 |
| API | Express on Vercel Serverless |
| Frontend | Vite SPA on Vercel (`app.cardgoose.com`) |
| Landing | Cloudflare Workers |

## Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/) 9+
- Docker (optional — local Postgres via Compose)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (recommended for local auth)
- Cloudflare account with R2 bucket (for asset uploads)

---

## Local development

### 1. Environment

```bash
cp .env.local.example .env.local
cp frontend/.env.local.example frontend/.env.local
```

Fill in Supabase and R2 credentials. For local Supabase:

```bash
supabase start
# Copy API URL + anon key into .env.local and frontend/.env.local
```

### 2. Database

With Docker Postgres (port **5433**):

```bash
pnpm docker:up
pnpm migrate:deploy
```

Or point `DATABASE_URL` / `DIRECT_URL` at your Supabase local Postgres (port **54322**).

### 3. Run

```bash
pnpm dev:local
```

Or separately:

```bash
pnpm dev:api
pnpm dev:frontend
```

Open the URL Vite prints (usually `http://localhost:5173`).

Do **not** set `VITE_API_URL` when using the Vite dev proxy (`frontend/vite.config.ts` forwards `/api` → `localhost:3001`).

---

## Production setup

### Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Copy **Project URL**, **anon key**, and Postgres connection strings (`DATABASE_URL` with pooler, `DIRECT_URL` without).
3. Enable Google OAuth under Authentication → Providers if needed.

### Cloudflare R2

1. Create bucket `cardgoose`.
2. Create R2 API token with read/write on that bucket.
3. Set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.

### Vercel (two projects recommended)

**API project** — root directory `api`, uses `api/vercel.json`:

- `DATABASE_URL`, `DIRECT_URL`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- `R2_*` vars
- `CORS_ORIGIN=https://app.cardgoose.com`

**Frontend project** — root directory `frontend`, uses `frontend/vercel.json`:

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `VITE_API_URL` → your API Vercel URL

Run migrations against production once:

```bash
DATABASE_URL=... DIRECT_URL=... pnpm migrate:deploy:prod
```

Vercel auto-deploys from GitHub on push to `main`. CI runs lint, tests, and builds — see [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

---

## Environment files

| File | Purpose |
| --- | --- |
| [`.env.local.example`](.env.local.example) | Template → **`.env.local`** — API (Postgres, Supabase, R2) |
| [`frontend/.env.local.example`](frontend/.env.local.example) | Template → **`frontend/.env.local`** — Vite (Supabase client) |

---

## Checks

```bash
pnpm run format:check
pnpm -r run lint
pnpm test:all
pnpm --filter frontend build
```

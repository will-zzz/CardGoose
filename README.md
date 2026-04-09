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
- Custom images
- PDF export
- TTS export (coming soon)

# Getting started

## Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/) 9+
- Python 3.12+ recommended — for the PDF worker: `cd worker && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && playwright install chromium`
- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) — for **production** operations (e.g. Prisma against RDS); not needed for fully local dev
- Docker — **fully local** dev (Postgres + LocalStack)
- Terraform 1.9+ — **production** infrastructure ([`infra/envs/prod`](infra/envs/prod))

---

## Local development (recommended)

Develop against **Docker Postgres** and **LocalStack** (S3/SQS). No real AWS calls. When you are ready, **push to `main`** and [GitHub Actions](.github/workflows/ci.yml) builds and deploys to ECS.

| Piece | Where it runs locally |
| ----- | --------------------- |
| Frontend + API + worker | Your machine |
| Database | Docker Postgres (`localhost:5433`) |
| S3 / SQS | LocalStack (`localhost:4566`) |

The API container can serve the built SPA in production (`NODE_ENV=production`). Until you add a stable URL (ALB, CloudFront, etc.), you may use the task public IP for smoke tests.

### Setup

1. **One-time:** copy [`.env.local.example`](.env.local.example) to **`.env.local`** at the repo root. It sets LocalStack (`AWS_ENDPOINT_URL`), Docker Postgres on **5433**, and `cardgoose-*` buckets/queue names that match [`docker-compose.yml`](docker-compose.yml) and [`docker/localstack-ready.d/init-aws.sh`](docker/localstack-ready.d/init-aws.sh). Optional `CARDGOOSE_DEV_PROFILE=fully-local` makes the API exit on startup if values look like real AWS/RDS by mistake.

2. **Start the app** (Postgres + LocalStack, then API + Vite):

```bash
pnpm dev:local
```

Or start backing services only, then run processes yourself:

```bash
pnpm docker:up
pnpm migrate:deploy
pnpm dev:api
pnpm dev:frontend
```

`pnpm docker:up` and `pnpm docker:up:local` are equivalent (Postgres on **5433**, LocalStack on **4566**).

3. **First run / after schema changes:**

```bash
pnpm migrate:deploy
```

4. Open the URL Vite prints (often `http://localhost:5173`).

**PDF exports:** use `pnpm dev:local:worker` to run API + Vite + the Python worker together, or run the worker in another terminal (see [`worker/README.md`](worker/README.md)). Set `RENDER_URL` in `.env.local` to the exact origin Vite prints (including port). If the worker runs in Docker and Vite on the host, use something like `http://host.docker.internal:5173`.

Do **not** set `VITE_API_URL` in `frontend/.env.local` when the dev server should proxy `/api` and `/health` to `http://localhost:3001` (see [`frontend/vite.config.ts`](frontend/vite.config.ts)).

**Optional — UI only against a deployed API:** copy [`frontend/.env.local.example`](frontend/.env.local.example) to `frontend/.env.local`, set `VITE_API_URL` to your ECS task URL, run `pnpm dev:frontend`. You may need CORS configured on the deployed API for `http://localhost:5173`.

**Troubleshooting (local):** After a **Docker / LocalStack restart**, S3 buckets may be missing; the dev API **creates missing `S3_BUCKET_*` buckets** when `AWS_ENDPOINT_URL` points at LocalStack (**4566**). If you still see **`NoSuchBucket`**, seed manually, then restart `pnpm dev:local`:

```bash
aws --endpoint-url=http://localhost:4566 s3 mb s3://cardgoose-assets  2>/dev/null || true
aws --endpoint-url=http://localhost:4566 s3 mb s3://cardgoose-exports 2>/dev/null || true
aws --endpoint-url=http://localhost:4566 sqs create-queue --queue-name cardgoose-pdf-generation 2>/dev/null || true
```

Or: `docker compose restart localstack` (from the repo root, with compose services up).

---

## Production (AWS)

**Production** means the **API and worker run on ECS Fargate**, with **RDS, S3, and SQS** from Terraform. CI deploys on push to `main` (see [`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

1. **Infrastructure** — follow [infra/BOOTSTRAP.md](infra/BOOTSTRAP.md) and apply [`infra/envs/prod`](infra/envs/prod).

2. **Prisma against RDS (from your laptop)** — copy [`.env.production.example`](.env.production.example) to **`.env.production`** (never commit) with `DATABASE_URL` and AWS resource names matching Terraform outputs. Then:

```bash
pnpm migrate:deploy:prod
```

ECS tasks do **not** read `.env.production`; they get env from Terraform.

3. **Deploy** — push to `main`: lint, tests, Docker builds, ECR push, ECS rolling update. Run the same checks locally first: `pnpm run format:check`, `pnpm -r run lint`, `pnpm test:all`.

4. **Smoke** — `GET /health` on a running API task; `service` should be `cardgoose-api`. Confirm whether the API container runs migrations on startup so you do not apply twice ([`api/Dockerfile`](api/Dockerfile)).

---

## Environment files

| File                                                 | Purpose |
| ---------------------------------------------------- | ------- |
| [`.env.local.example`](.env.local.example)           | Template → **`.env.local`** — local dev (Docker Postgres + LocalStack). Used by `pnpm dev:local`, `pnpm dev:api`, `pnpm migrate:deploy`. |
| [`.env.production.example`](.env.production.example) | Template → **`.env.production`** — **only** for `pnpm migrate:deploy:prod` against RDS. |

The API loads **`.env.local`** via `dotenv-cli` on `pnpm dev` scripts. The worker loads **`.env.local`** when run locally ([`worker/README.md`](worker/README.md)).

If you still have a root **`.env`** from an older setup, merge into `.env.local` and remove `.env`.

**Docker Compose API:** `docker compose up api` runs `prisma migrate deploy` before `node` (see [`docker-compose.yml`](docker-compose.yml)).

---

## Checks

```bash
pnpm run format:check
pnpm -r run lint
pnpm test:all
cd infra && terraform fmt -check -recursive
cd infra/envs/prod && terraform init -input=false && terraform validate
```

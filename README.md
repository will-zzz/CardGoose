# ForgeCard (Cardboard Forge)

Board game prototyping engine: data-driven design, Print & Play PDFs, and Tabletop Simulator exports.

## Monorepo layout

| Path       | Description                          |
| ---------- | ------------------------------------ |
| `frontend` | Vite + React + Tailwind (dashboard)  |
| `api`      | Node.js API (Express, Prisma, AWS)   |
| `worker`   | Python "Baker" (Playwright rendering) |
| `infra`    | Terraform (AWS)                      |

## Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/) 9+
- Python 3.12+ (worker)
- Docker (local Postgres, LocalStack)
- Terraform 1.9+ (infrastructure)

## Quick start

```bash
pnpm install
pnpm dev:frontend
```

Local infrastructure (requires [Docker](https://docs.docker.com/get-docker/) running):

```bash
pnpm docker:up
# optional: build API + worker images
docker compose build
```

See [infra/BOOTSTRAP.md](infra/BOOTSTRAP.md) for AWS account and Terraform state setup.

## Checks

```bash
pnpm run format:check
pnpm -r run lint
pnpm test:all
cd infra && terraform fmt -check -recursive
cd infra/envs/dev && terraform init -input=false && terraform validate
```

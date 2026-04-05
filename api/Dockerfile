# Build from repository root:
#   docker build -f api/Dockerfile .
#
FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable pnpm
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY api/package.json api/
RUN pnpm install --frozen-lockfile --filter api...
COPY api ./api
WORKDIR /app/api
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN pnpm exec prisma generate && pnpm run build

FROM node:20-alpine AS production
# Prisma CLI for migrate deploy (pnpm’s .bin layout is not reliable here; pin to lockfile version).
RUN npm install -g prisma@6.19.3
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/api/dist ./api/dist
COPY --from=build /app/api/package.json ./api/package.json
COPY --from=build /app/api/prisma ./api/prisma
WORKDIR /app/api
EXPOSE 3001
CMD ["sh", "-c", "prisma migrate deploy && node dist/index.js"]

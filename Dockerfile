FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@10.29.2 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/tsconfig.json ./packages/shared/
COPY apps/api/package.json apps/api/tsconfig.json ./apps/api/

# Prisma reads these at generate time; Railway overrides them at runtime.
ENV DATABASE_URL="postgresql://splitbill:splitbill@localhost:5436/splitbill"
ENV DIRECT_URL="postgresql://splitbill:splitbill@localhost:5436/splitbill"

COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @splitbill/shared build && pnpm --filter @splitbill/api build

ENV NODE_ENV=production
EXPOSE 4000

CMD ["sh", "-c", "pnpm --filter @splitbill/api prisma:deploy && node apps/api/dist/index.js"]

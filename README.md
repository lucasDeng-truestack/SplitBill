# Receipt Bill Splitter

A mobile-first web assistant for splitting a restaurant receipt after a group meal.

Scan a receipt, review the extracted items, add the people who ate, then collect person by person. Amounts are calculated on the Express API — never by the UI, and never by the AI model.

```text
Web client (Next.js)
        ↓
Express API  /api/v1
        ↓
Domain (claims, matching, charge allocation)
        ↓
Prisma → PostgreSQL
```

A future Expo app should consume the same `/api/v1` contract in `packages/shared`.

## Requirements

- Node.js 22+
- pnpm 10+
- Docker (for PostgreSQL; this project maps it to host port **5436** so it does not collide with a local Postgres on 5432)

## Setup

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

pnpm install
pnpm db:up
pnpm db:migrate
```

Default parser is `mock`, so you can run the full flow without an OpenAI key. To use live vision:

```bash
# apps/api/.env
RECEIPT_PARSER=openai
OPENAI_API_KEY=sk-...
OPENAI_RECEIPT_MODEL=gpt-4o
```

## Run

```bash
pnpm dev
```

- Web: http://localhost:3030
- API: http://localhost:4000/health

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | API + web |
| `pnpm test` | unit tests |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript |
| `pnpm build` | production build |
| `pnpm db:up` | start Postgres |
| `pnpm db:migrate` | Prisma migrate |

## Money

All amounts are stored as **integer sen** (minor units). `RM 4.50` → `450`. Conversion happens at the API boundary. Domain math never uses floating point.

## Charge allocation

Person item subtotal uses `quantity × unitPriceCents`.

Each receipt-level amount (service charge, tax, discount, rounding) is split with:

```text
floor(amount × personSubtotal / receiptItemSubtotal)
```

Leftover sen are distributed with the largest-remainder method so person shares plus the unassigned bucket equal the receipt amount exactly.

Unassigned remaining items keep their proportional share of charges.

AI output is validated, then a human must review it. AI never computes who owes what.

## API

Base path: `/api/v1`

- `POST /receipts` multipart `image` (or `manual=true` for an empty receipt)
- `GET /receipts` recent bills
- `GET /receipts/:id`
- `PATCH /receipts/:id` review edits and status
- `POST|PATCH|DELETE /receipts/:id/items`
- `POST|PATCH|DELETE /receipts/:id/people`
- `POST /receipts/:id/assignments` `{ personId, itemId, quantity }`
- `DELETE /receipts/:id/assignments/:assignmentId`
- `POST /receipts/:id/match` `{ query }`
- `GET /receipts/:id/summary`
- `POST /receipts/:id/complete` `{ allowUnassigned }`

Errors:

```json
{ "error": { "code": "OVER_ALLOCATION", "message": "..." } }
```

## Deploy

Production split:

| Piece | Host |
| --- | --- |
| Web | Vercel (`apps/web`) |
| API | Railway (Docker image at repo root) |
| Postgres | Neon |
| Receipt photos | Private Cloudflare R2 bucket |
| Vision | OpenAI (`gpt-4o`) |

OpenAI must have **billing credits**, or receipt photos will fail.

### 1. Neon

Create a project. Copy both connection strings (`sslmode=require`):

- `DATABASE_URL` — pooled
- `DIRECT_URL` — unpooled / direct (Prisma migrations)

### 2. Cloudflare R2

Create a **private** bucket (receipts can include card numbers). Create an S3 API token with object read/write. You need:

- `R2_ACCOUNT_ID`
- `R2_BUCKET`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

Do not attach a public custom domain.

### 3. Railway (API)

New service from this GitHub repo. Builder: **Dockerfile** (root `Dockerfile`). Health check: `GET /health`.

Environment:

```text
NODE_ENV=production
DATABASE_URL=
DIRECT_URL=
WEB_ORIGIN=https://<your-vercel-app>.vercel.app
ALLOW_VERCEL_PREVIEWS=true
RECEIPT_PARSER=openai
OPENAI_API_KEY=
OPENAI_RECEIPT_MODEL=gpt-4o
STORAGE=r2
R2_ACCOUNT_ID=
R2_BUCKET=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
```

Railway injects `PORT`. The image runs `prisma migrate deploy` then the API. After the first deploy, copy the public API URL (no trailing slash).

### 4. Vercel (web)

Import the same GitHub repo.

- Framework: Next.js
- Root Directory: `apps/web`
- Environment: `NEXT_PUBLIC_API_URL=https://<railway-api-host>` (no trailing slash)

Redeploy after setting the API URL. Then put the Vercel origin into Railway `WEB_ORIGIN` and redeploy the API if you had a placeholder.

Preview deploys need `ALLOW_VERCEL_PREVIEWS=true` on Railway so `*.vercel.app` can call the API.

## MVP limitations

- No login; possession of a receipt UUID is access.
- Local development stores images on disk (`apps/api/uploads`). Production stores them privately in R2.
- No voice or natural-language claims.
- No equal-split shared items in the UI (schema can grow later).

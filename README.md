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

## MVP limitations

- No login; possession of a receipt UUID is access.
- Images stored on local disk (`apps/api/uploads`).
- No voice or natural-language claims.
- No equal-split shared items in the UI (schema can grow later).

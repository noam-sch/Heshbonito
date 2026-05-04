# Heshbonito (חשבונית׳ו)

Israeli accounting / invoicing app. Forked from [Invoicerr](https://github.com/Impre-visible/invoicerr) and adapted for the Israeli context — ILS as the default currency, Hebrew-aware UI, and standalone receipts (קבלות) that can be issued without a prior invoice (חשבונית), as Israeli accounting practice allows.

**Stack:** NestJS + Prisma + PostgreSQL on the backend, React + Vite + Tailwind + shadcn/ui on the frontend.

---

## Running it

The whole local dev environment is wrapped in `start.sh`. Run it from the active worktree:

```bash
cd .claude/worktrees/suspicious-heyrovsky
./start.sh
```

> **Where edits should land.** Active development happens in the git worktree at `.claude/worktrees/suspicious-heyrovsky/` (branch `claude/suspicious-heyrovsky`). `start.sh` resolves all paths relative to itself, so it runs the app from the worktree's `backend/` and `frontend/` — **not** from the top-level checkout. Edit files inside the worktree (or copy edits there) if you want them to take effect. Running `git worktree list` shows the layout.

That script:

1. Starts PostgreSQL via Homebrew (`brew services start postgresql@17`). Postgres binaries are expected at `/opt/homebrew/opt/postgresql@17/bin`.
2. Installs backend and frontend deps if `node_modules` is missing.
3. Runs `npx prisma migrate deploy && npx prisma generate` so any new migrations are applied and the typed client is regenerated.
4. Starts the backend (`npm run start:dev` on port 3000) and frontend (`npm run dev` on port 5173).
5. Opens `http://localhost:5173` in the browser.

Press `Ctrl+C` to stop everything.

You don't need a `backend/.env` for normal use — `DATABASE_URL` is expected to be available in your shell environment (the local Postgres uses your macOS user with no password by default, which Prisma reads from your shell env). If you ever need to run Prisma commands by hand, export `DATABASE_URL` first or copy `backend/.env.example` to `backend/.env`.

### Where the data lives

PostgreSQL on the local machine, managed by Homebrew. Data files are wherever Homebrew's `postgresql@17` formula puts them (`/opt/homebrew/var/postgresql@17` on Apple Silicon). **It is not Dockerized** — the `docker-compose.yml` files in this repo are inherited from upstream Invoicerr and aren't part of the local workflow.

### Migrations

Migrations live in `backend/prisma/migrations/`. Create new ones with `npx prisma migrate dev --name <description>` (from `backend/`). They get applied automatically on the next `start.sh` run.

The Prisma schema is `backend/prisma/schema.prisma`. The generated client lands in `backend/prisma/generated/prisma/` — always regenerate after schema edits (`start.sh` does this, or `npm run generate` from `backend/`).

---

## Project layout

```
backend/                     NestJS app
  src/
    modules/                 One folder per feature (clients, invoices, quotes, receipts, ...)
    main.ts                  Entry point, listens on :3000
  prisma/
    schema.prisma            Single source of truth for the DB schema
    migrations/              SQL migrations, applied in order
frontend/                    Vite + React app, listens on :5173
  src/
    pages/(app)/             Authenticated app pages
    components/              Shared UI (incl. CurrencySelect, BetterInput, etc.)
    types/                   TypeScript interfaces shared across pages
    locales/                 i18n JSONs (en, fr, de, es, nl)
e2e/                         Cypress e2e tests (not part of the local dev loop)
start.sh                     The local dev launcher
```

---

## Heshbonito-specific deviations from upstream Invoicerr

- **Default currency is ILS** (was EUR). Schema default + form defaults across company / client / invoice / quote / receipt / recurring-invoice. The full currency list is still selectable.
- **Standalone receipts.** `Receipt.invoiceId` is nullable, and a receipt can be issued from scratch with just a client, a currency, and free-form items. The PDF generator and email sender resolve client/company/currency from the receipt's own direct relations when there's no invoice.
- **Hebrew UI accommodations** are an in-progress concern; treat them as first-class when you touch UI strings.

---

## Conventions worth knowing

- **Search endpoints have an inconsistent shape.** `/api/invoices/search?query=` returns a paginated `{ pageCount, invoices }` object when `query` is empty, but a flat `Invoice[]` when `query` is set. `/api/clients/search` and similar follow the same pattern. Code consuming them must normalize (see `pages/(app)/receipts/_components/receipt-upsert.tsx` for the pattern).
- **Receipts can be invoice-linked or standalone.** Backend code branches on `body.invoiceId` in `ReceiptsService.createReceipt`. Don't assume a receipt has an invoice — always optional-chain `receipt.invoice?.…` and fall back to `receipt.client` / `receipt.company` / `receipt.currency`.
- **Webhooks dispatch fire-and-forget.** All webhook calls in `*.service.ts` are wrapped in try/catch so a misconfigured webhook never breaks the main operation.

---

## License

Inherited from upstream Invoicerr — dual-licensed AGPL-3.0 / commercial. See `LICENSE` and `LICENSE.COMMERCIAL.md`.

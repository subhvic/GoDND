# GoDND — Travel SaaS + Marketplace

A multi-tenant platform for travel companies: a portal to build and sell
**Experiences**, a curated GoDND marketplace, and a white-label consumer site
for each operator on their own domain.

- **Architecture & decisions** → [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- **Figma teardown & open scope questions** → [`docs/FIGMA-TEARDOWN.md`](docs/FIGMA-TEARDOWN.md)

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase (Postgres, Auth,
Storage, Realtime) · Razorpay.

## Getting started

```bash
cp .env.example .env.local     # fill in Supabase + Razorpay keys
npm install
npm run dev
npm run supabase:check         # verify Postgres is reachable
```

To connect a Supabase project end-to-end, see the runbook: [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md).

Local multi-tenancy uses `*.localhost`, so the three surfaces are reachable as:

| Surface | URL |
|---|---|
| Marketplace | `http://localhost:3000` |
| Operator portal | `http://app.localhost:3000` |
| A tenant's site | `http://<agency-slug>.localhost:3000` |

## Database

Migrations live in `supabase/migrations/` and apply in order. They have been
verified against PostgreSQL 16 with a stubbed `auth` schema; RLS tenant
isolation is covered by a smoke test.

```bash
supabase db reset     # or: psql -f each migration in order
```

Every table carries `agency_id` and ships with an RLS policy in the same
migration. A table without RLS is a cross-tenant data leak, so this is not
optional.

# Deploying to Vercel

**TL;DR** — Import the repo once, and every push to
`claude/dazzling-sagan-g1m5u2` gets its own preview URL you can open on a
phone. No environment variables are needed to see the UI; the app runs on
sample data and says so in a banner.

---

## One-time setup

1. Go to [vercel.com/new](https://vercel.com/new) and import **subhvic/GoDND**.
2. Framework preset resolves to **Next.js** on its own. Leave the build and
   install commands alone — `vercel.json` sets them.
3. Deploy. Nothing else is required for a first look.

That's it. Vercel then builds every branch push and comments the preview URL on
the commit.

## Opening a preview

A preview is served from a generated host like
`godnd-git-claude-dazzling-abc123.vercel.app`, which matches none of the
production domains. `resolveTenant` detects this and puts the deployment into
**preview mode**, where all three surfaces are reachable by path from the one
URL:

| Surface | Path on a preview |
|---|---|
| Operator portal | `/dashboard/experiences` |
| Marketplace | `/` |
| A tenant's site | `/sites/<agency-slug>` |

Production never takes that branch: `VERCEL_ENV=production` disables it, so the
real deployment still enforces host-based routing and `/dashboard` stays
unreachable from the marketplace domain.

## If the deploy fails with "Environment variable … is invalid"

Vercel reserves the **`VERCEL_` prefix** for the system variables it injects
itself (`VERCEL_ENV`, `VERCEL_URL`, `VERCEL_PROJECT_ID` and friends). Creating
your own variable with that prefix is rejected.

If you copied `.env.example` into the Vercel dashboard wholesale, delete these
three from **Project → Settings → Environment Variables** and redeploy:

- `VERCEL_PROJECT_ID`
- `VERCEL_TEAM_ID`
- `VERCEL_API_TOKEN`

They are only needed much later, for attaching operator custom domains, and
are now named `DOMAINS_VERCEL_*` in `.env.example` so they no longer collide.

**Nothing in `.env.example` is required for the first deploy.** The simplest
fix is to remove every variable and deploy with none — the app runs on sample
data and tells you so.

## Connecting real data (optional)

The UI renders without any of this. Add them when you want live experiences:

| Variable | Where it comes from | Scope |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | All |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page | All |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page — **server only** | All |
| `NEXT_PUBLIC_ROOT_DOMAIN` | `godnd.co` | Production |
| `NEXT_PUBLIC_TENANT_DOMAIN` | `godnd.site` | Production |

Set the service-role key as a **plain (non-public) variable**. It bypasses RLS
entirely; anything prefixed `NEXT_PUBLIC_` is compiled into the browser bundle,
and that key in a browser bundle is a full database compromise.

Then apply the migrations to the Supabase project, in order:

```bash
supabase link --project-ref <ref>
supabase db push          # applies supabase/migrations/*.sql
```

## Production domains

Once you're ready to point real domains at it:

1. Add `godnd.co` and `portal.godnd.co` to the Vercel project.
2. Add `*.godnd.site` as a **wildcard domain** — this is what gives every
   operator a free subdomain with one certificate.
3. Operator custom domains are attached per-tenant through the Vercel Domains
   API after TXT verification; see `docs/ARCHITECTURE.md` §2.

A wildcard domain on Vercel requires the domain's nameservers to point at
Vercel, not just a CNAME. Worth knowing before you move `godnd.site`.

## Running the end-to-end tests

```bash
npm run test:e2e
```

Playwright builds the app and starts it on port 3210 with `VERCEL_ENV=production`
and **no Supabase keys**. That combination is deliberate: it is exactly the
configuration that once shipped broken, and `next dev` on `portal.localhost`
hides the failure.

Two suites:

- `tests/deploy-smoke.spec.ts` sends real `Host` headers at the running server
  and asserts each surface resolves — including that an unrecognised domain
  degrades instead of returning 500, and that the marketplace domain still
  cannot reach `/dashboard`.
- `tests/wizard.spec.ts` covers the Add New Experience wizard: validation
  gates, draft persistence, and the consent regression (reading a policy must
  never agree to it).

**If tests fail in ways that make no sense**, check for a stale server first:

```bash
pgrep -fa next-server        # should be empty before a run
```

`reuseExistingServer` is on outside CI, so a server left running from an
earlier build will be reused and serve stale chunks — which looks like a code
failure and is not one.

In CI, install the browser first:

```bash
npx playwright install --with-deps chromium
npm run test:e2e
```

## Verifying the database layer

The wizard's persistence is a Postgres function, so it is tested in Postgres
rather than through the app — no Supabase project required:

```bash
createdb godnd_verify
psql -d godnd_verify -f supabase/tests/00_auth_stub.sql
for f in supabase/migrations/*.sql; do
  psql -v ON_ERROR_STOP=1 -d godnd_verify -f "$f"
done
psql -d godnd_verify -f supabase/tests/draft-persistence.sql
```

The test runs in a transaction and rolls back, so it is safe to re-run. It
pins the properties that matter: the fan-out across ten tables is atomic,
rupees become paise exactly once, re-saving replaces child rows instead of
duplicating them, submitting writes the approval-history row, and another
agency can neither read nor write the draft.

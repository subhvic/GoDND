# Supabase — one-time connection

Once this is done, the "Sample data" banner goes away, saves persist across
devices, and the wizard's Save-as-Draft round-trips through Postgres.

Time: **~10 minutes**, once, per environment.

## 1. Create the Supabase project

1. Go to <https://supabase.com/dashboard> and create a new project. Pick a
   region close to your users (Mumbai / Singapore for India-facing traffic).
2. Set a strong database password and store it in a password manager — you
   won't need it in the app, but you'll want it later for direct DB access.
3. Wait for the project to finish provisioning (usually a minute).

## 2. Copy the two keys

From the project's **Project Settings → API**:

- `Project URL` → this becomes `NEXT_PUBLIC_SUPABASE_URL`.
- `Project API keys → anon (public)` → this becomes
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`. It's safe to expose; the app already ships
  it in the client bundle.
- `Project API keys → service_role (secret)` → this becomes
  `SUPABASE_SERVICE_ROLE_KEY`. **Never commit it, never share it in chat,
  never paste it into a client component.** It bypasses row-level security
  and only lives on servers.

## 3. Run the migrations

The schema lives in `supabase/migrations/`. Two ways to apply it:

### Option A — Supabase Studio (fastest for one project)

For each `*.sql` file, in order, open the **SQL editor** in the Studio,
paste the file's contents, and run it:

1. `0001_foundation.sql` — tenancy, profiles, plans, domains.
2. `0002_experiences.sql` — the experiences model + taxonomy.
3. `0003_commerce.sql` — bookings, payments, invoices.
4. `0004_sites.sql` — operator sites + tenant hosts.
5. `0005_experience_drafts.sql` — the wizard's draft-persistence RPCs.

### Option B — Supabase CLI (repeatable, better for multiple envs)

```sh
# One-time: link the local repo to the Supabase project
npx supabase link --project-ref <your-project-ref>

# Push every migration in supabase/migrations, in order
npx supabase db push
```

## 4. Fill in `.env.local`

Create `.env.local` at the repo root (it's git-ignored). Copy from
`.env.example` and fill in these three lines with the values from step 2:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

The service role key stays local only if you're running webhook / payout
work in dev. Otherwise leave it blank locally and put it on Vercel only.

## 5. Verify the wiring

```sh
npm run supabase:check
```

Expected output for a good setup:

```
Supabase connection check

  ✓ NEXT_PUBLIC_SUPABASE_URL → https://xxxxxxxx.supabase.co
  ✓ NEXT_PUBLIC_SUPABASE_ANON_KEY → eyJhbGci…iOiJKV1
  ◦ SUPABASE_SERVICE_ROLE_KEY is not set locally — that's fine; keep it in Vercel only.
  ✓ Read reached Postgres and returned successfully.

Connection is wired.
```

If the check fails, it says what's wrong. The three common failures:

- `NEXT_PUBLIC_SUPABASE_URL is not set` — you missed step 4.
- `Connected, but the "agency" table doesn't exist` — you skipped step 3.
- `Auth error … the anon key might be from a different project` — the URL
  and the anon key don't come from the same project. Re-copy both from the
  same **Project Settings → API** page.

## 6. Restart the dev server, and check the app

```sh
npm run dev
```

Open `/dashboard/experiences`. The "Preview with sample data" notice should
be gone; the list should be empty (no rows yet) with the empty state visible.

## 7. Wire the deployed environment

On Vercel, **Settings → Environment Variables**, add the same three keys.
Set them for Production, Preview, **and** Development so previews connect
too. Trigger a redeploy. The banner will go away on the deployment as well.

## 8. Turn on email sign-in

The portal signs operators in with their email address and a six-digit code
(`/login`). Once the keys are set, every `/dashboard` URL redirects there until
there is a session, and back to where the operator was going afterwards.

1. **Authentication → Providers → Email**: enabled (the default).
2. **Authentication → Email Templates → Magic Link**: the body must contain
   `{{ .Token }}` — for example, *"Your GoDND Portal code is {{ .Token }}. It
   expires in 10 minutes."* Supabase's default template sends a link instead,
   and an operator who receives a link has no code to type.
3. **Authentication → Providers → Email → Email OTP Expiration**: 600 seconds
   is plenty; the default hour is longer than a code needs to live. Keep the
   OTP length at 6 — the login screen draws six boxes.
4. **Authentication → SMTP Settings**: add your own SMTP provider before
   launch. The built-in sender is for trying things out and only sends a
   handful of emails an hour, across the whole project.
5. **Accounts are invited, never self-created.** The login page asks for a
   code with `shouldCreateUser: false`, so an unknown address simply receives
   nothing (the screen doesn't say whether the address exists — that would let
   anyone probe for operator emails). Create operators under **Authentication
   → Users → Invite user**, then give them an `agency_members` row.

Without the keys, the portal runs as a walkable preview instead: the dashboard
stays open, and `/login` accepts the code **123456** without sending anything.

## Troubleshooting

- **The check passes locally but the app still shows the banner.**
  Restart `next dev`. Env vars are only read at process start.
- **`Failed to fetch` in the browser.**
  Check the browser console; if it's a CORS error, add the deployment origin
  to `Project Settings → API → CORS`. Vercel preview URLs need a wildcard
  entry (`*.vercel.app`) or a per-preview add.
- **RLS denies every query.**
  Expected in a fresh project until an operator profile exists. Invite the
  operator (step 8), sign in at `/login`, and make sure their
  `agency_members` row is `active` — RLS scopes every read to it.

# GoDND — Platform Architecture

**TL;DR** — One Next.js app serves three audiences off three host shapes: the
operator dashboard (`app.godnd.co`), the GoDND marketplace (`godnd.co`), and
every travel company's own white-label site (`{slug}.godnd.site` or their own
domain). Supabase Postgres holds a single multi-tenant schema, isolated by RLS
on `agency_id`. Money is integer paise. The product object is an **Experience**
(the handoff file's word), and its visibility runs on three independent axes —
review status, live-on-own-site, listed-on-marketplace. Keeping those separate is
the core modelling decision.

---

## 1. Why one app instead of three

Three deployments would mean three auth setups, three copies of the experience
renderer, and a permanent drift problem between how a trip looks on the
marketplace and on the operator's site. A single app with host-based rewrites
gives us one component library, one session model, and one deploy — and the
tenant sites still get genuinely clean URLs on their own domains, because the
tenant lives in the Host header rather than the path.

| Host | Rewrites to | Audience |
|---|---|---|
| `app.godnd.co` | `/_dashboard/*` | Travel company staff |
| `godnd.co` | `/*` | Travellers browsing the marketplace |
| `{slug}.godnd.site` | `/_sites/{slug}/*` | That operator's customers |
| `theirdomain.com` | `/_sites/{slug}/*` | Same, on their own domain |

`src/proxy.ts` does the resolution; `src/lib/tenant/resolve.ts` holds the
logic and a 60-second cache, because a custom-domain lookup is a database round
trip on every single request and must not sit on the critical path uncached.

---

## 2. Custom domains — your direct question

> *"How can I provide them a linked website with their choice of domain?"*

Three tiers, and I'd ship them in this order:

**Tier 1 — free subdomain (day one).** Every agency gets `{slug}.godnd.site`
the moment they sign up. One wildcard DNS record (`*.godnd.site`) and one
wildcard TLS certificate cover all tenants forever. Zero per-operator work.

Use a **separate apex** (`godnd.site`) from the SaaS itself (`godnd.co`). If
tenant sites live on subdomains of your primary domain, any operator who gets
flagged for spam or thin content damages the SEO and email reputation of your
own marketplace. Keeping them on a different registrable domain firewalls that.

**Tier 2 — custom domain (gated to a paid plan).** The operator points their
domain at us and we attach it:

1. Operator enters `wanderbeyond.in` in **Settings → Domain**. We insert an
   `agency_domains` row (`status = 'pending'`) with a random
   `verification_token`.
2. We show two records to add at their registrar:
   - `TXT  _godnd-verify.wanderbeyond.in  →  {token}` (proves ownership)
   - `CNAME www → cname.vercel-dns.com`, plus an `A` record for the apex
     (apex CNAMEs are not valid DNS; ALIAS/ANAME where the registrar supports it)
3. A verification job resolves the TXT record. On success → `status = 'active'`,
   and we call the Vercel Domains API to attach the host to the project, which
   provisions a Let's Encrypt certificate automatically.
4. The proxy now resolves that host to the agency, and the site is live.

The ownership check is not optional. Without it, anyone could claim a domain
they don't control and have our edge serve content on it.

**Tier 3 — we sell them the domain.** A registrar reseller API (or a manual
concierge flow at first) so a non-technical operator never touches DNS. This is
a real retention lever — an operator whose domain is billed through you does not
churn casually — but it is a month-two feature, not a launch blocker.

**What I'd flag:** apex-domain support is the sharp edge. Many Indian
registrars (BigRock, GoDaddy India) don't support ALIAS records, so
`wanderbeyond.in` without `www` needs an A record pointing at a static edge IP,
and that IP has to stay stable. Plan for the support burden — budget a
"check my DNS" diagnostic screen in the dashboard that shows live resolved
records against expected ones. It will halve your support load.

---

## 3. Data model — the decisions worth knowing

**Tenancy.** `agencies` is the tenant. Every business table carries `agency_id`
and is guarded by RLS policies built on four `SECURITY DEFINER` helpers:
`is_agency_member()`, `has_agency_role()`, `is_platform_admin()`,
`auth_agency_ids()`. Policies never query `agency_members` directly, which would
recurse into that table's own RLS.

**Vocabulary follows the design.** The product is an **Experience**; the
itinerary is the day-by-day plan inside one (step 2 of the 7-step builder). See
`docs/FIGMA-TEARDOWN.md` for the full reconciliation.

**Three visibility axes.** This is the modelling decision everything else hangs
off, and it is exactly your "star mark to list, or keep it to themselves":

```
experiences.status              draft | under_review | active | disabled
                                | archived | rejected     (the Figma tabs)
experiences.list_on_own_site    -> live on the OPERATOR's white-label site?
experiences.list_on_marketplace -> live on the GoDND marketplace?
```

The handoff file has only the first axis — the two booleans are my addition, and
the gap I most want your decision on. Collapsing them breaks the moment an
operator wants a trip on their site but not on yours, which is most of them for
their best-margin products. `under_review` and `rejected` matter because you need
a review gate: an unmoderated marketplace fills with low-quality listings within
weeks and your brand absorbs the damage.

**Booking snapshots.** `bookings.experience_snapshot` freezes the trip at the
moment of booking. If an operator edits the experience in March, a January
booking must not silently change what was sold. This is a legal requirement as
much as a product one.

**Money.** Integer minor units (paise) throughout — `total_minor`,
`commission_minor`. Floats in a billing system produce invoices that are off by
a rupee and finance disputes that cost more than the rupee.

**Commission.** `bookings.is_marketplace` is the single switch. Marketplace
booking → GoDND collects, `commission_minor` accrues to the platform, the
remainder becomes a `payouts` row. Website booking → operator collects directly,
commission is zero, and you earn only subscription revenue. Razorpay **Route**
handles the split at settlement so you're not holding operator funds as an
unlicensed escrow — worth a legal read before launch.

**Per-tenant reference numbers.** `ENQ-000142`, `BKG-000087`, assigned by a
counter table inside the inserting transaction. Operators put these in emails
and on invoices; globally-sequential IDs would leak your total volume to every
customer.

---

## 4. Module map

| Module | Designed in Figma? | Status |
|---|---|---|
| Tenancy, auth, roles, plans | Partly (Settings, My Team) | Schema verified |
| Experiences + 7-step builder | **Yes, in depth** | Schema verified; UI next |
| Approval pipeline + revisions | **Yes** | Schema verified |
| Bookings, Insights, Transactions | **Yes** | Schema verified |
| Marketplace star-marking | **No — gap 1** | Schema ready, needs design |
| Enquiries + realtime chat | **No — gap 2** | Built from the system (see FIGMA-TEARDOWN §2) |
| White-label site + theming | **No — gap 3** | Schema ready, needs design |
| Custom domains | **No — gap 3** | Schema + proxy done |
| GST invoices | **No — gap 4** | Schema ready, needs design |
| Subscriptions & entitlements | **No — gap 5** | Schema ready, needs design |

Design tokens are taken from the Figma variables, not eyeballed: primary
`#007F6A`, dark `#071D18`, accent `#02E28C`, a five-step neutral ramp, Roboto at
12/16/20. The one addition I'd make is a display size (28/36) for metric tiles —
the ramp tops out at 20, which leaves Insights with no way to make a headline
number read as one.

**Theming is tokens, not CSS.** `agency_sites` stores a bounded set of design
tokens (colours, two font choices, radius scale, density, layout variants)
rendered as CSS custom properties. Letting operators paste arbitrary CSS would
make WCAG AA unenforceable across tenant sites and turn every support ticket
into a CSS debugging session. Colour choices get contrast-validated in the
editor before save.

---

## 5. Conventions

- Money: `*_minor` integer columns, never floats.
- Timestamps: `timestamptz`, always.
- New tables carry `agency_id` + an RLS policy in the same migration. No
  exceptions — a table shipped without RLS is a cross-tenant data leak.
- The service-role client (`src/lib/supabase/admin.ts`) is confined to webhooks,
  scheduled jobs, and host resolution. It must never be reachable from a route
  that accepts user-supplied filters.
- Accessibility: WCAG AA is the floor on both the dashboard and tenant sites.
  `experience_media.alt_text` exists for that reason and is required in the form
  layer.

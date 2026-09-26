# Grow — social media management

How the Grow section is put together, what is actually built, and what is left.

---

## Why this belongs in GoDND at all

Buffer, Later and Hootsuite already schedule posts, and they do it well. GoDND
should not try to beat them at scheduling. It has one thing none of them has:

**the content already exists, structured.**

When an operator publishes an experience, GoDND holds the title, the itinerary
day by day, the regions, the group size, the price, the next departure date and
the photos. A generic scheduler starts every post from an empty box. GoDND can
start from the trip.

It also closes the loop that generic tools cannot: they know a link was
clicked; GoDND knows whether that click became a booking. Return on ad spend is
only computable on this side of the wall.

So the section is worth building where it touches those two facts — drafting
from an experience, and attributing bookings — and worth keeping thin
everywhere else.

---

## Categorisation

Five destinations under a `GROW` nav group, sitting between doing the work
(Workspace) and measuring the business (Analyze). Each maps to one question an
operator brings:

| Item | The question | Built on |
|---|---|---|
| **Channels** | "Can I post right now?" | Connection health, scopes, token expiry |
| **Studio** | "What do I say about this trip?" | Experience data → caption + checks |
| **Calendar** | "Is next week empty?" | Own scheduling tables |
| **Ads** | "Is the money working?" | Platform spend + GoDND bookings |
| **Performance** | "What should I change?" | Metric snapshots → derived actions |

Channels is a first-class destination rather than a settings page on purpose:
Meta tokens lapse every 60 days, so reconnecting is recurring operational work,
not one-time setup.

---

## How each capability is enabled

The question was MCP, a shared database, direct channel integrations, or
third-party applications. The answer is different per capability, and mixing
them is the point.

### 1. Connecting handles and publishing → **third party first, direct later**

There is no way around platform OAuth. Two routes:

**Direct** (Instagram Graph API, Facebook Pages API, X API v2) means Meta App
Review for `instagram_content_publish` and `pages_manage_posts`, business
verification, and X's paid tier. Roughly 4–8 weeks before the first post ships.
Cheap per operator once live.

**Aggregator** (Ayrshare, Phyllo, Late, or self-hosted Postiz) means one API for
all three platforms, with the vendor holding the app review. Days, not weeks.
Costs roughly $1–5 per connected profile per month, which scales with the
operator count and becomes the dominant cost at volume.

**Recommendation: aggregator first, behind `SocialProvider`.** The interface in
`src/lib/social/provider.ts` is written before any implementation precisely so
this is a swap, not a rewrite. Ship in weeks, migrate the expensive channels to
direct once operator count makes the maths turn over.

### 2. Scheduling and the calendar → **our own database, always**

Never a vendor's. Three reasons: the calendar must work when their API is down;
drafts and edits are ours; and churning the vendor must not cost the content.
`social_posts` holds the body, format, targets and `scheduled_at`; a worker
publishes at the due time through whichever provider serves that channel.

### 3. Insights → **pull on a schedule into our own snapshots**

Providers return "now". Instagram's own retention is shorter than an operator's
memory, and the rate limits make live queries a bad idea on a page load.
`social_post_metrics` stores a row per post per sync, which is what makes
"reels reach 3.8× your other formats" computable at all.

### 4. AI content suggestions → **Claude API, server-side, on structured input**

This is the part worth doing well because the input is unusually good. Context
is the experience row plus the itinerary plus the operator's own top-performing
past captions — not a bare topic string.

What ships today is a template engine (`src/lib/social/drafting.ts`), on
purpose. It proves the input is sufficient before any spend, and it stays as
the fallback for when the model call times out on a hill connection. The server
action that replaces it keeps the same signature.

Note that the *quality checks* (`src/lib/social/checks.ts`) are deliberately not
AI. Caption limits, hashtag counts, truncation points and dead links are
deterministic rules from the platforms' own published limits. A model can
propose a better hook; only a rule can promise the caption will not be cut in
half.

### 5. Ads → **read-only, from Meta and Google**

Campaigns are built where operators already build them — Meta Ads Manager,
Google Ads — and read into GoDND. Never created here.

Those builders are better than anything we would write, the operator's
audiences and pixel history already live there, and reading insights needs a
far lighter permission than managing campaigns (Meta: `ads_read` rather than
`ads_management`; Google: a read-only developer token). That is weeks off the
review and most of the support risk: nobody calls GoDND about a campaign GoDND
did not create.

What we add is the half the platforms cannot see. Meta knows the click. GoDND
knows whether it became a booking, and whether the departure being promoted
still has seats — so it can say "you are paying to fill a trip that is already
full", which no ad platform will ever tell an operator.

**The dependency this creates:** attribution only works when the campaign's
destination URL carries GoDND's tracking, and a campaign built natively has no
reason to. So link tracking is a first-class state on every campaign
(`tracked` / `untracked` / `mismatched`), untracked spend gets its own headline
number, and "unknown" is never drawn as zero. A mismatched link — tracked, but
pointing at a different experience than the ad promotes — is treated as worse
than no tracking, because it produces numbers that look right while crediting
the wrong trip.

### 6. MCP → **an agent surface over our own schema, once it is stable**

MCP is not the channel integration layer, and using it as one would be a
category error: it is a protocol for giving a model tools, not a consumer OAuth
and publishing layer.

Its real uses here, both worth doing and both *after* the data model settles:

- **Inbound:** a GoDND MCP server so an operator can drive their calendar from
  Claude — "draft next week's posts for the Meghalaya trip and schedule the
  reel for Thursday evening." The tools map to the same actions the UI calls.
- **Outbound:** wiring third-party tools (image generation, Canva) into GoDND's
  own drafting agent.

Building the MCP server before the schema is stable means rewriting the tool
definitions every sprint. It is phase 5, not phase 1.

### Summary

| Layer | Approach | Why |
|---|---|---|
| Content, calendar, schedule | **Own database** | The product is unusable without it; vendor lock is fatal |
| Metric history | **Own snapshots** | Platform retention and rate limits make this necessary |
| AI drafting | **Claude API + own context** | The moat: structured trip data nobody else holds |
| Quality checks | **Own rules** | Deterministic; useful before any model spend |
| Publish + basic insights | **Aggregator → direct** | Speed now, cost later, behind one interface |
| Ads | **Read-only (Meta, Google)** | Campaigns run natively; GoDND adds booking attribution |
| Agent access | **MCP, over our schema** | Only worth it once the schema is settled |

---

## What is built

Screens, against the fixture set in `src/lib/data/social.ts`. Every screen
follows the existing `isSupabaseConfigured()` pattern, so they render on a
fresh clone and switch to live data when the keys land.

- **Channels** — connection cards with token countdown, granted scopes shown
  including the ones *not* granted, and a warning banner when anything is close
  to lapsing.
- **Studio** — experience picker, three drafting angles, channel and format
  selection where only formats every chosen channel supports are offered, live
  quality checks, and per-channel preview showing exactly where each platform
  truncates the caption.
- **Calendar** — month grid, channel filter, status-coloured chips, a detail
  drawer with caption and metrics, a separate shelf for unscheduled drafts, and
  a banner for posts that failed to publish.
- **Ads** — campaigns imported read-only from Meta and Google, each linking
  back to the platform where it is edited. Link-tracking state per campaign,
  unmeasurable spend as its own KPI, and an insight list that cross-references
  seats sold and departure dates against what is being spent.
- **Performance** — KPI row, a "what to do next" list where every item carries
  the numbers it was derived from, and published posts ranked by reach.

Supporting code: `social/types.ts` (domain + platform rules),
`social/provider.ts` (the integration seam), `social/checks.ts` (pre-publish
rules), `social/drafting.ts` (caption templates), `data/social.ts` (fixtures and
`deriveActions`).

Nothing here writes. Every button that would mutate — Connect, Reconnect,
Schedule, Publish, New campaign — is present and disabled, so the shape of the
product is complete and no control lies about working.

---

## Roadmap

Ordered so that each phase is independently shippable and the riskiest external
dependency (Meta review) starts as early as possible.

### Phase 1 — Make it real (the unblocking work)

The section is UI over fixtures until this lands.

1. **Schema.** `agency_social_channels`, `social_posts`, `social_post_targets`,
   `social_post_metrics`, `ad_campaigns`, `ad_campaign_metrics`. RLS by
   `agency_id` on every table, matching the existing migrations' pattern, plus
   an admin-role check on channel writes (decision 1).
2. **Start Meta App Review now.** It is 4–8 weeks of calendar time and gates
   phases 2 and 6. Begin it in parallel with everything else in this phase.
3. **Pick and integrate an aggregator.** Implement `AggregatorProvider` against
   the existing interface. Evaluate Ayrshare vs Phyllo vs Late on per-profile
   cost at 50 / 500 / 5,000 operators before committing.
4. **OAuth connect flow.** Real Connect and Reconnect on Channels, with the
   `state` round-trip and encrypted token storage. Tokens never reach the
   client. Admin-only, with a read-only Channels view for other members.
5. **Draft persistence.** Studio saves to `social_posts`; Calendar reads real
   rows.

### Phase 2 — Publishing

6. **Scheduling worker.** A queue that publishes due posts, retries with
   backoff, and records per-target success and failure separately.
7. **Photo attachment.** Wire the existing experience media library (already
   built — `lib/experience-wizard/image-db.ts`) into the composer, with
   per-format cropping: 4:5 for feed, 9:16 for stories and reels.
8. **Publish and Schedule for real,** including partial failure — a post that
   reaches Instagram and fails on Facebook must say exactly that.
9. **Token refresh job.** Refresh before expiry, and email the operator when it
   cannot be done automatically.

### Phase 3 — Measurement

10. **Metrics sync job.** Pull per-post insights on a schedule into
    `social_post_metrics`.
11. **Booking attribution.** UTM tagging on every outgoing link, captured at
    checkout, so a booking traces back to the post that produced it. This is
    the number no competitor can compute.
12. **Move `deriveActions` server-side** and widen it: best posting times from
    the operator's own audience data, experiences that get no coverage, posting
    gaps before departures that have not filled.

### Phase 4 — AI drafting

13. **Server action calling Claude,** with the experience, itinerary and the
    operator's top past captions as context. Same signature as the current
    template function, which stays as the offline fallback.
14. **Variant generation** — three captions per request rather than one, since
    choosing is faster than editing.
15. **Learn from outcomes.** Feed back which drafted captions were published
    unedited and how they performed.
16. **Image suggestion.** Rank the experience's own photos for the chosen
    format instead of making the operator pick blind.

### Phase 5 — Agent access (MCP)

17. **GoDND MCP server** exposing calendar read, draft create, schedule and
    performance query, over the now-stable schema.
18. **Scoped tokens** per operator, so an agent acts as that operator and RLS
    still applies.

### Phase 6 — Ads

19. **Ad account linking,** read-only: Meta `ads_read` and a Google Ads
    read-only developer token. No billing consent needed, which removes the
    heaviest part of the flow.
20. **Campaign and insights sync** into `ad_campaigns` / `ad_campaign_metrics`.
21. **Link tracking detection.** Parse each campaign's destination URL, resolve
    it to an experience, and classify it tracked / untracked / mismatched.
    Without this the rest of the screen is a spend dashboard.
22. **A tracked-link builder** — the operator copies a ready-made URL for the
    experience and pastes it into Ads Manager. This is the whole fix for
    untracked spend, and it is one screen.
23. **Inventory-aware insights** against live seat counts and departures.
24. Gated to the Ads tier (decision 4).

Campaign *creation* inside GoDND is explicitly not on this roadmap. Revisit only
if operators ask for it repeatedly after using the read-only version.

### Deliberately not doing

- **A generic scheduler.** If an operator wants to post about something that is
  not a trip, they have Buffer. Competing there means losing the one advantage
  GoDND has.
- **Comment and DM inbox.** Real support load, no connection to bookings, and
  it is a whole product. Revisit only if operators ask repeatedly.
- **TikTok, YouTube, LinkedIn** until the three current platforms are earning.
  Each new platform is its own review, its own formats, its own limits.

---

## Decisions

Settled. Each one is load-bearing on the phases above, so the reasoning is kept
rather than just the outcome.

### 1. The agency is the publisher of record — not GoDND

GoDND is the tool; the agency running the experience owns its handles, its
content and the responsibility for both. Same posture as Buffer, whose customers
publish and whose product does not.

Two consequences that reach the code:

- **Channel management is admin-only.** Connecting and disconnecting is gated to
  the agency's admin role, not open to every member. That is a role check on
  writes to `agency_social_channels` and a read-only state on the Channels page
  for everyone else.
- **Ownership is per agency,** so a channel row is never shared across agencies
  and RLS scopes it like every other table.

The Meta *developer app* brokering OAuth is a separate, lower question than
account ownership. Default: GoDND's app (initially the aggregator's), because
per-operator App Review — business verification, hosted policy URLs, a demo
screencast, multiple weeks — is a wall a three-person operator in Shillong does
not get over, and the feature would ship to nobody. Revisit if an operator asks
for isolation or a suspension actually happens.

### 2. Aggregator first, migrate later

Ayrshare / Phyllo / Late, behind `SocialProvider`. Publishing works in days
rather than after a 4–8 week review, and the interface makes a later move to
direct Meta APIs a swap rather than a rewrite.

The crossover to watch: roughly $1–5 per connected profile per month. Trivial at
100 operators, around ₹30L a year at 500. Re-run the maths when connected
profiles pass ~300, comparing licence cost against the engineering cost of
direct integration plus its ongoing maintenance.

### 3. AI drafts, the operator writes

A first draft the operator always edits — never autopilot, never an approval
queue that decays into rubber-stamping. The editor stays the centre of Studio
and generated text is labelled a starting point.

This follows directly from decision 1: posts go out under the agency's name and
the agency carries the liability, so the agency writes the final words. It also
sets the phase 4 bar — the model has to make the blank page disappear, not the
task.

### 4. Ads is read-only, on a paid tier above the base plan

Operators create ad accounts and campaigns natively on Meta and Google. GoDND
reads the results back and layers on what those platforms cannot know: booking
attribution, and seats against spend. No campaign builder here.

Packaging is a flat monthly add-on, not bundled and not a percentage of spend. A cut of spend
is the media-agency model, and operators route around it at exactly the volume
where it would start to matter. A flat tier self-selects operators with a real
budget, who generate less support load per rupee — and ad support is the
expensive kind, because the operator is losing money while they wait.

Worth pairing with a track-record gate at some point: a brand-new listing with
no reviews will burn ₹20,000 and the operator will blame the tool. Not decided
yet, and not blocking.

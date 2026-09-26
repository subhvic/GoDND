# Admin Portal V1 — Handoff: teardown & scope reconciliation

Source: `Admin Portal V1 - Handoff`, file key `7ZpxmYACltode8m3TNliTM`.
Read via the Figma MCP: 3 pages, 73 top-level frames on *Key Screens [DEMO]*.

**TL;DR** — The handoff file is a **vendor portal for a curated marketplace**,
not a travel-SaaS suite. It covers experience creation, platform approval,
bookings, insights and transactions to a high level of finish. Four of the nine
things you described — marketplace star-marking, enquiries with chat, the
white-label consumer site with domain control, and invoices — **do not exist in
it at all**. The vocabulary also differs from the brief in a way worth adopting:
the design calls the product an **Experience**, and an *itinerary* is the
day-by-day plan inside one. I've matched the code to the file's language.

---

## 1. What the file actually contains

### Shell
`portal.godnd.com/dashboard/*`. Fixed left sidebar, 208px, with the user card
(avatar, name, role) pinned above the nav. Six items:

**Home · Experiences · Bookings · Insights · Transactions · Settings**

### Design tokens (pulled from Figma variables, not eyeballed)

| Token | Value |
|---|---|
| Primary Green 1 | `#007F6A` |
| Dark Green 1 | `#071D18` |
| Accent Green 1 | `#02E28C` |
| Primary Green 3 / 5 | `#B8DBD5` / `#F5FAF9` |
| Dark Green 2 / 4 / 5 | `#667370` / `#DCDFDF` / `#F5F6F6` |
| Neutral Black 1→5 | `#1D1D1D` `#737373` `#B7B7B7` `#DBDBDB` `#F1F1F1` |
| Type | Roboto — Body 16, Small 12, H3 20; weights 400/500/600/700, line-height 1.2 |

Type ramp is thin: 12 / 16 / 20 only. That's workable for a dense table-driven
portal, but it has no display size, so the Insights and Home screens have no way
to make a headline number feel like a headline. I'd add a 28 and a 36 for metric
tiles — a change inside the spirit of the system, not a departure from it.

### Experiences
Table with tabs **Active · Under Review · Drafts · Disabled · Archived**, each
with a count. Columns: Experience name, Type, Grp size, No. of Days, Location,
Next Availability, Base Price. Search, Filters, `+ Add New Experience`,
pagination (22 pages in the demo).

Row click opens a **detail drawer** (~415px) containing: title, `7D & 6N`, type,
`Exp ID - 0045835`, rating + review count, bookings completed, an active-state
banner with upcoming bookings, `Edit Experience` / `Preview` / overflow, then
collapsible cards — Basic Info, Itinerary Info (pick-up → en-route → drop),
Crew Capacity & Pricing, Availability Info (`Add availability`, `Mark Holidays`),
Media Info (photos / videos / **media from guests**), and **Approval History**
(*Approval Requested · Experience Activated · 21 changes made*, timestamped).

**Experience types:** General, Quick, Super, and `General - Joinee`.
**Group sizing:** `4 - Fixed`, `8 - Flexible`, and `10 - Flexible, 2 groups max`.

### Add New Experience — a 7-step wizard
Left rail with completion ticks, `Save as Draft` always available, Previous/Next
at the bottom.

1. **Basic Info** — type (General/Quick/Super), Region/State (multi), Duration,
   Categories (multi), Languages Spoken (multi), Min/Max eligible age, Activity
   Tags, Food Included (None / B&D / B,L&D), Food Preferences (Veg / Non-veg / Both).
2. **Itinerary Builder** — day tabs down the left (Day 1…n). Each day opens with
   a **Pick-up** block (location pin, Region/State, pick-up time, plus a "Not
   included in the itinerary" opt-out), then ordered **activity cards**: Activity
   Type, Stoppage Time, Pin on Map, Add Images, Comment. `+ Add Activity`.
3. **Crew & Trip Capacity** — Trip Captain, Trip Co-ordinator, a "more people are
   involved in the ground" toggle revealing Add Members, then Onboarding Strategy
   (incl. **Invite Only**) and Maximum Group Size.
4. **Pricing Strategy** — base price per guest, max guests per booking, and a
   choice of **Unit multiply with Guests** vs **Set variable Pricing** (a total
   per guest count: 2 → ₹13,500, 3 → ₹19,500, 4 → ₹25,500). A live
   **Price Preview for Your Guests** panel breaks out base fare, GST and a coupon
   (`MYFIRSTDND`, 20% off).
5. **Availability Calendar**
6. **Support & Policies**
7. **Media & Overview**

### Settings (labelled "Vendor Admin" in frame names)
Basic Info · Compliance · Financial Details · Certifications & Accreditations ·
Operational Details · My Profile · My Team (add member). Most have Filled and
Empty states drawn — good, those are usually the states that get skipped.

### Other
Bookings Dashboard + booking details drawer. Insights. Transaction Dashboard.
A consumer-facing **Experience Landing Page** (1440×8092) and a
**Preview – Pending Approval** state.

---

## 2. Gaps — in the brief but not in the file

These are the ones I need decisions on. I've built the data layer to support all
five, but none has a design to follow.

**Gap 1 — Marketplace star-marking.** Your brief's central mechanic. The file has
a single approval pipeline: everything an operator creates goes to GoDND for
review and becomes Active. There is no control anywhere for *"list this on the
marketplace"* vs *"keep it on my own site only"*.

I've modelled this as two independent booleans (`list_on_marketplace`,
`list_on_own_site`) alongside `status`, because collapsing them breaks the moment
an operator wants to keep a high-margin trip off your marketplace — which will be
most of them, for their best products. **Decision needed:** does marketplace
listing require your approval while own-site publishing doesn't? I'd argue yes —
your brand carries the marketplace listing, not their site.

**Gap 2 — Enquiries + chat support.** No inbox, no thread, no conversation UI
anywhere in the file. This is a whole nav item and a substantial module.
Schema and realtime are in place; the screens need designing.

*Update — built without a frame to follow.* `/dashboard/enquiries` is designed
from the portal's own system (tokens, pill tabs, drawer, form atoms), not from
the handoff file, so it should be reconciled against any Enquiries frames
added to Figma since this teardown. What it commits to:

- **Split by whose move it is**, not by stage: *Needs reply* (longest wait
  first, overdue past 24h in red), *Replied*, *Closed*. The seven-stage
  pipeline (new → open → quoted → negotiating → won / lost / spam) is a
  property of the thread, changed from its header.
- **The enquiry opens the thread** as a structured card (trip, dates, group,
  budget, their words); quotes are sent as priced cards, not free text.
- **Internal notes live in the thread** (violet, team-only via RLS), and stage
  / assignment changes leave a history line.
- **Reachability is explicit**: a phone-only lead can't be "replied to" — the
  box switches to notes and offers Call / WhatsApp instead.
- **Phones get a native-app pattern**: list and thread are separate screens,
  the thread fills the viewport and rides above the keyboard, details are a
  full-screen sheet.

Migration `0006_enquiry_chat.sql` adds the tables to the Realtime
publication, a `mark_enquiry_read` RPC, and stops internal notes from moving
an enquiry out of New.

**Gap 3 — The white-label consumer site.** The file has an Experience Landing
Page, but nothing that lets an operator *control* their site: no theme editor, no
page manager, no domain settings. "Manage consumer side website look and feel"
is the biggest undesigned surface in your brief.

**Gap 4 — Invoices.** *Transactions* exists; invoicing (GST-compliant, numbered
series, PDF) does not. In India these are legally distinct — a transaction log is
not a tax invoice.

**Gap 5 — Subscription & plan management.** No billing, plans, or entitlement
screens. If custom domains are to be a paid-tier feature, this has to exist.

---

## 3. Contradictions — where the file and the brief disagree

**"Vendor" vs "travel company".** The file's frames say Vendor Admin and the
demo user's role is "Admin". Your brief says travel companies with teams. The
Settings section does have My Team, so multi-user is intended — but there's no
role picker or permission matrix drawn. I've implemented five roles
(owner/admin/sales/ops/finance). **Confirm the role list before I build the UI.**

**Commission is invisible.** Nothing in the file shows a take rate, a payout, or
a settlement. The Transaction Dashboard appears to be operator-facing revenue,
not platform commission. You've confirmed commission-on-bookings, so payouts and
a commission ledger need designing.

**No traveller accounts.** You confirmed B2C traveller accounts; the file has no
sign-in, saved-trips, or my-bookings surface for travellers. That's a second
consumer-side app area.

**"Invite Only" onboarding.** Step 3 offers it, but nothing shows how an invite
is issued or redeemed. Built into the schema as `onboarding_strategy`; the flow
is undesigned.

---

## 4. What I changed in my model after reading the file

I had guessed a conventional package-tour schema. The file is materially
different and the file wins:

| My assumption | The file | Resolution |
|---|---|---|
| "Itinerary" is the product | "Experience" is; itinerary is step 2 of 7 | Renamed throughout |
| Days hold stay + meals + transfer | Days hold an ordered **activity timeline** with map pins and stoppage times | Rebuilt as `experience_days` + `experience_activities` |
| Occupancy pricing (double/triple/single) | **Price per guest count**, as a group total | `experience_price_tiers (guest_count → total_minor)` |
| Fixed departures | Availability windows with slots, plus blackouts | `experience_availability` + `experience_blackouts` |
| Simple published/listed flags | A real approval pipeline with revision history | `experience_reviews` + `revision` |
| — | Coupons driving a live price preview | `coupons`, `experience_coupons` |
| — | Crew: captain, co-ordinator, ground members | `experience_crew` |
| — | Guest-uploaded media | `experience_media.source` |

Occupancy pricing is the one I'd push back on slightly: `2 guests → ₹13,500`
reads as a group total, and a traveller comparing against competitors quoting
per-head will misread it. Worth confirming the intent before the consumer side
renders it.

---

## 5. Verification

All four migrations were applied to a real PostgreSQL 16 instance (with a stub
`auth` schema) and pass. A smoke test confirms reference generation
(`EXP 0045835`, `ENQ-000001` → `ENQ-000002`), the chat trigger updating inbox
counters, and tenant isolation under RLS — the owning member sees their
experience, an unrelated signed-in user sees zero rows.

No UI has been built yet. That waits on the decisions in §2 and §3.

---

## 6. The *Login & Home* page (built)

Read from the page's full node tree (`2025:16134`). Figma's screenshot and
asset endpoints were out of reach, so structure, copy and geometry come from
the file, while colour and type come from the product's design system (as
every other built screen does).

**Login Flow** — six frames: email → invalid email → code → incorrect code →
code filled. Split screen (image 728 / form 712), the "GoDND | Portal" lockup,
content hung 80px in, 36px between blocks, 12px from a control to its
message, six 40px code boxes 30px apart. Built at `/login`.

**Home** — two frames (Monthly and Weekly): *My Experience Funnel* (six
tiles), *Conversion Graph*, *Latest Bookings*, *Recently Created
Experiences*. Built at `/dashboard`.

**Forgot Password / Change Password** — drawn in *Section 1*, off to the side,
still on placeholder imagery, and belonging to a password login that the
polished Login Flow replaced with a one-time code. Not built: in a
passwordless portal there is no password to forget. **Decision needed** if
these are meant for a future password option.

Where the build departs from the drawing, and why:

| Drawing | Built | Why |
|---|---|---|
| Code step: "…sent to your email." | Names the address, with *Change email* | The drawn step is a dead end after a typo |
| *Resend OTP* | Counts down 60s first | Supabase refuses a second email sooner; a button that fails is worse than one that waits |
| "Itineraries Active" | "Active experiences" | The file's own word, used by the graph's legend beside it |
| "Canc. Ratio 1:44" | "1 in 44 reservations" | Reads without decoding ratio notation |
| Graph: "11 active" beside "18 bookings" | Plots *experiences booked* (distinct) against active | Legend says "Experiences Booked"; bookings outnumber experiences 5–10×, so the active line would flatten on a shared axis — and a second axis invents correlations |
| Photograph (left half) | Illustrated Khasi hills (`AuthHero`) | The photo couldn't be exported; swapping it in is a one-component change |

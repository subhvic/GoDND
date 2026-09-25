# Bookings — states, drawer actions and journeys

**TL;DR** — A booking moves through five operator-facing phases: *Awaiting
payment → Upcoming → **Ongoing** (new) → Completed*, with *Cancelled* as the
exit from any of the first three. Today the drawer shows the same three
buttons in every phase, and two of them do nothing. This spec gives each phase
its own banner, primary action and checklist, and lists every journey (and
sub-journey) the drawer has to complete. The implementation checklist is §6.

> **Figma.** The handoff file has a "Bookings Dashboard + booking details
> drawer", but the Figma MCP is blocked by the Starter-plan call limit, so
> this spec was written from the schema, the current code and the drawer
> pattern the file uses for Experiences (state banner, primary + secondary
> actions, overflow, collapsible cards). Reconcile against the frames once
> they can be read.

---

## 1. Phases

The database keeps its eight `booking_status` values. The operator sees five
phases, one per tab. **Ongoing is derived from dates, not stored**: a trip is
ongoing because today falls between its first and last day, and no job has
to remember to flip it at midnight.

| Tab | Rule (dates in IST) | Question it answers |
|---|---|---|
| Awaiting payment | `draft`, `pending_payment` | Who started checkout but hasn't paid? |
| Upcoming | `confirmed` · `paid` · `partially_paid`, and `travel_start` after today | What do I need to prepare? |
| **Ongoing** | same statuses, and `travel_start ≤ today ≤ travel_end` | Who is on a trip right now? |
| Completed | `completed`, **or** an active status whose `travel_end` has passed | What has run — and what still needs closing? |
| Cancelled | `cancelled`, `refunded` | What didn't run, and is money owed back? |

A trip whose last day has passed but hasn't been closed goes to **Completed**
flagged *"Wrap-up pending"*: it isn't being experienced any more, but it
still needs one action from the operator.

Status colour stays rule 01/02: amber = the operator must act (awaiting
payment, balance due, wrap-up pending, refund pending), green = money is
here, blue = informational (on trip), red = money moved out, grey = done.

---

## 2. What is half-baked today

| # | Where | Problem |
|---|---|---|
| H1 | Drawer header | *Message guest* is a bare `mailto:` — no WhatsApp, no templates, not logged, not linked to Enquiries |
| H2 | Drawer header | *View invoice* is enabled after a payment and does nothing |
| H3 | Drawer header | *Refund* is enabled when money was paid and does nothing |
| H4 | Drawer body | *Cancel this booking* is a warning box with no button — a dead end |
| H5 | Money tiles | A **cancelled** booking shows "Balance due ₹73,500 · reminder fires 7 days before travel" |
| H6 | Money tiles | "Reminder fires 7 days before travel" shows on unpaid and past bookings |
| H7 | Timeline | An awaiting-payment booking has an empty timeline — not even "Booking created" |
| H8 | Guests | 4 guests booked, 1 traveller listed; no ID / permit details, meal or medical notes |
| H9 | Everywhere | No way to record a cash / UPI / bank payment, send a reminder, or collect a balance |
| H10 | Everywhere | No on-trip view: check-in, emergency contacts, trip log |
| H11 | Completed | No wrap-up, review request, review reply or payout status |
| H12 | Data | Sample dates are fixed in Feb–Jun 2026, so every "upcoming" trip is in the past and Ongoing can never show |
| H13 | Live data | `getBooking` calls an RPC (`get_booking_detail`) that no migration creates — the live drawer can't load |
| H14 | Home | "Latest bookings" can't tell an on-trip booking from an upcoming one |

---

## 3. The drawer, phase by phase

Every phase gets: a **state banner** (one sentence saying where the booking
stands and what's next), **three money tiles** that mean something for that
phase, **one primary action**, secondary actions, and an overflow (⋯) menu.

### 3.1 Awaiting payment (`draft`, `pending_payment`)

- **Banner (amber):** "Awaiting payment — ₹55,500 due. Seats are held until the guest pays."
- **Tiles:** Total · Paid · Due now
- **Primary:** *Send payment reminder*
- **Secondary:** Message guest · Record payment
- **Overflow:** Cancel booking · Copy reference
- **Hidden:** Refund, invoice (nothing was paid)

### 3.2 Upcoming (active, departs after today)

- **Banner:** "Departs in 12 days" + the first unmet item on the checklist
  ("2 of 4 travellers missing ID", "₹49,000 balance due by 2 Oct").
- **Tiles:** Total · Paid · Balance due (or "Paid in full")
- **Primary:** *Collect balance* if money is due, else *Send trip briefing*
- **Secondary:** Message guest · View invoice
- **Overflow:** Record payment · Change dates · Cancel booking · Copy reference
- **New section — Pre-departure checklist:** Payment complete · Traveller
  details (n of N) · Inner Line Permit (Arunachal, Nagaland, Mizoram, Manipur
  only) · Trip briefing sent · Departure reminder (automatic, 3 days before)

### 3.3 Ongoing (active, today within the trip) — **new**

- **Banner (blue):** "On trip — day 2 of 4, ends 5 Oct."
- **Tiles:** Day 2 of 4 · Checked in 3/4 · Balance due (only if money is still owed)
- **Primary:** *Check in guests* until everyone is in, then *Add trip update*
- **Secondary:** Message guest · Call lead guest
- **Overflow:** Record payment · End trip early · Copy reference
- **New section — On the ground:** trip captain and phone, lead guest's
  phone, medical notes and meal preferences pulled to the top (the things
  needed in an emergency, not buried under travellers)
- **New section — Trip log:** updates and incidents, timestamped

### 3.4 Completed (`completed`, or active and ended)

- **Wrap-up pending:** amber banner "Trip ended 2 days ago — close it out";
  primary *Close out trip* (marks completed, sends the review request).
  Blocks with a clear note if a balance is still due.
- **Closed:** banner "Completed on 14 Feb"; primary *Request review* until a
  review exists, then *Reply to review*
- **Tiles:** Total · Paid · Your payout (marketplace) / Collected (own site)
- **Secondary:** Message guest · View invoice
- **Overflow:** Issue goodwill refund · Copy reference
- **New section — Review** (rating, text, reply) · **Payout** (marketplace:
  commission, net, payout status)

### 3.5 Cancelled / Refunded

- **Banner (red/grey):** "Cancelled on 4 Feb — guest requested" + refund state
  ("₹37,000 refund pending", "Refunded ₹37,000 on 12 Jan", "No payment was taken")
- **Tiles:** Paid · Refunded · Kept (paid − refunded)
- **Primary:** *Record refund* (own-site) / *Refund status* (marketplace) while a refund is pending; none otherwise
- **Secondary:** Message guest · View invoice / credit note
- **No balance due, ever** (fixes H5)

---

## 4. Journeys and sub-journeys

Each journey opens as a dialog (bottom sheet on phones), validates inline,
changes the booking in one step, writes a timeline event, and — where the tab
changes — the list updates without a reload.

| Journey | Available in | Steps / sub-journeys | Result |
|---|---|---|---|
| **J1 Send payment reminder** | Awaiting, Upcoming (balance due), Ongoing (balance due) | Amount (full due or custom) → editable message with amount, due date and reference prefilled → *Open in WhatsApp* / *Open in email* / *Copy text* | Event "Payment reminder sent via WhatsApp"; checklist shows last reminder |
| **J2 Record payment** | Awaiting, Upcoming, Ongoing, Completed-wrap-up | Amount (≤ due, defaults to due) → method (UPI / cash / bank transfer / card) → reference (required for UPI/bank) → date received | Payment added; paid / balance update; status → `partially_paid` or `paid` (`pending_payment` → confirmed on first payment); moves Awaiting → Upcoming/Ongoing |
| **J3 Cancel booking** | Awaiting, Upcoming, Ongoing | Reason (guest / operator / weather / minimum not met / other) → refund per policy tier from days-to-departure (editable, needs a note if changed; full refund forced for weather / minimum-not-met, matching the operator's accepted guarantees) → tick "I've told the guest…" to enable the red *Cancel booking* | Status `cancelled`; refund pending if refund > 0 (marketplace: GoDND processes; own-site: operator records it, J4); moves to Cancelled |
| **J4 Refund** | Cancelled with refund pending; Upcoming/Completed as goodwill | Amount (≤ paid − refunded) → method → reference → reason | Refund payment added; `refunded` when the full paid amount is back |
| **J5 Traveller details** | Upcoming, Ongoing | Manifest of N seats (filled + empty) → edit one traveller (name, age group, ID type + number, meal, medical) → *Request details from guest* (J1-style share of a message listing what's missing) | Checklist "Traveller details n of N"; the permit item says how many IDs are still missing |
| **J6 Inner Line Permit** | Upcoming for ILP states | Mark "Applied" → "Issued" | Checklist item done; event |
| **J7 Send trip briefing** | Upcoming | Template with pickup point/time, what to bring, captain's number → WhatsApp / email | Event; checklist done |
| **J8 Change dates** | Upcoming | New start date (end follows the trip length, or set it) → note; unchanged dates are refused | Dates update; event "2 – 5 Oct → 9 – 12 Oct" |
| **J9 Check in guests** | Ongoing (and day 1) | Tick each traveller, or *Check in everyone* | Checked-in count; event |
| **J10 Trip update / incident** | Ongoing | Type (update / incident) → headline → details | Trip log + timeline; incidents show amber |
| **J11 End trip early / Close out** | Ongoing, Completed-wrap-up | Confirm; blocked if balance due (offers J2) | Status `completed`; review request queued; moves to Completed |
| **J12 Request review** | Completed without review | Share review link via WhatsApp / email | Event "Review requested" |
| **J13 Reply to review** | Completed with review | Reply text (public) | Reply shown under the review |
| **J14 View invoice** | Any phase with a payment | GST invoice: operator + guest, line items, CGST/SGST vs IGST by place of supply, paid, balance → *Print / Save PDF* | — |
| **J15 Message guest** | All | WhatsApp · Email · Call · *Open conversation* (if the booking came from an enquiry) | Event "Messaged the guest on WhatsApp" |
| **J16 Copy reference** | All | — | Toast |

---

## 5. Cross-cutting

- **Sample data relative to today** so every phase — including two ongoing
  trips — always has a live example (fixes H12).
- **Live data path**: build the detail from `bookings`, `booking_travellers`,
  `payments` and a new `booking_events` table instead of the missing RPC
  (fixes H13); migration adds `booking_events`, traveller check-in / permit
  columns and review-request timestamps, with RLS.
- **List**: *Ongoing* tab (between Upcoming and Completed) with its own icon
  and empty state; the Departure column reads "Day 2 of 4" for ongoing rows;
  wrap-up and refund-pending rows carry an amber marker; Upcoming sorts by
  soonest departure, Ongoing by soonest end.
- **Home**: latest bookings show "On trip" for ongoing rows (H14).
- **Accessibility / responsiveness**: every dialog is a bottom sheet on
  phones with 16px inputs; destructive steps confirm; focus returns to the
  action that opened them; everything reachable by keyboard.
- **Tests**: Playwright coverage per phase and per journey.

## 6. Implementation checklist

1. Phase model: derived `phaseForBooking()`, *Ongoing* tab, tab rules, sort,
   status colour, labels; Home badge.
2. Relative-date sample data covering every phase, including 2 ongoing trips,
   1 wrap-up pending, 1 refund pending, 1 with a review.
3. Detail model: travellers (seats, ID, meal, medical, check-in, permit),
   payments with direction, events with actor, review, payout, captain.
4. Pure transition functions (payment, refund, cancel, check-in, close out,
   dates, events) shared by the optimistic client and the server actions.
5. Server actions with zod validation; live writes; sample-mode echo.
6. Client booking store so drawer changes update the list without a reload.
7. Drawer rebuild: banner, phase tiles, primary/secondary/overflow,
   checklist, on-the-ground, trip log, review, payout, cancellation (H1–H8).
8. Dialogs J1–J16.
9. Migration `0007_booking_operations.sql` + live `getBooking` (H13).
10. Playwright suite; docs.

**Status: all ten done.** `tests/bookings.spec.ts` covers the five phases,
J1–J5, J8–J11, J13, J14 and the phone layout; migration 0007 was applied
to Postgres 16 and `apply_booking_change` exercised as a member and as a
stranger (RLS). Deliberately left out of this pass: permit numbers (J6), a
"delay" trip-update type and notifying the guest from a trip update (J10),
and a typed-reference confirmation for cancelling (J3 uses a confirm tick
instead — lighter, and the dialog already names the booking).

## 7. Open questions

1. **Refund tiers.** No tiers exist in code or schema; the operator accepts
   "the General Cancellation Policy of GoDND". Placeholder until confirmed:
   30+ days before departure 100%, 15–29 days 75%, 7–14 days 50%, under 7
   days 0%.
2. **Payment links.** Razorpay payment-link creation needs live keys; until
   then a reminder shares the amount and reference, and payments received
   outside Razorpay are recorded by hand (J2).
3. **Messages leave through the operator's own WhatsApp / email.** There is
   no outbound email or WhatsApp Business integration yet, so the portal
   prepares the message and opens the operator's app.

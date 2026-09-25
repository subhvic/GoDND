-- =============================================================================
-- GoDND — Booking operations: the drawer's journeys, persisted
-- =============================================================================
-- docs/BOOKING-JOURNEYS.md defines what an operator can do to a booking from
-- its drawer: record a payment or refund, cancel with a policy refund, check
-- guests in, close out a trip, change dates, keep the traveller manifest and
-- permits, log trip updates, reply to reviews. This migration adds the
-- columns those need, an event log, and one function that applies a change
-- atomically.
--
-- "Ongoing" is deliberately NOT a booking_status: it is derived from the
-- travel dates in the app, so no scheduled job has to flip it at midnight.
-- =============================================================================

alter table bookings add column if not exists refund_owed_minor integer not null default 0
  check (refund_owed_minor >= 0);
alter table bookings add column if not exists cancel_category text
  check (cancel_category in ('guest_request', 'operator', 'weather', 'minimum_not_met', 'no_payment', 'other'));
alter table bookings add column if not exists cancelled_by uuid references profiles(id) on delete set null;
alter table bookings add column if not exists completed_at timestamptz;
alter table bookings add column if not exists review_requested_at timestamptz;
alter table bookings add column if not exists briefing_sent_at timestamptz;
-- Inner Line Permit, for trips into Arunachal, Nagaland, Mizoram, Manipur.
alter table bookings add column if not exists permit_status text not null default 'not_needed'
  check (permit_status in ('not_needed', 'pending', 'applied', 'issued'));

alter table booking_travellers add column if not exists checked_in_at timestamptz;

-- UPI / NEFT / receipt number for money recorded by hand.
alter table payments add column if not exists reference text;

-- -----------------------------------------------------------------------------
-- Event log — the drawer's timeline and the on-trip log
-- -----------------------------------------------------------------------------
create table if not exists booking_events (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references bookings(id) on delete cascade,
  agency_id    uuid not null references agencies(id) on delete cascade,
  kind         text not null,
  label        text not null,
  detail       text,
  amount_minor integer,
  actor_id     uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists booking_events_booking_idx on booking_events(booking_id, created_at);

alter table booking_events enable row level security;

-- Append-only for the team; nobody edits history.
drop policy if exists booking_events_read on booking_events;
create policy booking_events_read on booking_events for select
  using (is_agency_member(agency_id) or is_platform_admin());
drop policy if exists booking_events_insert on booking_events;
create policy booking_events_insert on booking_events for insert
  with check (is_agency_member(agency_id));

-- Money recorded by hand is written by the operator's session. Gateway
-- payments stay webhook-only (their rows carry gateway = 'razorpay').
drop policy if exists payments_manual_insert on payments;
create policy payments_manual_insert on payments for insert
  with check (is_agency_member(agency_id) and coalesce(gateway, 'manual') = 'manual');

-- -----------------------------------------------------------------------------
-- apply_booking_change — one drawer action, one transaction
-- -----------------------------------------------------------------------------
-- The app computes the next state with the same function the drawer uses
-- (lib/bookings/actions.ts) and hands over the difference. Writing it here in
-- one transaction means a payment row can never land without the booking's
-- paid total moving with it. SECURITY INVOKER: the caller's RLS decides.
create or replace function apply_booking_change(
  p_booking     uuid,
  p_patch       jsonb,
  p_payments    jsonb default '[]'::jsonb,
  p_travellers  jsonb default '[]'::jsonb,
  p_events      jsonb default '[]'::jsonb,
  p_review_reply text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_agency uuid;
begin
  select agency_id into v_agency from bookings where id = p_booking for update;
  if v_agency is null then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  update bookings set
    status              = coalesce((p_patch ->> 'status')::booking_status, status),
    travel_start        = case when p_patch ? 'travel_start' then (p_patch ->> 'travel_start')::date else travel_start end,
    travel_end          = case when p_patch ? 'travel_end' then (p_patch ->> 'travel_end')::date else travel_end end,
    paid_minor          = coalesce((p_patch ->> 'paid_minor')::integer, paid_minor),
    refunded_minor      = coalesce((p_patch ->> 'refunded_minor')::integer, refunded_minor),
    refund_owed_minor   = coalesce((p_patch ->> 'refund_owed_minor')::integer, refund_owed_minor),
    balance_due_at      = case when p_patch ? 'balance_due_at' then (p_patch ->> 'balance_due_at')::date else balance_due_at end,
    completed_at        = case when p_patch ? 'completed_at' then (p_patch ->> 'completed_at')::timestamptz else completed_at end,
    review_requested_at = case when p_patch ? 'review_requested_at' then (p_patch ->> 'review_requested_at')::timestamptz else review_requested_at end,
    briefing_sent_at    = case when p_patch ? 'briefing_sent_at' then (p_patch ->> 'briefing_sent_at')::timestamptz else briefing_sent_at end,
    permit_status       = coalesce(p_patch ->> 'permit_status', permit_status),
    cancelled_at        = case when p_patch ? 'cancelled_at' then (p_patch ->> 'cancelled_at')::timestamptz else cancelled_at end,
    cancellation_reason = case when p_patch ? 'cancellation_reason' then p_patch ->> 'cancellation_reason' else cancellation_reason end,
    cancel_category     = case when p_patch ? 'cancel_category' then p_patch ->> 'cancel_category' else cancel_category end,
    cancelled_by        = case when p_patch ? 'cancelled_by' then (p_patch ->> 'cancelled_by')::uuid else cancelled_by end
  where id = p_booking;

  insert into payments (id, agency_id, booking_id, direction, status, amount_minor, currency,
                        method, gateway, reference, collected_by_platform, paid_at)
  select (p ->> 'id')::uuid, v_agency, p_booking,
         (p ->> 'direction')::payment_direction, 'captured',
         (p ->> 'amount_minor')::integer, coalesce(p ->> 'currency', 'INR'),
         p ->> 'method', 'manual', p ->> 'reference', false,
         coalesce((p ->> 'paid_at')::timestamptz, now())
  from jsonb_array_elements(p_payments) as p;

  insert into booking_travellers (id, booking_id, full_name, kind, id_type, id_number,
                                  meal_pref, medical_notes, checked_in_at, position)
  select (t ->> 'id')::uuid, p_booking, t ->> 'full_name', t ->> 'kind', t ->> 'id_type',
         t ->> 'id_number', t ->> 'meal_pref', t ->> 'medical_notes',
         (t ->> 'checked_in_at')::timestamptz, coalesce((t ->> 'position')::integer, 0)
  from jsonb_array_elements(p_travellers) as t
  on conflict (id) do update set
    full_name     = excluded.full_name,
    kind          = excluded.kind,
    id_type       = excluded.id_type,
    id_number     = excluded.id_number,
    meal_pref     = excluded.meal_pref,
    medical_notes = excluded.medical_notes,
    checked_in_at = excluded.checked_in_at,
    position      = excluded.position
  where booking_travellers.booking_id = p_booking;

  insert into booking_events (id, booking_id, agency_id, kind, label, detail, amount_minor, actor_id, created_at)
  select (e ->> 'id')::uuid, p_booking, v_agency, e ->> 'kind', e ->> 'label', e ->> 'detail',
         (e ->> 'amount_minor')::integer, auth.uid(), coalesce((e ->> 'created_at')::timestamptz, now())
  from jsonb_array_elements(p_events) as e;

  if p_review_reply is not null then
    update reviews set agency_reply = p_review_reply, replied_at = now() where booking_id = p_booking;
  end if;
end;
$$;

grant execute on function apply_booking_change(uuid, jsonb, jsonb, jsonb, jsonb, text) to authenticated;

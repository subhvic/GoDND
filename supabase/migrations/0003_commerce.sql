-- =============================================================================
-- GoDND — Enquiries & chat, bookings, payments, invoices, payouts, reviews
-- =============================================================================
-- Money is stored as integer minor units (paise) everywhere. No floats, no
-- numeric rounding surprises at invoice time.
--
-- Commission model: a marketplace booking is collected by GoDND, the platform
-- retains commission_minor, and the remainder accrues to the operator as a
-- payout. A booking originating on the operator's own white-label site is
-- operator-collected and carries commission_minor = 0. `is_marketplace` is the
-- single switch that decides which path a booking follows.
-- =============================================================================

create type enquiry_source   as enum ('marketplace', 'website', 'manual', 'whatsapp', 'phone', 'referral');
create type enquiry_status   as enum ('new', 'open', 'quoted', 'negotiating', 'won', 'lost', 'spam');
create type enquiry_priority as enum ('low', 'normal', 'high');
create type sender_kind      as enum ('traveller', 'agent', 'system');
create type booking_status   as enum ('draft', 'pending_payment', 'confirmed', 'partially_paid', 'paid', 'completed', 'cancelled', 'refunded');
create type payment_status   as enum ('created', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded');
create type payment_direction as enum ('inbound', 'refund');
create type invoice_status   as enum ('draft', 'issued', 'paid', 'partially_paid', 'void', 'overdue');
create type payout_status    as enum ('pending', 'processing', 'paid', 'failed', 'on_hold');

-- -----------------------------------------------------------------------------
-- Enquiries — the operator's CRM inbox
-- -----------------------------------------------------------------------------
create table enquiries (
  id              uuid primary key default gen_random_uuid(),
  agency_id       uuid not null references agencies(id) on delete cascade,
  experience_id    uuid references experiences(id) on delete set null,
  availability_id    uuid references experience_availability(id) on delete set null,
  -- Human-readable, per-tenant sequence: ENQ-000142. Assigned by trigger.
  reference       text not null,

  source          enquiry_source not null default 'website',
  status          enquiry_status not null default 'new',
  priority        enquiry_priority not null default 'normal',

  -- A traveller may enquire without an account (guest), so contact details are
  -- denormalised here rather than living only on profiles.
  traveller_id    uuid references profiles(id) on delete set null,
  contact_name    text not null,
  contact_email   citext,
  contact_phone   text,

  adults          integer not null default 1 check (adults >= 0),
  children        integer not null default 0 check (children >= 0),
  infants         integer not null default 0 check (infants >= 0),
  preferred_start date,
  flexible_dates  boolean not null default false,
  budget_minor    integer,
  currency        char(3) not null default 'INR',
  message         text,
  internal_notes  text,

  assigned_to     uuid references profiles(id) on delete set null,
  lost_reason     text,
  -- Denormalised for the inbox list: avoids a correlated subquery per row.
  last_message_at timestamptz,
  unread_for_agent integer not null default 0,
  unread_for_traveller integer not null default 0,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint enquiries_reference_unique unique (agency_id, reference),
  constraint enquiries_has_contact check (contact_email is not null or contact_phone is not null)
);

create index enquiries_inbox_idx    on enquiries(agency_id, status, last_message_at desc nulls last);
create index enquiries_assigned_idx on enquiries(assigned_to) where assigned_to is not null;
create index enquiries_traveller_idx on enquiries(traveller_id) where traveller_id is not null;

-- Chat thread. Supabase Realtime broadcasts inserts on this table, which is
-- what makes the support chat live without a separate socket server.
create table enquiry_messages (
  id           uuid primary key default gen_random_uuid(),
  enquiry_id   uuid not null references enquiries(id) on delete cascade,
  sender_kind  sender_kind not null,
  sender_id    uuid references profiles(id) on delete set null,
  body         text,
  attachments  jsonb not null default '[]'::jsonb,
  -- Internal notes live in the same thread but are hidden from the traveller,
  -- so an agent never has to switch surfaces to leave context for a colleague.
  is_internal  boolean not null default false,
  read_at      timestamptz,
  created_at   timestamptz not null default now(),
  constraint enquiry_messages_has_content check (body is not null or jsonb_array_length(attachments) > 0)
);

create index enquiry_messages_thread_idx on enquiry_messages(enquiry_id, created_at);

-- -----------------------------------------------------------------------------
-- Bookings
-- -----------------------------------------------------------------------------
create table bookings (
  id                uuid primary key default gen_random_uuid(),
  agency_id         uuid not null references agencies(id) on delete cascade,
  experience_id      uuid references experiences(id) on delete set null,
  availability_id      uuid references experience_availability(id) on delete set null,
  enquiry_id        uuid references enquiries(id) on delete set null,
  traveller_id      uuid references profiles(id) on delete set null,
  reference         text not null,          -- BKG-000142

  status            booking_status not null default 'draft',
  -- True when the booking came through the GoDND marketplace: decides who
  -- collects the money and whether commission applies.
  is_marketplace    boolean not null default false,

  -- Snapshot of trip details at the time of booking. Deliberately denormalised:
  -- if the operator later edits the itinerary, the booking must not mutate.
  experience_snapshot jsonb not null default '{}'::jsonb,
  lead_name         text not null,
  lead_email        citext,
  lead_phone        text,
  travel_start      date,
  travel_end        date,
  adults            integer not null default 1,
  children          integer not null default 0,
  infants           integer not null default 0,

  currency          char(3) not null default 'INR',
  subtotal_minor    integer not null default 0,
  discount_minor    integer not null default 0,
  tax_minor         integer not null default 0,
  total_minor       integer not null default 0,
  paid_minor        integer not null default 0,
  refunded_minor    integer not null default 0,
  -- Platform take on marketplace bookings; 0 for operator-direct.
  commission_bps    integer not null default 0,
  commission_minor  integer not null default 0,
  -- What the operator is owed: total - commission - refunds
  payout_minor      integer not null default 0,

  balance_due_at    date,
  cancelled_at      timestamptz,
  cancellation_reason text,
  notes             text,

  created_by        uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint bookings_reference_unique unique (agency_id, reference),
  constraint bookings_dates check (travel_end is null or travel_start is null or travel_end >= travel_start),
  constraint bookings_amounts check (total_minor >= 0 and paid_minor >= 0)
);

create index bookings_agency_idx    on bookings(agency_id, status, created_at desc);
create index bookings_traveller_idx on bookings(traveller_id) where traveller_id is not null;
create index bookings_travel_idx    on bookings(agency_id, travel_start);

create table booking_travellers (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references bookings(id) on delete cascade,
  full_name    text not null,
  kind         text not null default 'adult',   -- adult|child|infant
  date_of_birth date,
  gender       text,
  nationality  text,
  -- Inner Line Permit is mandatory for several Northeast states; operators
  -- need the ID on file to raise it. Stored as type + number, never scanned
  -- documents in this table (those go to private storage).
  id_type      text,                            -- aadhaar|passport|voter|dl
  id_number    text,
  id_document_path text,
  meal_pref    text,
  medical_notes text,
  position     integer not null default 0
);

create index booking_travellers_idx on booking_travellers(booking_id, position);

-- -----------------------------------------------------------------------------
-- Payments
-- -----------------------------------------------------------------------------
create table payments (
  id               uuid primary key default gen_random_uuid(),
  agency_id        uuid not null references agencies(id) on delete cascade,
  booking_id       uuid references bookings(id) on delete set null,
  direction        payment_direction not null default 'inbound',
  status           payment_status not null default 'created',
  amount_minor     integer not null check (amount_minor > 0),
  currency         char(3) not null default 'INR',
  method           text,                 -- upi|card|netbanking|cash|bank_transfer
  gateway          text,                 -- razorpay|manual
  gateway_order_id text,
  gateway_payment_id text unique,
  -- Idempotency guard for webhook replays
  gateway_event_id text unique,
  failure_reason   text,
  -- True when GoDND collected it (marketplace); false when the operator did
  collected_by_platform boolean not null default false,
  paid_at          timestamptz,
  raw_payload      jsonb,
  created_at       timestamptz not null default now()
);

create index payments_booking_idx on payments(booking_id);
create index payments_agency_idx  on payments(agency_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Invoices — GST-aware, since operators bill Indian customers
-- -----------------------------------------------------------------------------
create table invoices (
  id              uuid primary key default gen_random_uuid(),
  agency_id       uuid not null references agencies(id) on delete cascade,
  booking_id      uuid references bookings(id) on delete set null,
  number          text not null,          -- per-tenant financial-year series
  status          invoice_status not null default 'draft',

  bill_to_name    text not null,
  bill_to_email   citext,
  bill_to_phone   text,
  bill_to_address jsonb not null default '{}'::jsonb,
  bill_to_gstin   text,
  place_of_supply text,                   -- state code; drives CGST/SGST vs IGST

  -- [{description, hsn_sac, qty, unit_price_minor, tax_rate_bps, amount_minor}]
  line_items      jsonb not null default '[]'::jsonb,
  currency        char(3) not null default 'INR',
  subtotal_minor  integer not null default 0,
  discount_minor  integer not null default 0,
  cgst_minor      integer not null default 0,
  sgst_minor      integer not null default 0,
  igst_minor      integer not null default 0,
  total_minor     integer not null default 0,
  amount_paid_minor integer not null default 0,

  notes           text,
  terms           text,
  issued_at       timestamptz,
  due_at          date,
  voided_at       timestamptz,
  pdf_path        text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint invoices_number_unique unique (agency_id, number)
);

create index invoices_agency_idx on invoices(agency_id, status, issued_at desc nulls last);

-- -----------------------------------------------------------------------------
-- Payouts — what GoDND owes each operator for marketplace bookings
-- -----------------------------------------------------------------------------
create table payouts (
  id             uuid primary key default gen_random_uuid(),
  agency_id      uuid not null references agencies(id) on delete cascade,
  reference      text not null unique,
  status         payout_status not null default 'pending',
  period_start   date not null,
  period_end     date not null,
  currency       char(3) not null default 'INR',
  gross_minor    integer not null default 0,
  commission_minor integer not null default 0,
  adjustment_minor integer not null default 0,
  net_minor      integer not null default 0,
  utr            text,                    -- bank reference once paid
  paid_at        timestamptz,
  notes          text,
  created_at     timestamptz not null default now(),
  constraint payouts_period check (period_end >= period_start)
);

create table payout_items (
  payout_id   uuid not null references payouts(id) on delete cascade,
  booking_id  uuid not null references bookings(id) on delete cascade,
  gross_minor integer not null,
  commission_minor integer not null,
  net_minor   integer not null,
  primary key (payout_id, booking_id)
);

create table agency_bank_accounts (
  id             uuid primary key default gen_random_uuid(),
  agency_id      uuid not null references agencies(id) on delete cascade,
  account_name   text not null,
  -- Only the last four are kept in the clear; the full number is held by the
  -- payout gateway and referenced by token. Nothing sensitive sits in Postgres.
  account_last4  char(4),
  ifsc           text,
  bank_name      text,
  gateway_token  text,
  is_primary     boolean not null default false,
  verified_at    timestamptz,
  created_at     timestamptz not null default now()
);

create unique index agency_bank_primary on agency_bank_accounts(agency_id) where is_primary;

-- -----------------------------------------------------------------------------
-- Reviews & traveller wishlist
-- -----------------------------------------------------------------------------
create table reviews (
  id           uuid primary key default gen_random_uuid(),
  agency_id    uuid not null references agencies(id) on delete cascade,
  experience_id uuid references experiences(id) on delete set null,
  booking_id   uuid references bookings(id) on delete set null,
  traveller_id uuid not null references profiles(id) on delete cascade,
  rating       integer not null check (rating between 1 and 5),
  title        text,
  body         text,
  is_published boolean not null default false,
  agency_reply text,
  replied_at   timestamptz,
  created_at   timestamptz not null default now(),
  -- One review per booking keeps the rating honest.
  constraint reviews_one_per_booking unique (booking_id, traveller_id)
);

create table saved_experiences (
  traveller_id uuid not null references profiles(id) on delete cascade,
  experience_id uuid not null references experiences(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (traveller_id, experience_id)
);

-- -----------------------------------------------------------------------------
-- Per-tenant reference sequences (ENQ-000142 etc.)
-- Counter row per (agency, kind) updated inside the same transaction as the
-- insert, so numbers are gapless per tenant.
-- -----------------------------------------------------------------------------
create table reference_counters (
  agency_id uuid not null references agencies(id) on delete cascade,
  kind      text not null,          -- 'enquiry' | 'booking' | 'invoice' | 'payout'
  value     integer not null default 0,
  primary key (agency_id, kind)
);

create or replace function next_reference(p_agency uuid, p_kind text, p_prefix text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  insert into reference_counters (agency_id, kind, value)
  values (p_agency, p_kind, 1)
  on conflict (agency_id, kind)
    do update set value = reference_counters.value + 1
  returning value into n;

  return p_prefix || '-' || lpad(n::text, 6, '0');
end;
$$;

create or replace function assign_reference()
returns trigger
language plpgsql
as $$
begin
  if new.reference is null or new.reference = '' then
    new.reference := next_reference(new.agency_id, tg_argv[0], tg_argv[1]);
  end if;
  return new;
end;
$$;

alter table enquiries alter column reference drop not null;
alter table bookings  alter column reference drop not null;

create trigger enquiries_reference before insert on enquiries
  for each row execute function assign_reference('enquiry', 'ENQ');
create trigger bookings_reference before insert on bookings
  for each row execute function assign_reference('booking', 'BKG');

create trigger enquiries_touch before update on enquiries for each row execute function touch_updated_at();
create trigger bookings_touch  before update on bookings  for each row execute function touch_updated_at();
create trigger invoices_touch  before update on invoices  for each row execute function touch_updated_at();

-- Keep the enquiry inbox ordering fresh without an application write.
create or replace function bump_enquiry_activity()
returns trigger
language plpgsql
as $$
begin
  update enquiries
  set last_message_at = new.created_at,
      unread_for_agent = case
        when new.sender_kind = 'traveller' then unread_for_agent + 1
        else unread_for_agent end,
      unread_for_traveller = case
        when new.sender_kind = 'agent' and not new.is_internal then unread_for_traveller + 1
        else unread_for_traveller end,
      status = case when status = 'new' and new.sender_kind = 'agent' then 'open' else status end
  where id = new.enquiry_id;
  return new;
end;
$$;

create trigger enquiry_messages_bump after insert on enquiry_messages
  for each row execute function bump_enquiry_activity();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table enquiries            enable row level security;
alter table enquiry_messages     enable row level security;
alter table bookings             enable row level security;
alter table booking_travellers   enable row level security;
alter table payments             enable row level security;
alter table invoices             enable row level security;
alter table payouts              enable row level security;
alter table payout_items         enable row level security;
alter table agency_bank_accounts enable row level security;
alter table reviews              enable row level security;
alter table saved_experiences    enable row level security;

-- Enquiries: the owning tenant, plus the traveller who raised it.
create policy enquiries_read on enquiries for select
  using (is_agency_member(agency_id) or traveller_id = auth.uid() or is_platform_admin());
create policy enquiries_agency_write on enquiries for all
  using (is_agency_member(agency_id)) with check (is_agency_member(agency_id));

create or replace function can_access_enquiry(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from enquiries e
    where e.id = target
      and (is_agency_member(e.agency_id) or e.traveller_id = auth.uid() or is_platform_admin())
  );
$$;

-- Travellers must never see internal notes, even on their own thread.
create policy enquiry_messages_read on enquiry_messages for select
  using (
    can_access_enquiry(enquiry_id)
    and (
      not is_internal
      or exists (select 1 from enquiries e where e.id = enquiry_id and is_agency_member(e.agency_id))
    )
  );
create policy enquiry_messages_write on enquiry_messages for insert
  with check (can_access_enquiry(enquiry_id));

-- Bookings & money: tenant staff, plus the traveller for their own booking.
create policy bookings_read on bookings for select
  using (is_agency_member(agency_id) or traveller_id = auth.uid() or is_platform_admin());
create policy bookings_write on bookings for all
  using (is_agency_member(agency_id)) with check (is_agency_member(agency_id));

create policy booking_travellers_rw on booking_travellers for all
  using (exists (select 1 from bookings b where b.id = booking_id
                 and (is_agency_member(b.agency_id) or b.traveller_id = auth.uid())))
  with check (exists (select 1 from bookings b where b.id = booking_id
                 and (is_agency_member(b.agency_id) or b.traveller_id = auth.uid())));

-- Payments are written only by trusted server code (gateway webhooks), so
-- there is no insert/update policy here at all — reads only.
create policy payments_read on payments for select
  using (is_agency_member(agency_id)
         or is_platform_admin()
         or exists (select 1 from bookings b where b.id = booking_id and b.traveller_id = auth.uid()));

create policy invoices_read on invoices for select
  using (is_agency_member(agency_id)
         or is_platform_admin()
         or exists (select 1 from bookings b where b.id = booking_id and b.traveller_id = auth.uid()));
create policy invoices_write on invoices for all
  using (has_agency_role(agency_id, array['owner','admin','finance']::agency_role[]))
  with check (has_agency_role(agency_id, array['owner','admin','finance']::agency_role[]));

-- Payouts are platform-generated; operators read their own.
create policy payouts_read on payouts for select
  using (is_agency_member(agency_id) or is_platform_admin());
create policy payout_items_read on payout_items for select
  using (exists (select 1 from payouts p where p.id = payout_id
                 and (is_agency_member(p.agency_id) or is_platform_admin())));

create policy bank_accounts_rw on agency_bank_accounts for all
  using (has_agency_role(agency_id, array['owner','finance']::agency_role[]) or is_platform_admin())
  with check (has_agency_role(agency_id, array['owner','finance']::agency_role[]) or is_platform_admin());

-- Reviews: published ones are public; authors and the tenant see their own.
create policy reviews_read on reviews for select
  using (is_published or traveller_id = auth.uid() or is_agency_member(agency_id) or is_platform_admin());
create policy reviews_author_write on reviews for insert
  with check (traveller_id = auth.uid());
create policy reviews_agency_reply on reviews for update
  using (is_agency_member(agency_id)) with check (is_agency_member(agency_id));

create policy saved_experiences_rw on saved_experiences for all
  using (traveller_id = auth.uid()) with check (traveller_id = auth.uid());

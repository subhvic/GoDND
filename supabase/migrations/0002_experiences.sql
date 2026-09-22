-- =============================================================================
-- GoDND — Experiences (the Figma vocabulary), itinerary builder, pricing
-- =============================================================================
-- This mirrors the Admin Portal V1 Handoff file exactly. Naming follows the
-- design: the product is an "Experience", not an itinerary. The itinerary is
-- the day-by-day plan *inside* an experience, which is why the builder is
-- Step 2 of 7 rather than the object itself.
--
-- The 7-step creation wizard maps to storage as:
--   1 Basic Info            -> experiences
--   2 Itinerary Builder     -> experience_days + experience_activities
--   3 Crew & Trip Capacity  -> experiences.* + experience_crew
--   4 Pricing Strategy      -> experiences.* + experience_price_tiers
--   5 Availability Calendar -> experience_availability + experience_blackouts
--   6 Support & Policies    -> experience_policies
--   7 Media & Overview      -> experience_media
--
-- A draft is a real row from step 1 onward ("Save as Draft" is on every step),
-- so almost every column outside Basic Info must be nullable. Completeness is
-- enforced at submit time by a validation function, not by NOT NULL.
-- =============================================================================

create type experience_kind    as enum ('general', 'quick', 'super', 'general_joinee');
create type experience_status  as enum ('draft', 'under_review', 'active', 'disabled', 'archived', 'rejected');
create type group_sizing       as enum ('fixed', 'flexible');
create type onboarding_strategy as enum ('open', 'invite_only', 'request_to_join');
create type pricing_mode       as enum ('unit_multiply', 'variable');
create type activity_kind      as enum ('stop_location', 'stay', 'meal', 'transfer', 'trek', 'activity', 'free_time');
create type media_kind         as enum ('image', 'video', 'document');
create type food_included      as enum ('none', 'breakfast_dinner', 'breakfast_lunch_dinner');
create type food_preference    as enum ('veg_only', 'non_veg_only', 'both');

-- -----------------------------------------------------------------------------
-- Taxonomy — platform-owned so marketplace filters stay coherent across tenants
-- -----------------------------------------------------------------------------
create table regions (
  id         uuid primary key default gen_random_uuid(),
  slug       citext not null unique,
  name       text not null,              -- 'Meghalaya', 'Assam'
  kind       text not null default 'state',
  parent_id  uuid references regions(id) on delete set null,
  latitude   numeric(9,6),
  longitude  numeric(9,6),
  is_active  boolean not null default true
);

-- Categories ('Adventure', 'Culture & Heritage'), activity tags ('Rafting',
-- 'Camping'), languages — one table, discriminated by `kind`. Three near
-- identical tables would earn nothing.
create table taxonomy_terms (
  id        uuid primary key default gen_random_uuid(),
  kind      text not null,               -- category | activity | language
  slug      citext not null,
  name      text not null,
  icon      text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  constraint taxonomy_terms_unique unique (kind, slug)
);

-- -----------------------------------------------------------------------------
-- experiences — Step 1 Basic Info, plus the state machine
-- -----------------------------------------------------------------------------
create table experiences (
  id                 uuid primary key default gen_random_uuid(),
  agency_id          uuid not null references agencies(id) on delete cascade,
  -- "Exp ID - 0045835" in the detail drawer. Platform-wide, not per-tenant:
  -- support and travellers quote it across agencies.
  public_ref         text not null unique,
  slug               citext not null,

  title              text not null,
  subtitle           text,
  overview           text,

  -- --- Status. Matches the Experiences table tabs exactly:
  -- Active / Under Review / Drafts / Disabled / Archived
  status             experience_status not null default 'draft',
  -- Independent of status: an active experience may be shown on the operator's
  -- own white-label site but withheld from the GoDND marketplace. This is the
  -- "star mark to list" switch, and it is NOT in the handoff file — see
  -- docs/FIGMA-TEARDOWN.md, gap 1.
  list_on_marketplace boolean not null default false,
  list_on_own_site    boolean not null default true,

  kind               experience_kind not null default 'general',

  -- Step 1 fields
  duration_days      integer check (duration_days between 1 and 90),
  duration_nights    integer check (duration_nights >= 0),
  min_age            integer,
  max_age            integer,
  food_included      food_included,
  food_preference    food_preference,

  -- Step 3 Crew & Trip Capacity
  trip_captain_id    uuid references profiles(id) on delete set null,
  coordinator_id     uuid references profiles(id) on delete set null,
  has_ground_crew    boolean not null default false,
  onboarding_strategy onboarding_strategy not null default 'open',
  group_sizing       group_sizing not null default 'fixed',
  max_group_size     integer check (max_group_size is null or max_group_size > 0),
  -- "10 - Flexible, 2 groups max." in the detail drawer
  max_parallel_groups integer,

  -- Step 4 Pricing Strategy
  base_price_minor   integer check (base_price_minor >= 0),
  currency           char(3) not null default 'INR',
  pricing_mode       pricing_mode not null default 'unit_multiply',
  max_guests_per_booking integer check (max_guests_per_booking is null or max_guests_per_booking > 0),
  gst_rate_bps       integer not null default 500,   -- 5% on tour packages

  -- Pick-up / drop, surfaced as "Pick-up at Guwahati ... Drop at Guwahati"
  pickup_region_id   uuid references regions(id) on delete set null,
  pickup_location    text,
  dropoff_region_id  uuid references regions(id) on delete set null,
  dropoff_location   text,

  cover_image_url    text,
  meta_title         text,
  meta_description   text,

  -- Denormalised counters shown on the detail drawer without extra queries
  rating_avg         numeric(3,2),
  rating_count       integer not null default 0,
  bookings_completed integer not null default 0,
  upcoming_bookings  integer not null default 0,
  view_count         integer not null default 0,

  -- Review workflow (Approval History card)
  submitted_at       timestamptz,
  approved_at        timestamptz,
  rejected_at        timestamptz,
  review_note        text,
  reviewed_by        uuid references profiles(id) on delete set null,
  -- "Approval Requested — 21 changes made": an active experience that is edited
  -- goes back through review, so we track the pending revision separately from
  -- the live one.
  revision           integer not null default 1,

  created_by         uuid references profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint experiences_slug_unique unique (agency_id, slug),
  constraint experiences_age_range check (max_age is null or min_age is null or max_age >= min_age)
);

create index experiences_agency_status_idx on experiences(agency_id, status, updated_at desc);
create index experiences_marketplace_idx   on experiences(status, approved_at desc)
  where status = 'active' and list_on_marketplace;

alter table experiences add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(subtitle, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(overview, '')), 'C')
  ) stored;
create index experiences_search_idx on experiences using gin(search_vector);

-- Multi-select fields from Basic Info. Join tables rather than arrays so the
-- marketplace can filter with an index instead of a scan.
create table experience_regions (
  experience_id uuid not null references experiences(id) on delete cascade,
  region_id     uuid not null references regions(id) on delete cascade,
  primary key (experience_id, region_id)
);

create table experience_terms (
  experience_id uuid not null references experiences(id) on delete cascade,
  term_id       uuid not null references taxonomy_terms(id) on delete cascade,
  primary key (experience_id, term_id)
);

-- Step 3: "More people are involved in the ground" -> Add Members
create table experience_crew (
  experience_id uuid not null references experiences(id) on delete cascade,
  member_id     uuid not null references profiles(id) on delete cascade,
  role          text not null default 'crew',   -- captain|coordinator|crew|driver|guide
  position      integer not null default 0,
  primary key (experience_id, member_id)
);

-- -----------------------------------------------------------------------------
-- Step 2 — Itinerary Builder
-- The design is an activity timeline per day, not the stay/meals row model
-- typical of package tools. Each day optionally opens with a pick-up block and
-- carries an ordered list of activity cards, each with a map pin, a stoppage
-- time and its own images.
-- -----------------------------------------------------------------------------
create table experience_days (
  id            uuid primary key default gen_random_uuid(),
  experience_id uuid not null references experiences(id) on delete cascade,
  day_number    integer not null check (day_number >= 1),
  title         text,
  summary       text,

  -- "Pick-up" block. `pickup_included = false` renders the checked state of
  -- "Not included in the itinerary" and hides the rest of the block.
  pickup_included boolean not null default false,
  pickup_location text,
  pickup_region_id uuid references regions(id) on delete set null,
  pickup_time   time,
  pickup_lat    numeric(9,6),
  pickup_lng    numeric(9,6),

  created_at    timestamptz not null default now(),
  constraint experience_days_unique unique (experience_id, day_number)
);

create table experience_activities (
  id            uuid primary key default gen_random_uuid(),
  day_id        uuid not null references experience_days(id) on delete cascade,
  position      integer not null default 0,
  title         text not null,              -- "Arrive at Umiam Lake Viewpoint"
  kind          activity_kind not null default 'stop_location',
  -- "Stoppage Time — 60 mins". Minutes, because the control is a minute picker.
  stoppage_min  integer check (stoppage_min is null or stoppage_min >= 0),
  location_name text,
  region_id     uuid references regions(id) on delete set null,
  latitude      numeric(9,6),
  longitude     numeric(9,6),
  comment       text,
  created_at    timestamptz not null default now()
);

create index experience_activities_idx on experience_activities(day_id, position);

-- -----------------------------------------------------------------------------
-- Step 4 — variable pricing.
-- "Set variable Pricing" gives a price per guest COUNT (2 guests ₹13,500,
-- 3 guests ₹19,500, 4 guests ₹25,500) — a total for the group, not per head.
-- Storing it as (guest_count -> total) matches the form one-to-one and avoids
-- reverse-engineering per-head maths that the operator never entered.
-- -----------------------------------------------------------------------------
create table experience_price_tiers (
  experience_id uuid not null references experiences(id) on delete cascade,
  guest_count   integer not null check (guest_count >= 1),
  total_minor   integer not null check (total_minor >= 0),
  primary key (experience_id, guest_count)
);

-- Coupons drive the "Price Preview for Your Guests" breakup (MYFIRSTDND, 20% off).
create table coupons (
  id             uuid primary key default gen_random_uuid(),
  -- Null agency_id = a platform-wide coupon funded by GoDND.
  agency_id      uuid references agencies(id) on delete cascade,
  code           citext not null unique,
  description    text,
  discount_type  text not null default 'percent',   -- percent|flat
  discount_value integer not null,                  -- bps if percent, minor if flat
  max_discount_minor integer,
  min_order_minor integer,
  usage_limit    integer,
  usage_count    integer not null default 0,
  per_user_limit integer default 1,
  starts_at      timestamptz,
  ends_at        timestamptz,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

create table experience_coupons (
  experience_id uuid not null references experiences(id) on delete cascade,
  coupon_id     uuid not null references coupons(id) on delete cascade,
  primary key (experience_id, coupon_id)
);

-- -----------------------------------------------------------------------------
-- Step 5 — Availability Calendar ("Add availability" / "Mark Holidays")
-- Inventory is per departure date. Blackouts are stored separately so an
-- operator can mark holidays without destroying the availability rows.
-- -----------------------------------------------------------------------------
create table experience_availability (
  id            uuid primary key default gen_random_uuid(),
  experience_id uuid not null references experiences(id) on delete cascade,
  start_date    date not null,
  end_date      date not null,
  total_slots   integer not null check (total_slots > 0),
  booked_slots  integer not null default 0 check (booked_slots >= 0),
  -- Overrides experiences.base_price_minor for this departure when set.
  price_minor   integer,
  is_open       boolean not null default true,
  notes         text,
  constraint availability_dates check (end_date >= start_date),
  constraint availability_slots check (booked_slots <= total_slots)
);

create index experience_availability_idx on experience_availability(experience_id, start_date);

create table experience_blackouts (
  id            uuid primary key default gen_random_uuid(),
  experience_id uuid not null references experiences(id) on delete cascade,
  start_date    date not null,
  end_date      date not null,
  reason        text,
  constraint blackout_dates check (end_date >= start_date)
);

-- -----------------------------------------------------------------------------
-- Step 6 — Support & Policies
-- -----------------------------------------------------------------------------
create table experience_policies (
  experience_id     uuid primary key references experiences(id) on delete cascade,
  inclusions        text[] not null default '{}',
  exclusions        text[] not null default '{}',
  things_to_carry   text[] not null default '{}',
  cancellation_policy text,
  refund_policy     text,
  -- [{question, answer}] — ordered, editable, no schema churn per FAQ.
  faqs              jsonb not null default '[]'::jsonb,
  support_phone     text,
  support_email     citext,
  support_hours     text,
  emergency_contact text,
  terms             text
);

-- -----------------------------------------------------------------------------
-- Step 7 — Media & Overview. "Media from Guests" is post-trip UGC, which is
-- why source is tracked rather than assumed.
-- -----------------------------------------------------------------------------
create table experience_media (
  id            uuid primary key default gen_random_uuid(),
  experience_id uuid not null references experiences(id) on delete cascade,
  -- Set when the asset belongs to one activity card (Itinerary Builder uploads)
  activity_id   uuid references experience_activities(id) on delete cascade,
  kind          media_kind not null default 'image',
  source        text not null default 'agency',   -- agency | guest
  uploaded_by   uuid references profiles(id) on delete set null,
  url           text not null,
  storage_path  text,
  alt_text      text,          -- required by the form layer for WCAG AA
  caption       text,
  width         integer,
  height        integer,
  position      integer not null default 0,
  is_cover      boolean not null default false,
  created_at    timestamptz not null default now()
);

create index experience_media_idx on experience_media(experience_id, position);
create index experience_media_activity_idx on experience_media(activity_id) where activity_id is not null;

-- -----------------------------------------------------------------------------
-- Approval history — the "Approval Requested / Experience Activated" timeline
-- -----------------------------------------------------------------------------
create table experience_reviews (
  id            uuid primary key default gen_random_uuid(),
  experience_id uuid not null references experiences(id) on delete cascade,
  revision      integer not null,
  event         text not null,            -- submitted|approved|rejected|disabled|changes_made
  changes_count integer,
  note          text,
  actor_id      uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index experience_reviews_idx on experience_reviews(experience_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Public reference: EXP-0045835, platform-wide
-- -----------------------------------------------------------------------------
create sequence experience_ref_seq start 45835;

create or replace function assign_experience_ref()
returns trigger
language plpgsql
as $$
begin
  if new.public_ref is null or new.public_ref = '' then
    new.public_ref := lpad(nextval('experience_ref_seq')::text, 7, '0');
  end if;
  return new;
end;
$$;

alter table experiences alter column public_ref drop not null;

create trigger experiences_ref before insert on experiences
  for each row execute function assign_experience_ref();
create trigger experiences_touch before update on experiences
  for each row execute function touch_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table regions                  enable row level security;
alter table taxonomy_terms           enable row level security;
alter table experiences              enable row level security;
alter table experience_regions       enable row level security;
alter table experience_terms         enable row level security;
alter table experience_crew          enable row level security;
alter table experience_days          enable row level security;
alter table experience_activities    enable row level security;
alter table experience_price_tiers   enable row level security;
alter table experience_availability  enable row level security;
alter table experience_blackouts     enable row level security;
alter table experience_policies      enable row level security;
alter table experience_media         enable row level security;
alter table experience_reviews       enable row level security;
alter table coupons                  enable row level security;
alter table experience_coupons       enable row level security;

create policy regions_read  on regions        for select using (true);
create policy terms_read    on taxonomy_terms for select using (true);

create policy experiences_read on experiences for select
  using (
    is_agency_member(agency_id)
    or is_platform_admin()
    or (status = 'active' and list_on_marketplace)
  );

-- Finance-only staff are excluded: they have no business editing trip content.
create policy experiences_write on experiences for all
  using (has_agency_role(agency_id, array['owner','admin','sales','ops']::agency_role[]))
  with check (has_agency_role(agency_id, array['owner','admin','sales','ops']::agency_role[]));

create or replace function can_read_experience(target uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from experiences e
    where e.id = target
      and (is_agency_member(e.agency_id)
           or is_platform_admin()
           or (e.status = 'active' and e.list_on_marketplace))
  );
$$;

create or replace function can_edit_experience(target uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from experiences e
    where e.id = target
      and has_agency_role(e.agency_id, array['owner','admin','sales','ops']::agency_role[])
  );
$$;

-- One shape, applied to every child table, so none can drift out of step.
do $$
declare t text;
begin
  foreach t in array array[
    'experience_regions', 'experience_terms', 'experience_crew',
    'experience_days', 'experience_price_tiers', 'experience_availability',
    'experience_blackouts', 'experience_policies', 'experience_media',
    'experience_reviews', 'experience_coupons'
  ]
  loop
    execute format(
      'create policy %1$s_read on %1$s for select using (can_read_experience(experience_id))', t);
    execute format(
      'create policy %1$s_write on %1$s for all using (can_edit_experience(experience_id))
       with check (can_edit_experience(experience_id))', t);
  end loop;
end $$;

-- Activities hang off days, so they resolve the parent one level up.
create policy experience_activities_read on experience_activities for select
  using (exists (select 1 from experience_days d
                 where d.id = day_id and can_read_experience(d.experience_id)));
create policy experience_activities_write on experience_activities for all
  using (exists (select 1 from experience_days d
                 where d.id = day_id and can_edit_experience(d.experience_id)))
  with check (exists (select 1 from experience_days d
                 where d.id = day_id and can_edit_experience(d.experience_id)));

create policy coupons_read on coupons for select
  using (is_active or agency_id is null or is_agency_member(agency_id) or is_platform_admin());
create policy coupons_write on coupons for all
  using (agency_id is not null and has_agency_role(agency_id, array['owner','admin']::agency_role[]))
  with check (agency_id is not null and has_agency_role(agency_id, array['owner','admin']::agency_role[]));

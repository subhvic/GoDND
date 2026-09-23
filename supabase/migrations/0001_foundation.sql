-- =============================================================================
-- GoDND — Foundation: tenancy, identity, plans, white-label domains
-- =============================================================================
-- Tenancy model: an `agency` is the tenant. Every business row carries
-- agency_id and is isolated by RLS. Platform staff (GoDND) are identified by
-- profiles.is_platform_admin and bypass tenant scoping through explicit
-- policies, never through the service key in user-facing code paths.
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type agency_status      as enum ('pending', 'active', 'suspended', 'closed');
create type agency_role        as enum ('owner', 'admin', 'sales', 'ops', 'finance');
create type member_status      as enum ('invited', 'active', 'disabled');
create type domain_kind        as enum ('subdomain', 'custom');
create type domain_status      as enum ('pending', 'verifying', 'active', 'failed');
create type subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'expired');

-- -----------------------------------------------------------------------------
-- profiles — one row per auth user (agency staff, travellers, platform admins)
-- -----------------------------------------------------------------------------
create table profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  email              citext not null,
  full_name          text,
  phone              text,
  avatar_url         text,
  -- A traveller and an agency member are the same identity type; capability
  -- comes from agency_members rows, not from a role column. This lets an
  -- operator's owner also book as a traveller without a second account.
  is_platform_admin  boolean not null default false,
  marketing_opt_in   boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- plans — SaaS subscription tiers. Limits/features are jsonb so pricing can be
-- iterated without a migration; gate checks read through a typed helper.
-- -----------------------------------------------------------------------------
create table plans (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique,          -- 'starter' | 'growth' | 'scale'
  name               text not null,
  description        text,
  price_minor        integer not null default 0,    -- paise; avoids float money
  currency           char(3) not null default 'INR',
  interval           text not null default 'month', -- 'month' | 'year'
  commission_bps     integer not null default 0,    -- marketplace take rate, basis points
  -- e.g. {"itineraries": 25, "seats": 3, "custom_domain": false, "storage_mb": 2048}
  limits             jsonb not null default '{}'::jsonb,
  features           jsonb not null default '{}'::jsonb,
  is_public          boolean not null default true,
  sort_order         integer not null default 0,
  created_at         timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- agencies — the tenant
-- -----------------------------------------------------------------------------
create table agencies (
  id                 uuid primary key default gen_random_uuid(),
  -- slug doubles as the default subdomain: {slug}.godnd.site
  slug               citext not null unique,
  name               text not null,
  legal_name         text,
  status             agency_status not null default 'pending',
  logo_url           text,
  support_email      citext,
  support_phone      text,
  website_url        text,
  about              text,
  -- India-specific compliance fields; nullable until onboarding completes
  gstin              text,
  pan                text,
  -- Ministry of Tourism / state tourism registration
  tourism_reg_no     text,
  address            jsonb not null default '{}'::jsonb,
  -- Marketplace trust signals, denormalised for listing pages
  is_marketplace_verified boolean not null default false,
  rating_avg         numeric(3,2),
  rating_count       integer not null default 0,
  onboarding_step    text,
  created_by         uuid references profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint agencies_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$')
);

create index agencies_status_idx on agencies(status);

-- -----------------------------------------------------------------------------
-- agency_members — staff of a tenant, with role
-- -----------------------------------------------------------------------------
create table agency_members (
  id                 uuid primary key default gen_random_uuid(),
  agency_id          uuid not null references agencies(id) on delete cascade,
  user_id            uuid references profiles(id) on delete cascade,
  invited_email      citext,
  role               agency_role not null default 'sales',
  status             member_status not null default 'invited',
  invited_by         uuid references profiles(id) on delete set null,
  invite_token       text unique,
  invite_expires_at  timestamptz,
  accepted_at        timestamptz,
  created_at         timestamptz not null default now(),
  -- Either a linked user or a pending invite email, never neither
  constraint agency_members_identity check (user_id is not null or invited_email is not null)
);

create unique index agency_members_unique_user on agency_members(agency_id, user_id)
  where user_id is not null;
create unique index agency_members_unique_invite on agency_members(agency_id, invited_email)
  where user_id is null;
create index agency_members_user_idx on agency_members(user_id);

-- -----------------------------------------------------------------------------
-- subscriptions — one active subscription per agency
-- -----------------------------------------------------------------------------
create table subscriptions (
  id                    uuid primary key default gen_random_uuid(),
  agency_id             uuid not null references agencies(id) on delete cascade,
  plan_id               uuid not null references plans(id),
  status                subscription_status not null default 'trialing',
  trial_ends_at         timestamptz,
  current_period_start  timestamptz not null default now(),
  current_period_end    timestamptz,
  cancel_at_period_end  boolean not null default false,
  canceled_at           timestamptz,
  -- Razorpay subscription id (or Stripe, if we go global later)
  gateway               text,
  gateway_ref           text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create unique index subscriptions_one_live_per_agency on subscriptions(agency_id)
  where status in ('trialing', 'active', 'past_due');

-- -----------------------------------------------------------------------------
-- agency_domains — white-label hosting.
--   subdomain rows:  {slug}.godnd.site, created automatically, always verified
--   custom rows:     operator's own domain, verified by DNS TXT then CNAME
-- The Next.js proxy resolves an incoming Host header against this table.
-- -----------------------------------------------------------------------------
create table agency_domains (
  id                 uuid primary key default gen_random_uuid(),
  agency_id          uuid not null references agencies(id) on delete cascade,
  hostname           citext not null unique,
  kind               domain_kind not null default 'custom',
  status             domain_status not null default 'pending',
  is_primary         boolean not null default false,
  -- TXT record the operator adds to prove ownership: _godnd-verify.{host}
  verification_token text not null default encode(gen_random_bytes(16), 'hex'),
  verified_at        timestamptz,
  last_checked_at    timestamptz,
  last_error         text,
  -- Vercel (or equivalent) domain attachment id, for cert provisioning
  provider_ref       text,
  created_at         timestamptz not null default now()
);

create unique index agency_domains_one_primary on agency_domains(agency_id) where is_primary;
create index agency_domains_lookup on agency_domains(hostname) where status = 'active';

-- -----------------------------------------------------------------------------
-- Helper functions used by every RLS policy.
-- SECURITY DEFINER + a pinned search_path so policies can read membership
-- without recursing into agency_members' own RLS.
-- -----------------------------------------------------------------------------
create or replace function auth_agency_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select agency_id
  from agency_members
  where user_id = auth.uid()
    and status = 'active';
$$;

create or replace function is_agency_member(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from agency_members
    where agency_id = target and user_id = auth.uid() and status = 'active'
  );
$$;

create or replace function has_agency_role(target uuid, roles agency_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from agency_members
    where agency_id = target
      and user_id = auth.uid()
      and status = 'active'
      and role = any(roles)
  );
$$;

create or replace function is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_platform_admin from profiles where id = auth.uid()),
    false
  );
$$;

-- -----------------------------------------------------------------------------
-- updated_at trigger
-- -----------------------------------------------------------------------------
create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch      before update on profiles      for each row execute function touch_updated_at();
create trigger agencies_touch      before update on agencies      for each row execute function touch_updated_at();
create trigger subscriptions_touch before update on subscriptions for each row execute function touch_updated_at();

-- -----------------------------------------------------------------------------
-- New auth user -> profile
-- -----------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table profiles       enable row level security;
alter table plans          enable row level security;
alter table agencies       enable row level security;
alter table agency_members enable row level security;
alter table subscriptions  enable row level security;
alter table agency_domains enable row level security;

-- profiles: you see yourself; platform admins see everyone.
create policy profiles_self_read on profiles for select
  using (id = auth.uid() or is_platform_admin());
create policy profiles_self_write on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- plans: public catalogue.
create policy plans_public_read on plans for select using (is_public or is_platform_admin());

-- agencies: members read their own; anyone reads active agencies (marketplace
-- storefronts and operator profile pages are public by design).
create policy agencies_public_read on agencies for select
  using (status = 'active' or is_agency_member(id) or is_platform_admin());
create policy agencies_owner_update on agencies for update
  using (has_agency_role(id, array['owner','admin']::agency_role[]) or is_platform_admin());

-- agency_members: visible within the tenant.
create policy members_read on agency_members for select
  using (user_id = auth.uid() or is_agency_member(agency_id) or is_platform_admin());
create policy members_manage on agency_members for all
  using (has_agency_role(agency_id, array['owner','admin']::agency_role[]) or is_platform_admin())
  with check (has_agency_role(agency_id, array['owner','admin']::agency_role[]) or is_platform_admin());

-- subscriptions: tenant-readable, platform-writable (gateway webhooks only).
create policy subscriptions_read on subscriptions for select
  using (is_agency_member(agency_id) or is_platform_admin());

-- domains: tenant-managed. Public read is needed so the edge proxy can
-- resolve a hostname before any session exists.
create policy domains_public_read on agency_domains for select
  using (status = 'active' or is_agency_member(agency_id) or is_platform_admin());
create policy domains_manage on agency_domains for all
  using (has_agency_role(agency_id, array['owner','admin']::agency_role[]) or is_platform_admin())
  with check (has_agency_role(agency_id, array['owner','admin']::agency_role[]) or is_platform_admin());

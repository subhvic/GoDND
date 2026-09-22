-- =============================================================================
-- GoDND — White-label consumer sites, theming, CMS pages, platform plumbing
-- =============================================================================
-- Theming is stored as design TOKENS, not as free CSS. Operators pick a preset
-- and adjust a bounded set of values; the consumer site renders them as CSS
-- custom properties. This is the only approach that keeps every tenant site
-- accessible and on-brand — letting operators paste arbitrary CSS would make
-- WCAG AA unenforceable and every support ticket a CSS debugging session.
-- =============================================================================

create type page_status as enum ('draft', 'published');

create table agency_sites (
  id                uuid primary key default gen_random_uuid(),
  agency_id         uuid not null references agencies(id) on delete cascade unique,
  is_published      boolean not null default false,

  -- Identity
  site_name         text,
  tagline           text,
  logo_url          text,
  logo_dark_url     text,
  favicon_url       text,
  og_image_url      text,

  -- Theme tokens. Colours are stored as hex and validated for AA contrast in
  -- the editor before save; the preset gives operators a safe starting point.
  theme_preset      text not null default 'himalaya',
  color_primary     text not null default '#0F766E',
  color_primary_fg  text not null default '#FFFFFF',
  color_accent      text not null default '#F59E0B',
  color_bg          text not null default '#FFFFFF',
  color_fg          text not null default '#0B1220',
  color_muted       text not null default '#64748B',
  font_heading      text not null default 'Fraunces',
  font_body         text not null default 'Inter',
  radius_scale      text not null default 'md',      -- none|sm|md|lg|full
  density           text not null default 'comfortable',
  -- Operators may opt into a dark theme for their own site independently of
  -- the visitor's OS preference.
  dark_mode         text not null default 'system',  -- off|system|on

  -- Layout choices, bounded to options we actually ship templates for
  hero_layout       text not null default 'split',   -- split|full-bleed|search-first
  nav_style         text not null default 'standard',
  listing_layout    text not null default 'grid',    -- grid|list|masonry

  -- Content blocks for the home page, ordered; each block is a typed object
  -- validated by zod at the edge. jsonb keeps the editor flexible without a
  -- migration per new block type.
  home_blocks       jsonb not null default '[]'::jsonb,

  -- Contact / conversion
  whatsapp_number   text,
  contact_email     citext,
  contact_phone     text,
  address_line      text,
  social_links      jsonb not null default '{}'::jsonb,
  -- Enquiry-led vs. instant-book. Many small operators want enquiry only.
  booking_mode      text not null default 'enquiry', -- enquiry|instant|both

  -- SEO & analytics
  meta_title        text,
  meta_description  text,
  ga_measurement_id text,
  meta_pixel_id     text,
  custom_head_html  text,      -- platform-admin-gated; sanitised before render

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Lightweight CMS for the pages every travel site needs.
create table site_pages (
  id           uuid primary key default gen_random_uuid(),
  agency_id    uuid not null references agencies(id) on delete cascade,
  slug         citext not null,
  title        text not null,
  status       page_status not null default 'draft',
  blocks       jsonb not null default '[]'::jsonb,
  meta_title   text,
  meta_description text,
  show_in_nav  boolean not null default false,
  nav_position integer not null default 0,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint site_pages_slug_unique unique (agency_id, slug)
);

-- Which marketplace experiences an operator features on their own site, and in
-- what order. Separate from `status` so the site's shop window is curated.
create table site_featured_experiences (
  agency_id    uuid not null references agencies(id) on delete cascade,
  experience_id uuid not null references experiences(id) on delete cascade,
  position     integer not null default 0,
  primary key (agency_id, experience_id)
);

create table site_testimonials (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references agencies(id) on delete cascade,
  author_name text not null,
  author_role text,
  avatar_url  text,
  quote       text not null,
  rating      integer check (rating between 1 and 5),
  position    integer not null default 0,
  is_visible  boolean not null default true
);

-- -----------------------------------------------------------------------------
-- Platform plumbing
-- -----------------------------------------------------------------------------
create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  agency_id  uuid references agencies(id) on delete cascade,
  kind       text not null,          -- enquiry.new | booking.confirmed | payout.paid
  title      text not null,
  body       text,
  href       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on notifications(user_id, read_at, created_at desc);

-- Append-only trail for anything money- or permission-touching.
create table audit_log (
  id          bigserial primary key,
  agency_id   uuid references agencies(id) on delete set null,
  actor_id    uuid references profiles(id) on delete set null,
  action      text not null,          -- itinerary.listed | booking.refunded
  entity_type text not null,
  entity_id   uuid,
  before      jsonb,
  after       jsonb,
  ip          inet,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index audit_log_agency_idx on audit_log(agency_id, created_at desc);
create index audit_log_entity_idx on audit_log(entity_type, entity_id);

create trigger agency_sites_touch before update on agency_sites for each row execute function touch_updated_at();
create trigger site_pages_touch   before update on site_pages   for each row execute function touch_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table agency_sites              enable row level security;
alter table site_pages                enable row level security;
alter table site_featured_experiences enable row level security;
alter table site_testimonials         enable row level security;
alter table notifications             enable row level security;
alter table audit_log                 enable row level security;

-- Site config is publicly readable once published: the consumer site renders
-- for anonymous visitors, before any session exists.
create policy sites_read on agency_sites for select
  using (is_published or is_agency_member(agency_id) or is_platform_admin());
create policy sites_write on agency_sites for all
  using (has_agency_role(agency_id, array['owner','admin']::agency_role[]))
  with check (has_agency_role(agency_id, array['owner','admin']::agency_role[]));

create policy pages_read on site_pages for select
  using (status = 'published' or is_agency_member(agency_id) or is_platform_admin());
create policy pages_write on site_pages for all
  using (has_agency_role(agency_id, array['owner','admin']::agency_role[]))
  with check (has_agency_role(agency_id, array['owner','admin']::agency_role[]));

create policy featured_read on site_featured_experiences for select using (true);
create policy featured_write on site_featured_experiences for all
  using (has_agency_role(agency_id, array['owner','admin','sales']::agency_role[]))
  with check (has_agency_role(agency_id, array['owner','admin','sales']::agency_role[]));

create policy testimonials_read on site_testimonials for select
  using (is_visible or is_agency_member(agency_id));
create policy testimonials_write on site_testimonials for all
  using (is_agency_member(agency_id)) with check (is_agency_member(agency_id));

create policy notifications_own on notifications for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Audit log is readable by the tenant, never writable from the client.
create policy audit_read on audit_log for select
  using (is_agency_member(agency_id) or is_platform_admin());

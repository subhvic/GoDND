-- =============================================================================
-- GoDND — Persisting the Add New Experience wizard
-- =============================================================================
-- The wizard writes seven sections spread across ten tables. Doing that from
-- the client would mean ten round trips with no transaction around them: an
-- interrupted save would leave an experience with days but no pricing, which
-- is worse than no save at all. So the whole draft goes to Postgres as one
-- jsonb document and a single function fans it out. A plpgsql function runs in
-- one implicit transaction, so the write is all-or-nothing.
--
-- Both functions are SECURITY INVOKER: every statement inside runs as the
-- caller, so the RLS policies in 0002 decide what may be written. Nothing here
-- can be used to reach another operator's data.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Columns the wizard collects that the original schema did not model.
-- -----------------------------------------------------------------------------

-- The complete draft as last saved. Real columns below stay the queryable,
-- reportable truth; this is what the wizard reloads so that a field the schema
-- does not model yet is never silently dropped between sessions.
alter table experiences add column if not exists draft_payload jsonb;

-- Crew is chosen from a picker of names because Settings > My Team does not
-- exist yet, so there are no profiles to reference. trip_captain_id and
-- coordinator_id stay for when there are; these hold what the operator chose.
alter table experiences add column if not exists trip_captain_name text;
alter table experiences add column if not exists coordinator_name text;
alter table experiences add column if not exists crew_member_names text[] not null default '{}';

-- The chosen thumbnail, by the key the media step uses. Becomes a foreign key
-- to experience_media once uploads are wired.
alter table experiences add column if not exists cover_media_key text;

alter table experience_policies add column if not exists accessibility text[] not null default '{}';
alter table experience_policies add column if not exists additional_info text[] not null default '{}';
alter table experience_policies add column if not exists departure_note text;
-- Consent is a record, not a preference: store when it was given, so a dispute
-- can be answered with a timestamp rather than a boolean.
alter table experience_policies add column if not exists cancellation_policy_accepted_at timestamptz;
alter table experience_policies add column if not exists support_standards_accepted_at timestamptz;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

/**
 * The agency a save belongs to. An operator belongs to exactly one in
 * practice; if that ever changes this becomes an explicit argument.
 */
create or replace function current_agency_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select agency_id
  from agency_members
  where user_id = auth.uid() and status = 'active'
  order by created_at
  limit 1;
$$;

/** URL-safe slug from a title, unique within the agency. */
create or replace function experience_slug(p_agency uuid, p_title text, p_self uuid)
returns citext
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  base text;
  candidate text;
  n integer := 1;
begin
  base := trim(both '-' from regexp_replace(lower(coalesce(nullif(trim(p_title), ''), 'experience')), '[^a-z0-9]+', '-', 'g'));
  if base = '' then base := 'experience'; end if;
  base := left(base, 60);
  candidate := base;

  while exists (
    select 1 from experiences
    where agency_id = p_agency
      and slug = candidate::citext
      and (p_self is null or id <> p_self)
  ) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;

  return candidate::citext;
end;
$$;

-- -----------------------------------------------------------------------------
-- save_experience_draft
-- -----------------------------------------------------------------------------
/**
 * Upserts a whole wizard draft. Pass null on the first save and keep the
 * returned id for subsequent ones.
 *
 * Child rows are replaced rather than diffed. The wizard always submits the
 * complete section, so a diff would be more code for the same result, and
 * replacement cannot leave an orphan behind when a day or a tier is removed.
 */
create or replace function save_experience_draft(
  p_experience_id uuid,
  p_draft jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_agency     uuid;
  v_id         uuid;
  v_basic      jsonb := coalesce(p_draft -> 'basicInfo', '{}'::jsonb);
  v_crew       jsonb := coalesce(p_draft -> 'crew', '{}'::jsonb);
  v_pricing    jsonb := coalesce(p_draft -> 'pricing', '{}'::jsonb);
  v_avail      jsonb := coalesce(p_draft -> 'availability', '{}'::jsonb);
  v_policies   jsonb := coalesce(p_draft -> 'policies', '{}'::jsonb);
  v_media      jsonb := coalesce(p_draft -> 'media', '{}'::jsonb);
  v_days       jsonb := coalesce(p_draft #> '{itinerary,days}', '[]'::jsonb);
  v_title      text  := nullif(trim(coalesce(v_basic ->> 'title', '')), '');
  v_seats      integer := greatest(coalesce((v_crew ->> 'maxGroupSize')::int, 1), 1);
  v_day        jsonb;
  v_activity   jsonb;
  v_day_id     uuid;
  v_range      jsonb;
  v_tier       record;
begin
  v_agency := current_agency_id();
  if v_agency is null then
    raise exception 'No active agency membership for the current user'
      using errcode = 'insufficient_privilege';
  end if;

  if p_experience_id is null then
    insert into experiences (
      agency_id, slug, title, status, created_by, draft_payload
    )
    values (
      v_agency,
      experience_slug(v_agency, v_title, null),
      coalesce(v_title, 'Untitled experience'),
      'draft',
      auth.uid(),
      p_draft
    )
    returning id into v_id;
  else
    v_id := p_experience_id;
  end if;

  update experiences set
    title            = coalesce(v_title, title),
    -- The slug is part of a live URL, so it is only derived while the
    -- experience is still a draft. Renaming a published trip must not break
    -- links a traveller already has.
    slug             = case
                         when status = 'draft' and v_title is not null
                         then experience_slug(v_agency, v_title, v_id)
                         else slug
                       end,
    kind             = coalesce((v_basic ->> 'kind')::experience_kind, kind),
    duration_days    = coalesce((v_basic ->> 'durationDays')::int, duration_days),
    duration_nights  = coalesce((v_basic ->> 'durationNights')::int, duration_nights),
    min_age          = coalesce((v_basic ->> 'minAge')::int, min_age),
    max_age          = coalesce((v_basic ->> 'maxAge')::int, max_age),
    food_included    = coalesce((v_basic ->> 'foodIncluded')::food_included, food_included),
    food_preference  = coalesce((v_basic ->> 'foodPreference')::food_preference, food_preference),

    trip_captain_name   = coalesce(v_crew ->> 'tripCaptain', trip_captain_name),
    coordinator_name    = coalesce(v_crew ->> 'coordinator', coordinator_name),
    has_ground_crew     = coalesce((v_crew ->> 'hasGroundCrew')::boolean, has_ground_crew),
    crew_member_names   = coalesce(
                            array(select jsonb_array_elements_text(v_crew -> 'crewMembers')),
                            crew_member_names
                          ),
    onboarding_strategy = coalesce((v_crew ->> 'onboardingStrategy')::onboarding_strategy, onboarding_strategy),
    max_group_size      = coalesce((v_crew ->> 'maxGroupSize')::int, max_group_size),

    -- Rupees in the form, paise in the database. Rounded once, here, so no
    -- half-paise ever reaches an invoice.
    base_price_minor       = coalesce(round((v_pricing ->> 'basePrice')::numeric * 100)::int, base_price_minor),
    pricing_mode           = coalesce((v_pricing ->> 'pricingMode')::pricing_mode, pricing_mode),
    max_guests_per_booking = coalesce((v_pricing ->> 'maxGuestsPerBooking')::int, max_guests_per_booking),

    overview         = coalesce(nullif(v_media ->> 'summary', ''), overview),
    cover_media_key  = coalesce(nullif(v_media ->> 'thumbnailId', ''), cover_media_key),

    draft_payload    = p_draft,
    updated_at       = now()
  where id = v_id;

  if not found then
    raise exception 'Experience % not found, or not yours to edit', v_id
      using errcode = 'insufficient_privilege';
  end if;

  ---------------------------------------------------------------------------
  -- Taxonomy. The wizard stores slugs; unknown ones are skipped rather than
  -- failing the save, so a stale draft cannot block an operator entirely.
  ---------------------------------------------------------------------------
  delete from experience_regions where experience_id = v_id;
  insert into experience_regions (experience_id, region_id)
  select v_id, r.id
  from regions r
  where r.slug::text in (select jsonb_array_elements_text(v_basic -> 'regions'));

  delete from experience_terms where experience_id = v_id;
  insert into experience_terms (experience_id, term_id)
  select v_id, t.id
  from taxonomy_terms t
  where t.slug::text in (
    select jsonb_array_elements_text(v_basic -> 'categories')
    union all
    select jsonb_array_elements_text(v_basic -> 'languages')
    union all
    select jsonb_array_elements_text(v_basic -> 'activityTags')
  );

  ---------------------------------------------------------------------------
  -- Itinerary
  ---------------------------------------------------------------------------
  delete from experience_days where experience_id = v_id;

  for v_day in select * from jsonb_array_elements(v_days) loop
    insert into experience_days (
      experience_id, day_number, pickup_included, pickup_location, pickup_time
    )
    values (
      v_id,
      (v_day ->> 'dayNumber')::int,
      coalesce((v_day ->> 'pickupIncluded')::boolean, false),
      nullif(v_day ->> 'pickupLocation', ''),
      -- An empty time input must become null, not a cast error.
      nullif(v_day ->> 'pickupTime', '')::time
    )
    returning id into v_day_id;

    for v_activity in select * from jsonb_array_elements(coalesce(v_day -> 'activities', '[]'::jsonb)) loop
      insert into experience_activities (
        day_id, position, title, kind, stoppage_min, location_name, comment
      )
      values (
        v_day_id,
        coalesce((v_activity ->> 'position')::int, 0),
        coalesce(nullif(v_activity ->> 'title', ''), 'Untitled activity'),
        coalesce((v_activity ->> 'kind')::activity_kind, 'stop_location'),
        nullif(v_activity ->> 'stoppageMin', '')::int,
        nullif(v_activity ->> 'locationName', ''),
        nullif(v_activity ->> 'comment', '')
      );
    end loop;
  end loop;

  ---------------------------------------------------------------------------
  -- Pricing tiers. Keys are guest counts, values are the group total.
  ---------------------------------------------------------------------------
  delete from experience_price_tiers where experience_id = v_id;

  if (v_pricing ->> 'pricingMode') = 'variable' then
    for v_tier in
      select key, value from jsonb_each_text(coalesce(v_pricing -> 'tiers', '{}'::jsonb))
    loop
      if v_tier.value ~ '^[0-9]+(\.[0-9]+)?$' and v_tier.key ~ '^[0-9]+$' then
        insert into experience_price_tiers (experience_id, guest_count, total_minor)
        values (v_id, v_tier.key::int, round(v_tier.value::numeric * 100)::int);
      end if;
    end loop;
  end if;

  ---------------------------------------------------------------------------
  -- Availability. Seats come from the crew step's maximum group size, which is
  -- the only capacity the wizard collects.
  ---------------------------------------------------------------------------
  delete from experience_availability where experience_id = v_id;
  for v_range in select * from jsonb_array_elements(coalesce(v_avail -> 'logs', '[]'::jsonb)) loop
    if nullif(v_range ->> 'from', '') is not null and nullif(v_range ->> 'to', '') is not null then
      insert into experience_availability (experience_id, start_date, end_date, total_slots)
      values (v_id, (v_range ->> 'from')::date, (v_range ->> 'to')::date, v_seats);
    end if;
  end loop;

  delete from experience_blackouts where experience_id = v_id;
  for v_range in select * from jsonb_array_elements(coalesce(v_avail -> 'holidays', '[]'::jsonb)) loop
    if nullif(v_range ->> 'from', '') is not null and nullif(v_range ->> 'to', '') is not null then
      insert into experience_blackouts (experience_id, start_date, end_date)
      values (v_id, (v_range ->> 'from')::date, (v_range ->> 'to')::date);
    end if;
  end loop;

  ---------------------------------------------------------------------------
  -- Policies
  ---------------------------------------------------------------------------
  insert into experience_policies (
    experience_id, inclusions, exclusions, accessibility, additional_info,
    departure_note, cancellation_policy_accepted_at, support_standards_accepted_at
  )
  values (
    v_id,
    array(select jsonb_array_elements_text(coalesce(v_policies -> 'inclusions', '[]'::jsonb))),
    array(select jsonb_array_elements_text(coalesce(v_policies -> 'exclusions', '[]'::jsonb))),
    array(select jsonb_array_elements_text(coalesce(v_policies -> 'accessibility', '[]'::jsonb))),
    array(select jsonb_array_elements_text(coalesce(v_policies -> 'additionalInfo', '[]'::jsonb))),
    nullif(v_policies ->> 'departureNote', ''),
    case when (v_policies ->> 'acceptCancellationPolicy')::boolean then now() end,
    case when (v_policies ->> 'acceptSupportStandards')::boolean then now() end
  )
  on conflict (experience_id) do update set
    inclusions      = excluded.inclusions,
    exclusions      = excluded.exclusions,
    accessibility   = excluded.accessibility,
    additional_info = excluded.additional_info,
    departure_note  = excluded.departure_note,
    -- Keep the original timestamp: consent was given once, and re-saving the
    -- draft is not a fresh agreement.
    cancellation_policy_accepted_at =
      coalesce(experience_policies.cancellation_policy_accepted_at, excluded.cancellation_policy_accepted_at),
    support_standards_accepted_at =
      coalesce(experience_policies.support_standards_accepted_at, excluded.support_standards_accepted_at);

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- submit_experience_for_approval
-- -----------------------------------------------------------------------------
/**
 * Saves the draft, then moves it into review and records the event that the
 * drawer's Approval History renders.
 *
 * Marketplace listing is what review gates — an operator may publish to their
 * own site without waiting on us — so `list_on_marketplace` is what this
 * requests, and status tracks where the request has got to.
 */
create or replace function submit_experience_for_approval(
  p_experience_id uuid,
  p_draft jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id       uuid;
  v_revision integer;
  v_resubmit boolean;
begin
  v_id := save_experience_draft(p_experience_id, p_draft);

  select status <> 'draft' into v_resubmit from experiences where id = v_id;

  update experiences set
    status              = 'under_review',
    list_on_marketplace = true,
    submitted_at        = now(),
    -- A re-submission is a new revision, which is what makes the history read
    -- "Approval Requested — 2nd" rather than repeating itself.
    revision            = case when v_resubmit then revision + 1 else revision end,
    review_note         = null,
    rejected_at         = null
  where id = v_id
  returning revision into v_revision;

  if v_revision is null then
    raise exception 'Experience % not found, or not yours to submit', v_id
      using errcode = 'insufficient_privilege';
  end if;

  insert into experience_reviews (experience_id, revision, event, actor_id)
  values (v_id, v_revision, 'submitted', auth.uid());

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- load_experience_draft — reopening a saved draft in the wizard
-- -----------------------------------------------------------------------------
create or replace function load_experience_draft(p_experience_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select draft_payload from experiences where id = p_experience_id;
$$;

-- Callable by signed-in users only; RLS inside each function does the rest.
revoke all on function save_experience_draft(uuid, jsonb) from public, anon;
revoke all on function submit_experience_for_approval(uuid, jsonb) from public, anon;
revoke all on function load_experience_draft(uuid) from public, anon;
grant execute on function save_experience_draft(uuid, jsonb) to authenticated;
grant execute on function submit_experience_for_approval(uuid, jsonb) to authenticated;
grant execute on function load_experience_draft(uuid) to authenticated;

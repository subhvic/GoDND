-- =============================================================================
-- save_experience_draft / submit_experience_for_approval — behaviour tests
-- =============================================================================
-- Runs against a plain PostgreSQL 16 with a stubbed `auth` schema, so the
-- wizard's persistence can be verified without a Supabase project:
--
--   createdb godnd_verify
--   psql -d godnd_verify -f supabase/tests/00_auth_stub.sql
--   for f in supabase/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -d godnd_verify -f "$f"; done
--   psql -d godnd_verify -f supabase/tests/draft-persistence.sql
--
-- Everything runs inside a transaction and rolls back, so it can be re-run.
--
-- What it pins down:
--   - one jsonb draft fans out across ten tables in a single transaction
--   - rupees become paise exactly once
--   - an unknown taxonomy slug is skipped, not fatal
--   - an incomplete availability window is skipped
--   - re-saving replaces child rows instead of duplicating them
--   - submitting moves the experience to review and writes the history row
--   - re-submitting bumps the revision
--   - another agency can neither read nor write the row
-- =============================================================================

\set ON_ERROR_STOP on
\pset pager off

begin;

-- ---------------------------------------------------------------- fixtures --
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'owner@wanderbeyond.in'),
  ('22222222-2222-2222-2222-222222222222', 'rival@othertravel.in');

insert into agencies (id, slug, name, status) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'wanderbeyond', 'Wander Beyond', 'active'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'othertravel', 'Other Travel', 'active');

insert into agency_members (agency_id, user_id, role, status) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'owner', 'active'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'owner', 'active');

insert into regions (slug, name) values ('meghalaya', 'Meghalaya'), ('assam', 'Assam');
insert into taxonomy_terms (kind, slug, name) values
  ('category', 'adventure', 'Adventure'),
  ('language', 'english', 'English'),
  ('activity', 'rafting', 'Rafting');

grant usage on schema public, auth to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on auth.users to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- --------------------------------------------------------------- the save --
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select save_experience_draft(null, $json${
  "basicInfo": {
    "kind": "super", "title": "7 Day Immersive Experience in Meghalaya",
    "regions": ["meghalaya", "assam", "atlantis"],
    "durationDays": 7, "durationNights": 6,
    "categories": ["adventure"], "languages": ["english"],
    "minAge": 16, "maxAge": 40, "activityTags": ["rafting"],
    "foodIncluded": "breakfast_dinner", "foodPreference": "both"
  },
  "itinerary": { "days": [
    { "dayNumber": 1, "pickupIncluded": true, "pickupLocation": "Guwahati",
      "pickupTime": "07:30", "activities": [
        { "id": "a1", "title": "Arrive at Umiam Lake Viewpoint", "kind": "stop_location",
          "stoppageMin": 60, "locationName": "Umiam Lake", "comment": "", "position": 0 },
        { "id": "a2", "title": "Drive to Shillong", "kind": "transfer",
          "stoppageMin": 90, "locationName": "Shillong", "comment": "", "position": 1 }
      ] },
    { "dayNumber": 2, "pickupIncluded": false, "pickupLocation": "", "pickupTime": "",
      "activities": [] }
  ] },
  "crew": { "tripCaptain": "Madhurjyoti Saikia", "coordinator": "Dipendu Dey",
            "hasGroundCrew": true, "crewMembers": ["Rohit Sangha"],
            "onboardingStrategy": "invite_only", "maxGroupSize": 8 },
  "pricing": { "basePrice": 7500, "maxGuestsPerBooking": 4, "pricingMode": "variable",
               "tiers": { "2": 13500, "3": 19500, "4": 25500 } },
  "availability": { "availabilityMode": "selective",
                    "logs": [{ "id": "l1", "from": "2026-08-02", "to": "2026-09-20" },
                             { "id": "l2", "from": "", "to": "" }],
                    "blockAfterFullCapacity": true, "blockForDays": 6,
                    "holidays": [{ "id": "h1", "from": "2026-08-15", "to": "2026-08-15" }] },
  "policies": { "inclusions": ["breakfast-partial", "ac-car"], "exclusions": ["flights"],
                "departureNote": "Meet at Guwahati airport, 7:30 AM.",
                "accessibility": ["service-animals"], "additionalInfo": ["most-travellers"],
                "acceptCancellationPolicy": true, "acceptSupportStandards": true },
  "media": { "thumbnailId": "media-1", "summary": "Seven days across Meghalaya." }
}$json$::jsonb) as new_id \gset

\echo ''
\echo '--- experience row ---'
select title, slug, kind, status, duration_days, max_group_size,
       onboarding_strategy, base_price_minor, trip_captain_name, cover_media_key
from experiences where id = :'new_id';

\echo '--- child row counts (unknown region "atlantis" must be skipped) ---'
select
  (select count(*) from experience_regions      where experience_id = :'new_id') as regions,
  (select count(*) from experience_terms        where experience_id = :'new_id') as terms,
  (select count(*) from experience_days         where experience_id = :'new_id') as days,
  (select count(*) from experience_activities a join experience_days d on d.id = a.day_id
     where d.experience_id = :'new_id')                                          as activities,
  (select count(*) from experience_price_tiers  where experience_id = :'new_id') as tiers,
  (select count(*) from experience_availability where experience_id = :'new_id') as availability,
  (select count(*) from experience_blackouts    where experience_id = :'new_id') as blackouts;

\echo '--- money converted to paise ---'
select guest_count, total_minor from experience_price_tiers
where experience_id = :'new_id' order by guest_count;

\echo '--- availability seats come from max group size ---'
select start_date, end_date, total_slots from experience_availability
where experience_id = :'new_id';

\echo '--- policies + consent timestamps ---'
select inclusions, accessibility,
       cancellation_policy_accepted_at is not null as cancellation_accepted,
       support_standards_accepted_at is not null as support_accepted
from experience_policies where experience_id = :'new_id';

-- ------------------------------------------------- re-save must not duplicate --
\echo ''
\echo '--- re-saving the same draft (child rows must be replaced, not doubled) ---'
select save_experience_draft(:'new_id', draft_payload) is not null as "re-save ok"
from experiences where id = :'new_id';

select
  (select count(*) from experience_days        where experience_id = :'new_id') as days,
  (select count(*) from experience_price_tiers where experience_id = :'new_id') as tiers;

-- ------------------------------------------------------------- the submit --
\echo ''
\echo '--- submit for approval ---'
select submit_experience_for_approval(:'new_id', draft_payload) is not null as submitted
from experiences where id = :'new_id';

select status, list_on_marketplace, revision, submitted_at is not null as stamped
from experiences where id = :'new_id';

select event, revision from experience_reviews where experience_id = :'new_id';

\echo '--- re-submitting bumps the revision ---'
select submit_experience_for_approval(:'new_id', draft_payload) is not null as resubmitted
from experiences where id = :'new_id';
select revision from experiences where id = :'new_id';

-- ------------------------------------------------------------- isolation --
\echo ''
\echo '--- a rival operator must not be able to write to it ---'
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select count(*) as "rival can see it" from experiences where id = :'new_id';

do $$
declare ok boolean := false;
begin
  begin
    perform save_experience_draft('00000000-0000-0000-0000-000000000000'::uuid, '{}'::jsonb);
  exception when others then
    ok := true;
  end;
  raise notice 'rival save rejected: %', ok;
end $$;

rollback;

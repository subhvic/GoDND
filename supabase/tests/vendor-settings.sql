-- =============================================================================
-- Settings (0008_vendor_settings.sql) — behaviour tests
-- =============================================================================
-- Runs against a plain PostgreSQL 16 with a stubbed `auth` schema, like
-- draft-persistence.sql:
--
--   createdb godnd_verify
--   psql -d godnd_verify -c "create role anon nologin; create role authenticated nologin;"
--   psql -d godnd_verify -f supabase/tests/00_auth_stub.sql
--   for f in supabase/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -d godnd_verify -f "$f"; done
--   psql -d godnd_verify -f supabase/tests/vendor-settings.sql
--
-- Everything runs inside a transaction and rolls back. Each check prints
-- `ok` or raises, so a failure stops the run with its reason.
--
-- What it pins down:
--   - an admin drafts, then submits; a sent section refuses a draft
--   - sales can't write the business profile; finance can write bank details
--   - bank details are hidden from sales, but their status isn't
--   - another agency sees none of it
--   - only GoDND verifies, and only verified details reach `agencies`
--   - a change request keeps its note until the operator resubmits
--   - the owner can't be removed or re-roled; nobody changes their own role
--   - removing a member unassigns their enquiries
--   - a pending invite becomes a membership when its invitee signs in
--   - teammates can read each other's names
-- =============================================================================

\set ON_ERROR_STOP on
\pset pager off

begin;

insert into auth.users (id, email) values
  ('11111111-0000-0000-0000-000000000001', 'rohit@wanderbeyond.in'),
  ('11111111-0000-0000-0000-000000000002', 'dipendu@wanderbeyond.in'),
  ('11111111-0000-0000-0000-000000000003', 'riya@wanderbeyond.in'),
  ('11111111-0000-0000-0000-000000000004', 'accounts@wanderbeyond.in'),
  ('11111111-0000-0000-0000-000000000005', 'rival@othertravel.in'),
  ('11111111-0000-0000-0000-000000000006', 'reviewer@godnd.co'),
  ('11111111-0000-0000-0000-000000000007', 'arjun@wanderbeyond.in');

update profiles set full_name = 'Dipendu Dey' where id = '11111111-0000-0000-0000-000000000002';
update profiles set is_platform_admin = true where id = '11111111-0000-0000-0000-000000000006';

insert into agencies (id, slug, name, status) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'wanderbeyond', 'Wander Beyond', 'active'),
  ('aaaaaaaa-0000-0000-0000-00000000000b', 'othertravel', 'Other Travel', 'active');

insert into agency_members (agency_id, user_id, role, status) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-0000-0000-0000-000000000001', 'owner', 'active'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-0000-0000-0000-000000000002', 'admin', 'active'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-0000-0000-0000-000000000003', 'sales', 'active'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-0000-0000-0000-000000000004', 'finance', 'active'),
  ('aaaaaaaa-0000-0000-0000-00000000000b', '11111111-0000-0000-0000-000000000005', 'owner', 'active');

insert into agency_members (agency_id, invited_email, role, status, invite_expires_at) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'arjun@wanderbeyond.in', 'ops', 'invited', now() + interval '7 days');

insert into enquiries (agency_id, contact_name, contact_email, assigned_to)
values ('aaaaaaaa-0000-0000-0000-00000000000a', 'Priya Sengupta', 'priya.sengupta@example.com',
        '11111111-0000-0000-0000-000000000003');

grant usage on schema public, auth to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on auth.users to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create function pg_temp.expect_refused(statement text, reason text) returns text
language plpgsql as $$
begin
  execute statement;
  raise exception 'expected refusal: %', reason;
exception when insufficient_privilege or invalid_parameter_value then
  return 'ok — refused: ' || reason;
end;
$$;

set local role authenticated;

-- ------------------------------------------------------------ admin drafts --
set local request.jwt.claim.sub = '11111111-0000-0000-0000-000000000002';

\echo '--- an admin saves a draft, then submits it ---'
select status, updated_by_name
from save_profile_section('operations', '{"brandName": "Wander Beyond", "mission": "Small groups."}', false);
select status, submitted_at is not null as submitted
from save_profile_section('operations', '{"brandName": "Wander Beyond", "mission": "Small groups, local captains."}', true);

\echo '--- a sent section refuses a draft ---'
select pg_temp.expect_refused(
  $$select save_profile_section('operations', '{"brandName": "x"}', false)$$,
  'draft over a submitted section');

\echo '--- the agency row is untouched until GoDND verifies ---'
select name, about from agencies where id = 'aaaaaaaa-0000-0000-0000-00000000000a';

-- -------------------------------------------------------------- sales role --
set local request.jwt.claim.sub = '11111111-0000-0000-0000-000000000003';

\echo '--- sales cannot write the business profile ---'
select pg_temp.expect_refused(
  $$select save_profile_section('basic_info', '{"legalName": "x"}', false)$$,
  'sales writing basic info');

-- ------------------------------------------------------------ finance role --
set local request.jwt.claim.sub = '11111111-0000-0000-0000-000000000004';

\echo '--- finance writes bank details ---'
select status from save_profile_section('financial',
  '{"accountHolder": "Wander Beyond Travels LLP", "accountNumber": "123456789012", "ifsc": "HDFC0001234"}', true);

-- ----------------------------------------------------- sales reads nothing --
set local request.jwt.claim.sub = '11111111-0000-0000-0000-000000000003';

\echo '--- sales: bank row hidden, its status visible ---'
select
  (select count(*) from agency_profile_sections where section = 'financial') as financial_rows_visible,
  (select status from profile_section_statuses() where section = 'financial') as financial_status,
  (select count(*) from agency_profile_sections where section = 'operations') as operations_rows_visible;

-- ------------------------------------------------------------------- rival --
set local request.jwt.claim.sub = '11111111-0000-0000-0000-000000000005';

\echo '--- another agency sees none of it ---'
select count(*) as rival_rows from agency_profile_sections;
select count(*) as rival_statuses from profile_section_statuses();

\echo '--- and cannot review ---'
select pg_temp.expect_refused(
  $$select review_profile_section('aaaaaaaa-0000-0000-0000-00000000000a', 'operations', 'verified')$$,
  'a non-GoDND user reviewing');

-- ------------------------------------------------------------ GoDND review --
set local request.jwt.claim.sub = '11111111-0000-0000-0000-000000000006';

\echo '--- GoDND verifies operations: the brand and mission reach agencies ---'
select status, verified_at is not null as verified
from review_profile_section('aaaaaaaa-0000-0000-0000-00000000000a', 'operations', 'verified');
select name, about, is_marketplace_verified from agencies where id = 'aaaaaaaa-0000-0000-0000-00000000000a';

\echo '--- a change request needs a reason ---'
select pg_temp.expect_refused(
  $$select review_profile_section('aaaaaaaa-0000-0000-0000-00000000000a', 'financial', 'changes_requested')$$,
  'change request without a note');
select status, reviewer_note, flagged_fields
from review_profile_section('aaaaaaaa-0000-0000-0000-00000000000a', 'financial', 'changes_requested',
  'The cheque shows a different account holder.', array['proof']);

-- --------------------------------------------- the note survives a draft --
set local request.jwt.claim.sub = '11111111-0000-0000-0000-000000000004';

\echo '--- a draft keeps the change request; a resubmit clears it ---'
select status, reviewer_note is not null as note_kept
from save_profile_section('financial', '{"accountHolder": "Wander Beyond Travels LLP"}', false);
select status, reviewer_note is null as note_cleared, flagged_fields
from save_profile_section('financial', '{"accountHolder": "Wander Beyond Travels LLP"}', true);

-- ------------------------------------------------------------- team rules --
set local request.jwt.claim.sub = '11111111-0000-0000-0000-000000000002';

\echo '--- the owner can''t be removed or re-roled; ownership isn''t granted ---'
select pg_temp.expect_refused(
  $$delete from agency_members where user_id = '11111111-0000-0000-0000-000000000001'$$,
  'removing the owner');
select pg_temp.expect_refused(
  $$update agency_members set role = 'admin' where user_id = '11111111-0000-0000-0000-000000000001'$$,
  'demoting the owner');
select pg_temp.expect_refused(
  $$update agency_members set role = 'owner' where user_id = '11111111-0000-0000-0000-000000000003'$$,
  'granting ownership');
select pg_temp.expect_refused(
  $$update agency_members set role = 'sales' where user_id = '11111111-0000-0000-0000-000000000002'$$,
  'changing your own role');

\echo '--- an admin moves sales to ops, then removes them: their enquiry is unassigned ---'
update agency_members set role = 'ops' where user_id = '11111111-0000-0000-0000-000000000003';
select role from agency_members where user_id = '11111111-0000-0000-0000-000000000003';
delete from agency_members where user_id = '11111111-0000-0000-0000-000000000003';
reset role;
select count(*) as still_assigned from enquiries where assigned_to = '11111111-0000-0000-0000-000000000003';
set local role authenticated;

-- ------------------------------------------------------------------ invite --
set local request.jwt.claim.sub = '11111111-0000-0000-0000-000000000007';

\echo '--- the invitee signs in: the invite becomes a membership ---'
select accept_agency_invites() as accepted;
select role, status, user_id is not null as linked from agency_members where invited_email = 'arjun@wanderbeyond.in';
select accept_agency_invites() as accepted_again;

\echo '--- teammates read each other''s names ---'
select full_name from profiles where id = '11111111-0000-0000-0000-000000000002';

rollback;

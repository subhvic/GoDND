-- =============================================================================
-- GoDND — Settings: the vendor profile, its verification, and the team
-- =============================================================================
-- The five business sections of Settings (Basic Info, Compliance, Financial
-- Details, Certifications, Operational Details) are each checked by GoDND
-- before an operator can list. One row per section holds what the operator
-- entered and where it stands with GoDND.
--
-- Operators never write the table directly: save_profile_section() is the
-- only door, and it cannot mark anything verified. Only a platform admin,
-- through review_profile_section(), can — and only then are the details
-- copied onto `agencies`, whose row the marketplace reads publicly. An
-- unverified edit never reaches a traveller.
--
-- Bank details are readable by owners, admins and finance alone. Everyone
-- else in the workspace can still see each section's status through
-- profile_section_statuses(), which returns no data.
-- =============================================================================

create type profile_review_status as enum ('draft', 'submitted', 'verified', 'changes_requested');

create table agency_profile_sections (
  agency_id        uuid not null references agencies(id) on delete cascade,
  section          text not null
                   check (section in ('basic_info', 'compliance', 'financial', 'certifications', 'operations')),
  data             jsonb not null default '{}'::jsonb,
  status           profile_review_status not null default 'draft',
  saved_at         timestamptz not null default now(),
  submitted_at     timestamptz,
  verified_at      timestamptz,
  -- GoDND's reason when it asks for changes, and the fields it points at.
  reviewer_note    text,
  flagged_fields   text[] not null default '{}',
  reviewed_by      uuid references profiles(id) on delete set null,
  updated_by       uuid references profiles(id) on delete set null,
  updated_by_name  text,
  primary key (agency_id, section)
);

create index agency_profile_sections_review_queue on agency_profile_sections(submitted_at)
  where status = 'submitted';

alter table profiles add column if not exists designation text;

-- -----------------------------------------------------------------------------
-- RLS — reads only; every write goes through the functions below.
-- -----------------------------------------------------------------------------
alter table agency_profile_sections enable row level security;

create policy profile_sections_read on agency_profile_sections for select
  using (
    is_platform_admin()
    or (section <> 'financial' and is_agency_member(agency_id))
    or (section = 'financial' and has_agency_role(agency_id, array['owner', 'admin', 'finance']::agency_role[]))
  );

-- Teammates see each other's name and contact details — who a colleague is
-- and how to reach them on a trip day. Nothing else of a profile is shared.
create policy profiles_teammate_read on profiles for select
  using (
    exists (
      select 1 from agency_members m
      where m.user_id = profiles.id
        and m.agency_id in (select auth_agency_ids())
    )
  );

-- -----------------------------------------------------------------------------
-- Every section's status, for everyone in the workspace. The reviewer's note
-- on bank details stays with the people who can see them: it may quote them.
-- -----------------------------------------------------------------------------
create or replace function profile_section_statuses()
returns table (
  section       text,
  status        profile_review_status,
  saved_at      timestamptz,
  submitted_at  timestamptz,
  verified_at   timestamptz,
  reviewer_note text
)
language sql
stable
security definer
set search_path = public
as $$
  select s.section, s.status, s.saved_at, s.submitted_at, s.verified_at,
         case
           when s.section = 'financial'
            and not has_agency_role(s.agency_id, array['owner', 'admin', 'finance']::agency_role[])
           then null
           else s.reviewer_note
         end
  from agency_profile_sections s
  where s.agency_id = current_agency_id();
$$;

-- -----------------------------------------------------------------------------
-- save_profile_section — the operator's only way to write a section.
--
--   draft  → stores what's typed. Refused on a sent section: its edits are
--            submitted or abandoned, never parked beside the checked version.
--   submit → stores it and queues it for GoDND; any earlier verification and
--            change request are cleared, because this is a new version.
--
-- The app validates completeness before submitting; here the rules are the
-- ones no client may bend — who may write which section, and that status only
-- ever moves to draft or submitted.
-- -----------------------------------------------------------------------------
create or replace function save_profile_section(p_section text, p_data jsonb, p_submit boolean)
returns agency_profile_sections
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agency  uuid := current_agency_id();
  v_allowed agency_role[];
  v_current agency_profile_sections;
  v_name    text;
  v_row     agency_profile_sections;
begin
  if v_agency is null then
    raise exception 'No active agency membership for the current user'
      using errcode = 'insufficient_privilege';
  end if;
  if p_section not in ('basic_info', 'compliance', 'financial', 'certifications', 'operations') then
    raise exception 'Unknown section %', p_section using errcode = '22023';
  end if;

  v_allowed := case
    when p_section = 'financial' then array['owner', 'admin', 'finance']::agency_role[]
    else array['owner', 'admin']::agency_role[]
  end;
  if not has_agency_role(v_agency, v_allowed) then
    raise exception 'Your role can''t change %', p_section using errcode = 'insufficient_privilege';
  end if;

  if jsonb_typeof(p_data) is distinct from 'object' or pg_column_size(p_data) > 65536 then
    raise exception 'Section data must be a JSON object under 64 KB' using errcode = '22023';
  end if;

  select * into v_current
  from agency_profile_sections
  where agency_id = v_agency and section = p_section
  for update;

  if not p_submit and v_current.status in ('submitted', 'verified') then
    raise exception 'A sent section is submitted again or left as it is, never saved as a draft'
      using errcode = '22023';
  end if;

  select full_name into v_name from profiles where id = auth.uid();

  insert into agency_profile_sections as s (
    agency_id, section, data, status, saved_at, submitted_at,
    verified_at, reviewer_note, flagged_fields, updated_by, updated_by_name
  )
  values (
    v_agency, p_section, p_data,
    case when p_submit then 'submitted' else 'draft' end::profile_review_status,
    now(), case when p_submit then now() end,
    null, null, '{}', auth.uid(), v_name
  )
  on conflict (agency_id, section) do update set
    data            = excluded.data,
    status          = case
                        when p_submit then 'submitted'::profile_review_status
                        when s.status = 'changes_requested' then 'changes_requested'::profile_review_status
                        else 'draft'::profile_review_status
                      end,
    saved_at        = now(),
    submitted_at    = case when p_submit then now() else s.submitted_at end,
    verified_at     = case when p_submit then null else s.verified_at end,
    reviewer_note   = case when p_submit then null else s.reviewer_note end,
    flagged_fields  = case when p_submit then '{}' else s.flagged_fields end,
    updated_by      = excluded.updated_by,
    updated_by_name = excluded.updated_by_name
  returning * into v_row;

  return v_row;
end;
$$;

-- -----------------------------------------------------------------------------
-- review_profile_section — GoDND's decision on a submitted section.
--
-- Verifying copies the section's public facts onto `agencies`; when all five
-- are verified the agency is marked marketplace-verified. Asking for changes
-- records the reason and the fields it concerns.
-- -----------------------------------------------------------------------------
create or replace function review_profile_section(
  p_agency   uuid,
  p_section  text,
  p_decision profile_review_status,
  p_note     text default null,
  p_flagged  text[] default '{}'
)
returns agency_profile_sections
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row  agency_profile_sections;
  v_data jsonb;
begin
  if not is_platform_admin() then
    raise exception 'Only GoDND reviews vendor profiles' using errcode = 'insufficient_privilege';
  end if;
  if p_decision not in ('verified', 'changes_requested') then
    raise exception 'A review verifies a section or asks for changes' using errcode = '22023';
  end if;
  if p_decision = 'changes_requested' and coalesce(btrim(p_note), '') = '' then
    raise exception 'Say what needs changing' using errcode = '22023';
  end if;

  update agency_profile_sections set
    status         = p_decision,
    verified_at    = case when p_decision = 'verified' then now() end,
    reviewer_note  = case when p_decision = 'changes_requested' then p_note end,
    flagged_fields = case when p_decision = 'changes_requested' then coalesce(p_flagged, '{}') else '{}' end,
    reviewed_by    = auth.uid()
  where agency_id = p_agency and section = p_section and status = 'submitted'
  returning * into v_row;

  if not found then
    raise exception 'Only a submitted section can be reviewed' using errcode = '22023';
  end if;

  if p_decision = 'verified' then
    v_data := v_row.data;
    case p_section
      when 'basic_info' then
        update agencies set
          legal_name    = nullif(v_data ->> 'legalName', ''),
          support_email = nullif(v_data ->> 'email', '')::citext,
          support_phone = nullif(v_data ->> 'phone', ''),
          website_url   = nullif(v_data ->> 'website', ''),
          logo_url      = v_data -> 'logo' ->> 'path',
          address       = jsonb_build_object(
                            'line1', v_data ->> 'addressLine1',
                            'line2', v_data ->> 'addressLine2',
                            'city', v_data ->> 'city',
                            'state', v_data ->> 'state',
                            'pincode', v_data ->> 'pincode')
        where id = p_agency;
      when 'compliance' then
        update agencies set
          pan   = nullif(v_data ->> 'pan', ''),
          gstin = nullif(v_data ->> 'gstin', '')
        where id = p_agency;
      when 'certifications' then
        update agencies set tourism_reg_no = (
          select certificate ->> 'number'
          from jsonb_array_elements(coalesce(v_data -> 'certificates', '[]'::jsonb)) certificate
          where certificate ->> 'type' = 'state_tourism'
          limit 1
        )
        where id = p_agency;
      when 'operations' then
        update agencies set
          name  = coalesce(nullif(v_data ->> 'brandName', ''), name),
          about = nullif(v_data ->> 'mission', '')
        where id = p_agency;
      else
        null; -- bank details stay in their own row, never on the public one
    end case;
  end if;

  update agencies set is_marketplace_verified = (
    select count(*) = 5 from agency_profile_sections
    where agency_id = p_agency and status = 'verified'
  )
  where id = p_agency;

  return v_row;
end;
$$;

-- -----------------------------------------------------------------------------
-- Team rules that hold whatever the client sends. RLS already limits team
-- changes to owners and admins; this stops an admin from removing the owner,
-- granting ownership, or changing their own role — and unassigns a removed
-- member's enquiries so none waits on someone who can no longer reply.
--
-- Writes without a signed-in user (the service key: onboarding, webhooks)
-- and GoDND's own staff pass through.
-- -----------------------------------------------------------------------------
create or replace function guard_agency_members()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or is_platform_admin() then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    if old.role = 'owner' then
      raise exception 'The owner can''t be removed' using errcode = 'insufficient_privilege';
    end if;
    if old.user_id = auth.uid() then
      raise exception 'You can''t remove yourself' using errcode = 'insufficient_privilege';
    end if;
    if old.user_id is not null then
      update enquiries set assigned_to = null
      where agency_id = old.agency_id and assigned_to = old.user_id;
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and new.role is distinct from old.role then
    if old.role = 'owner' or new.role = 'owner' then
      raise exception 'Ownership is transferred, not granted' using errcode = 'insufficient_privilege';
    end if;
    if old.user_id = auth.uid() then
      raise exception 'You can''t change your own role' using errcode = 'insufficient_privilege';
    end if;
  end if;

  if tg_op = 'INSERT' and new.role = 'owner' then
    raise exception 'Ownership is transferred, not granted' using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger agency_members_guard
  before insert or update or delete on agency_members
  for each row execute function guard_agency_members();

-- -----------------------------------------------------------------------------
-- accept_agency_invites — run after sign-in. Every live invite addressed to
-- the signed-in user's email becomes a membership. Expired invites stay
-- pending (an admin resends them), and a workspace the user already belongs
-- to is skipped rather than duplicated.
-- -----------------------------------------------------------------------------
create or replace function accept_agency_invites()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_count integer;
begin
  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then
    return 0;
  end if;

  update agency_members invite set
    user_id      = auth.uid(),
    status       = 'active',
    accepted_at  = now(),
    invite_token = null
  where invite.user_id is null
    and invite.status = 'invited'
    and lower(invite.invited_email) = lower(v_email)
    and (invite.invite_expires_at is null or invite.invite_expires_at > now())
    and not exists (
      select 1 from agency_members existing
      where existing.agency_id = invite.agency_id and existing.user_id = auth.uid()
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function profile_section_statuses() to authenticated;
grant execute on function save_profile_section(text, jsonb, boolean) to authenticated;
grant execute on function review_profile_section(uuid, text, profile_review_status, text, text[]) to authenticated;
grant execute on function accept_agency_invites() to authenticated;
revoke execute on function profile_section_statuses() from anon;
revoke execute on function save_profile_section(text, jsonb, boolean) from anon;
revoke execute on function review_profile_section(uuid, text, profile_review_status, text, text[]) from anon;
revoke execute on function accept_agency_invites() from anon;

-- -----------------------------------------------------------------------------
-- Documents: a private bucket, one folder per agency, one subfolder per
-- section — {agency}/{section}/{file}. Members read their agency's files
-- except bank proofs, which follow the bank details' audience; writing
-- follows who may edit the section. Files are never public and never
-- overwritten: a replacement is a new object.
--
-- Guarded so the migration also runs on plain Postgres, where there is no
-- storage schema (the SQL tests).
-- -----------------------------------------------------------------------------
do $storage$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('agency-documents', 'agency-documents', false, 5242880,
            array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do nothing;

    execute $policy$
      create policy agency_documents_read on storage.objects for select to authenticated
      using (
        bucket_id = 'agency-documents'
        and (storage.foldername(name))[1] in (select id::text from agencies where id in (select auth_agency_ids()))
        and (
          (storage.foldername(name))[2] <> 'financial'
          or has_agency_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin', 'finance']::agency_role[])
        )
      )
    $policy$;

    execute $policy$
      create policy agency_documents_write on storage.objects for insert to authenticated
      with check (
        bucket_id = 'agency-documents'
        and (storage.foldername(name))[1] in (select id::text from agencies where id in (select auth_agency_ids()))
        and case (storage.foldername(name))[2]
          when 'profile' then true
          when 'financial' then has_agency_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin', 'finance']::agency_role[])
          when 'basic-info' then has_agency_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin']::agency_role[])
          when 'compliance' then has_agency_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin']::agency_role[])
          when 'certifications' then has_agency_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin']::agency_role[])
          when 'operations' then has_agency_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin']::agency_role[])
          else false
        end
      )
    $policy$;
  end if;
end;
$storage$;

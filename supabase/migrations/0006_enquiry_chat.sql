-- =============================================================================
-- GoDND — Enquiry chat: realtime, read state, and a trigger fix
-- =============================================================================
-- 0003 created the inbox tables and noted that Realtime broadcasts message
-- inserts; nothing added them to the publication, so nothing was broadcast.
-- This migration makes the operator's inbox live and gives the thread a way
-- to clear its unread badge.
-- =============================================================================

-- Realtime. Guarded so the migration still applies to a plain Postgres (the
-- verification setup), where the supabase_realtime publication does not exist.
-- postgres_changes respects RLS, so subscribers only receive rows they could
-- select — a traveller's socket never carries an internal note.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = 'enquiries'
    ) then
      alter publication supabase_realtime add table enquiries;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = 'enquiry_messages'
    ) then
      alter publication supabase_realtime add table enquiry_messages;
    end if;
  end if;
end
$$;

-- An internal note is not a reply. The 0003 trigger moved an enquiry from
-- new to open on any agent message, so a teammate jotting "called, will
-- follow up" made the traveller look answered. Only a message the traveller
-- can see opens the conversation now.
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
      status = case
        when status = 'new' and new.sender_kind = 'agent' and not new.is_internal then 'open'
        else status end
  where id = new.enquiry_id;
  return new;
end;
$$;

-- Opening a thread clears its badge and stamps the traveller's messages as
-- read (which is what drives "Seen" on their side). enquiry_messages has no
-- update policy — messages are append-only for everyone — so this runs as
-- definer and checks membership itself.
create or replace function mark_enquiry_read(p_enquiry uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from enquiries e
    where e.id = p_enquiry and is_agency_member(e.agency_id)
  ) then
    raise exception 'Not a member of this enquiry''s agency' using errcode = '42501';
  end if;

  update enquiries set unread_for_agent = 0
  where id = p_enquiry and unread_for_agent <> 0;

  update enquiry_messages set read_at = now()
  where enquiry_id = p_enquiry
    and sender_kind = 'traveller'
    and read_at is null;
end;
$$;

grant execute on function mark_enquiry_read(uuid) to authenticated;

-- Minimal stand-in for the Supabase-managed auth schema, so migrations and
-- their tests can run against a vanilla PostgreSQL instance.
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);
create or replace function auth.uid() returns uuid
  language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create schema extensions;
create table auth.users(id uuid primary key default gen_random_uuid(), email text, encrypted_password text, raw_user_meta_data jsonb, raw_app_meta_data jsonb, email_confirmed_at timestamptz, created_at timestamptz default now());
create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
create function auth.role() returns text language sql as $$ select 'authenticated' $$;
create function auth.jwt() returns jsonb language sql as $$ select '{}'::jsonb $$;
create extension if not exists "uuid-ossp"; create extension if not exists pgcrypto;

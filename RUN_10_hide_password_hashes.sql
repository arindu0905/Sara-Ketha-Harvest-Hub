-- RUN_10: stop signed-in users from reading password hashes in public.profiles directly.
-- Run once in the Supabase SQL Editor. Safe to run again.
--
-- Why: profiles.encrypted_password holds a copy of each user's password hash (migration 007).
-- Row-level security lets officers and administrators read all profiles, so with their own login token
-- they could ask the database for every user's hash. The app never reads profiles from the browser
-- (the API uses the service role, which this does not affect), so nothing in the app changes.

REVOKE SELECT ON public.profiles FROM anon, authenticated;

GRANT SELECT (id, email, full_name, phone, avatar_url, role, account_status, assigned_centre, created_at, updated_at)
  ON public.profiles TO authenticated;

-- Check: this should list every profile column except encrypted_password.
SELECT column_name
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name = 'profiles' AND grantee = 'authenticated' AND privilege_type = 'SELECT'
ORDER BY column_name;

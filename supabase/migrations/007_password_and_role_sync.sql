-- ============================================================
-- HarvestHub Migration 007: Password Encryption & Role Table Auto-Sync
-- ============================================================

-- 1. Ensure public.profiles has encrypted_password column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS encrypted_password TEXT;

-- 2. Update handle_new_user trigger function to populate profiles AND role-specific tables
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role public.user_role;
  v_full_name TEXT;
  v_phone TEXT;
  v_nic TEXT;
  v_code_suffix TEXT;
BEGIN
  v_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'farmer'::public.user_role);
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);
  v_phone := COALESCE(NEW.raw_user_meta_data->>'phone', '0700000000');
  v_code_suffix := UPPER(SUBSTRING(REPLACE(NEW.id::text, '-', ''), 1, 8));

  -- Insert or update profile including encrypted_password
  INSERT INTO public.profiles (id, email, full_name, role, account_status, encrypted_password)
  VALUES (
    NEW.id,
    NEW.email,
    v_full_name,
    v_role,
    'active',
    NEW.encrypted_password
  )
  ON CONFLICT (id) DO UPDATE SET
    encrypted_password = EXCLUDED.encrypted_password,
    role = EXCLUDED.role,
    full_name = EXCLUDED.full_name;

  -- Role-specific automatic Insertion into farmers table
  IF v_role = 'farmer'::public.user_role THEN
    v_nic := COALESCE(NEW.raw_user_meta_data->>'nic_number', 'NIC-' || v_code_suffix);
    INSERT INTO public.farmers (
      profile_id,
      farmer_code,
      nic_number,
      full_name,
      email,
      phone,
      address,
      district,
      verification_status,
      account_status
    )
    VALUES (
      NEW.id,
      'FAR-' || v_code_suffix,
      v_nic,
      v_full_name,
      NEW.email,
      v_phone,
      'Sri Lanka',
      'Colombo',
      'verified',
      'active'
    )
    ON CONFLICT (profile_id) DO NOTHING;
  END IF;

  -- Role-specific automatic Insertion into buyers table
  IF v_role = 'buyer'::public.user_role THEN
    INSERT INTO public.buyers (
      profile_id,
      buyer_code,
      company_name,
      contact_person,
      email,
      phone,
      address,
      district,
      verification_status,
      account_status
    )
    VALUES (
      NEW.id,
      'BUY-' || v_code_suffix,
      v_full_name,
      v_full_name,
      NEW.email,
      v_phone,
      'Sri Lanka',
      'Colombo',
      'verified',
      'active'
    )
    ON CONFLICT (profile_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Backfill existing farmers and buyers from profiles table if missing
INSERT INTO public.farmers (
  profile_id, farmer_code, nic_number, full_name, email, phone, address, district, verification_status, account_status
)
SELECT
  p.id,
  'FAR-' || UPPER(SUBSTRING(REPLACE(p.id::text, '-', ''), 1, 8)),
  'NIC-' || UPPER(SUBSTRING(REPLACE(p.id::text, '-', ''), 1, 8)),
  p.full_name,
  p.email,
  COALESCE(p.phone, '0700000000'),
  'Sri Lanka',
  'Colombo',
  'verified',
  'active'
FROM public.profiles p
WHERE p.role = 'farmer'
  AND NOT EXISTS (SELECT 1 FROM public.farmers f WHERE f.profile_id = p.id);

INSERT INTO public.buyers (
  profile_id, buyer_code, company_name, contact_person, email, phone, address, district, verification_status, account_status
)
SELECT
  p.id,
  'BUY-' || UPPER(SUBSTRING(REPLACE(p.id::text, '-', ''), 1, 8)),
  p.full_name,
  p.full_name,
  p.email,
  COALESCE(p.phone, '0700000000'),
  'Sri Lanka',
  'Colombo',
  'verified',
  'active'
FROM public.profiles p
WHERE p.role = 'buyer'
  AND NOT EXISTS (SELECT 1 FROM public.buyers b WHERE b.profile_id = p.id);

-- 4. Sync/populate encrypted_password in profiles from auth.users for existing accounts
UPDATE public.profiles p
SET encrypted_password = u.encrypted_password
FROM auth.users u
WHERE p.id = u.id
  AND (p.encrypted_password IS NULL OR p.encrypted_password = '');

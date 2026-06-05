-- ============================================================
-- SCM ADMIN SETUP SCRIPT
-- Run this in Supabase SQL Editor AFTER running supabase_schema.sql
-- ============================================================

-- STEP 1: Disable the trigger temporarily so we can insert manually
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- STEP 2: Create the agency
INSERT INTO public.agencies (agency_name, owner_name, phone, email)
VALUES ('Star DSA', 'Agency Owner', '9999999999', 'owner@stardsa.com')
ON CONFLICT DO NOTHING;

-- STEP 3: Re-create the trigger BUT with a safe fallback (skips insert if agency_id is null/invalid)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_agency_id uuid;
BEGIN
  -- Try to parse agency_id from metadata
  BEGIN
    v_agency_id := (new.raw_user_meta_data->>'agency_id')::uuid;
  EXCEPTION WHEN others THEN
    v_agency_id := NULL;
  END;

  -- Only insert into public.users if a valid agency_id is provided in metadata
  -- (Owner is inserted manually below; employees are created via the app)
  IF v_agency_id IS NOT NULL THEN
    INSERT INTO public.users (user_id, agency_id, role, full_name, phone, email, status, branch)
    VALUES (
      new.id,
      v_agency_id,
      coalesce(new.raw_user_meta_data->>'role', 'worker'),
      coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
      coalesce(new.raw_user_meta_data->>'phone', ''),
      new.email,
      coalesce(new.raw_user_meta_data->>'status', 'active'),
      coalesce(new.raw_user_meta_data->>'branch', 'Head Office')
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================
-- STEP 4: AFTER creating the auth user via dashboard, run this
-- to manually link the owner to the agency.
-- Replace <AUTH_USER_ID> with the UUID shown in Supabase Auth Users tab.
-- ============================================================

-- INSERT INTO public.users (user_id, agency_id, role, full_name, phone, email, status)
-- SELECT
--   '<AUTH_USER_ID>'::uuid,
--   agency_id,
--   'owner',
--   'Agency Owner',
--   '9999999999',
--   'owner@stardsa.com',
--   'active'
-- FROM public.agencies
-- WHERE email = 'owner@stardsa.com'
-- LIMIT 1;

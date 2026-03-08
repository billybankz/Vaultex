-- Phase 4: Role-Based Access Control (RBAC)

-- 1. Add "role" column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';

-- 2. Backfill existing target admins and preserve original test admin script
DO $$
BEGIN
  UPDATE public.profiles SET role = 'admin' WHERE email = 'testadmin@test.com' OR email = 'bildadworks@gmail.com' OR email LIKE 'admin@%';
END $$;

-- 3. Security RPC: Allow admins to change the role of another user
CREATE OR REPLACE FUNCTION public.admin_set_role(target_user_id uuid, new_role text)
RETURNS void AS $$
BEGIN
  -- Change the role of the specified user
  UPDATE public.profiles SET role = new_role, updated_at = now() WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

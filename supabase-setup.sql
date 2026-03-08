-- Vaultex Security Phase 2: Profiles, Lockouts, and Real Admin View

-- 1. Create the Profiles table to safely Expose Emails and track Lockouts
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  failed_attempts integer default 0,
  is_locked boolean default false,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable RLS but allow anyone to read profiles (so the admin can see emails)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
-- Only the user can update their own profile (or the admin via RPC)
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Trigger: Automatically insert into profiles when a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Security RPC: Record a failed login attempt (BY EMAIL)
CREATE OR REPLACE FUNCTION public.record_failed_login(user_email text)
RETURNS void AS $$
DECLARE
  target_id uuid;
  current_attempts integer;
BEGIN
  -- Find the user ID based on email
  SELECT id INTO target_id FROM public.profiles WHERE email = user_email;
  
  IF target_id IS NOT NULL THEN
    -- Increment attempts
    UPDATE public.profiles 
    SET failed_attempts = failed_attempts + 1,
        updated_at = now()
    WHERE id = target_id
    RETURNING failed_attempts INTO current_attempts;
    
    -- If attempts >= 5, lock the account
    IF current_attempts >= 5 THEN
      UPDATE public.profiles SET is_locked = true WHERE id = target_id;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Security RPC: Reset failed logins on successful auth (BY EMAIL)
CREATE OR REPLACE FUNCTION public.reset_failed_login(user_email text)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET failed_attempts = 0,
      updated_at = now()
  WHERE email = user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Security RPC: Check if an email is locked out
CREATE OR REPLACE FUNCTION public.check_is_locked(user_email text)
RETURNS boolean AS $$
DECLARE
  locked boolean;
BEGIN
  SELECT is_locked INTO locked FROM public.profiles WHERE email = user_email;
  RETURN COALESCE(locked, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Admin RPC: Unlock a specific user
CREATE OR REPLACE FUNCTION public.admin_unlock_user(target_user_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles 
  SET is_locked = false, 
      failed_attempts = 0,
      updated_at = now()
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Backfill existing users:
-- If you already have users in auth.users, run this to copy them to profiles:
INSERT INTO public.profiles (id, email)
SELECT id, email FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Vaultex Security Phase 3: Custom OTP Recovery System
-- Run this in your Supabase SQL Editor to bypass native email limits.

-- 1. Enable the pgcrypto extension (required for hashing the new password)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Add OTP columns to the profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS reset_otp text,
ADD COLUMN IF NOT EXISTS reset_otp_expires timestamp with time zone;

-- 3. Security RPC: Generate and store a custom OTP securely
CREATE OR REPLACE FUNCTION public.generate_custom_otp(user_email text)
RETURNS text AS $$
DECLARE
  new_otp text;
BEGIN
  -- Validate user exists
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE email = user_email) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Generate a random 6-digit code
  new_otp := floor(random() * 899999 + 100000)::text;

  -- Store the OTP and set expiration to 15 mins from now
  UPDATE public.profiles
  SET reset_otp = new_otp,
      reset_otp_expires = now() + interval '15 minutes',
      updated_at = now()
  WHERE email = user_email;

  RETURN new_otp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Security RPC: Verify the OTP and force-update the password
CREATE OR REPLACE FUNCTION public.verify_and_update_password(
  user_email text, 
  check_otp text, 
  new_password text
)
RETURNS boolean AS $$
DECLARE
  stored_otp text;
  expires_at timestamp with time zone;
  target_user_id uuid;
BEGIN
  -- Get the stored OTP and User ID
  SELECT id, reset_otp, reset_otp_expires 
  INTO target_user_id, stored_otp, expires_at 
  FROM public.profiles 
  WHERE email = user_email;
  
  -- Check if OTP exists, matches, and is not expired
  IF stored_otp IS NOT NULL AND stored_otp = check_otp AND expires_at > now() THEN
    
    -- IMPORTANT: Force update the native Supabase auth.users password using pgcrypto!
    UPDATE auth.users
    SET encrypted_password = crypt(new_password, gen_salt('bf', 10)),
        updated_at = now()
    WHERE id = target_user_id;

    -- Clear the OTP, unlock the account, and reset failed logins!
    UPDATE public.profiles
    SET reset_otp = null, 
        reset_otp_expires = null,
        is_locked = false,
        failed_attempts = 0,
        updated_at = now()
    WHERE email = user_email;
    
    RETURN true;
  END IF;
  
  -- If we get here, the code was invalid or expired
  RAISE EXCEPTION 'Invalid or expired recovery code.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

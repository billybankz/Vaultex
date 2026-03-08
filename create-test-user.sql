-- Create a Test User manually in Supabase with proper Identity bindings

DO $$
DECLARE
  new_user_id uuid := gen_random_uuid();
BEGIN
  -- 1. Create the user in auth.users
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    new_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 
    'alice@example.com', 
    crypt('Alice@123', gen_salt('bf')), 
    now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()
  );

  -- 2. Bind the email Identity so GoTrue recognizes the login
  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    new_user_id, new_user_id, new_user_id::text, format('{"sub":"%s","email":"alice@example.com"}', new_user_id)::jsonb, 'email', now(), now(), now()
  );

END;
$$;

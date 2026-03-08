-- RPC to entirely delete a user from auth.users

CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id uuid)
RETURNS void AS $$
BEGIN
  -- Deleting from auth.users will natively cascade to public.profiles and public.user_vaults
  -- IF the foreign keys are set to ON DELETE CASCADE.
  -- Otherwise, we manually delete them here first just in case.
  
  DELETE FROM public.user_vaults WHERE user_id = target_user_id;
  DELETE FROM public.profiles WHERE id = target_user_id;
  
  -- The actual deletion requires superuser, or the function running as a superuser/owner via SECURITY DEFINER
  -- Assuming the creator of this function has privileges over auth schema (like postgres role)
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

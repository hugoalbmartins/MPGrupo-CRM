/*
  # Fix has_role function NULL handling
  
  1. Updates
    - Improve has_role function to handle NULL cases properly
    - Ensure function returns FALSE instead of NULL when user is not found
    - Ensure function returns FALSE instead of NULL when role doesn't match
  
  2. Security
    - Maintains SECURITY DEFINER for proper RLS evaluation
    - No changes to existing policies
*/

-- Drop and recreate the function with better NULL handling
CREATE OR REPLACE FUNCTION public.has_role(role_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_role TEXT;
  current_uid UUID;
BEGIN
  -- Get the current user ID
  current_uid := auth.uid();
  
  -- If no user is authenticated, return FALSE
  IF current_uid IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Get the user's role
  SELECT role INTO user_role
  FROM users
  WHERE id = current_uid;
  
  -- If user not found or role is NULL, return FALSE
  IF user_role IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Return TRUE if roles match, FALSE otherwise
  RETURN user_role = role_name;
END;
$$;

-- Also update has_any_role function with same improvements
CREATE OR REPLACE FUNCTION public.has_any_role(role_names text[])
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_role TEXT;
  current_uid UUID;
BEGIN
  -- Get the current user ID
  current_uid := auth.uid();
  
  -- If no user is authenticated, return FALSE
  IF current_uid IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Get the user's role
  SELECT role INTO user_role
  FROM users
  WHERE id = current_uid;
  
  -- If user not found or role is NULL, return FALSE
  IF user_role IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Return TRUE if user's role is in the list, FALSE otherwise
  RETURN user_role = ANY(role_names);
END;
$$;
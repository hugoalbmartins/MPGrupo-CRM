/*
  # Add activation_type to sales and user_code to users

  1. Modified Tables
    - `sales`
      - Added `activation_type` (text, nullable) - stores the activation type for telecom sales
    - `users`
      - Added `user_code` (text, nullable, unique) - auto-generated code based on partner_code + sequential number

  2. New Functions
    - `generate_user_code(partner_uuid)` - generates a sequential user code like D2D1015_1, D2D1015_2, etc.
    - `auto_set_user_code()` - trigger function that auto-generates user_code on user insert/update

  3. Notes
    - The user_code is derived from the associated partner's partner_code
    - Sequential numbering is per-partner (each partner's users get _1, _2, _3, etc.)
    - Users without a partner_id will not have a user_code
    - user_code can be used for login
*/

-- Add activation_type column to sales
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'activation_type'
  ) THEN
    ALTER TABLE sales ADD COLUMN activation_type text;
  END IF;
END $$;

-- Add user_code column to users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'user_code'
  ) THEN
    ALTER TABLE users ADD COLUMN user_code text UNIQUE;
  END IF;
END $$;

-- Function to generate user_code based on partner's partner_code
CREATE OR REPLACE FUNCTION generate_user_code(p_partner_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_partner_code text;
  v_next_num integer;
  v_user_code text;
BEGIN
  IF p_partner_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT partner_code INTO v_partner_code
  FROM partners
  WHERE id = p_partner_id;

  IF v_partner_code IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(MAX(
    CASE
      WHEN user_code ~ ('^' || v_partner_code || '_[0-9]+$')
      THEN CAST(SUBSTRING(user_code FROM LENGTH(v_partner_code) + 2) AS integer)
      ELSE 0
    END
  ), 0) + 1
  INTO v_next_num
  FROM users
  WHERE partner_id = p_partner_id
    AND user_code IS NOT NULL;

  v_user_code := v_partner_code || '_' || v_next_num;

  RETURN v_user_code;
END;
$$;

-- Trigger function to auto-set user_code on insert or update
CREATE OR REPLACE FUNCTION auto_set_user_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.partner_id IS NOT NULL AND (NEW.user_code IS NULL OR TG_OP = 'INSERT' OR OLD.partner_id IS DISTINCT FROM NEW.partner_id) THEN
    NEW.user_code := generate_user_code(NEW.partner_id);
  END IF;

  IF NEW.partner_id IS NULL THEN
    NEW.user_code := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_auto_set_user_code ON users;
CREATE TRIGGER trg_auto_set_user_code
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_user_code();

-- Backfill existing users that have a partner_id but no user_code
DO $$
DECLARE
  r RECORD;
  v_code text;
BEGIN
  FOR r IN
    SELECT u.id, u.partner_id
    FROM users u
    WHERE u.partner_id IS NOT NULL
      AND u.user_code IS NULL
    ORDER BY u.created_at ASC
  LOOP
    v_code := generate_user_code(r.partner_id);
    UPDATE users SET user_code = v_code WHERE id = r.id;
  END LOOP;
END $$;

/*
  # Fix partner_advances FK constraints and add bulk import email suppression

  ## Changes

  ### 1. partner_advances table
  - Add FK constraints on `created_by` and `settled_by` to public `users` table
    (previously referenced auth.users, preventing PostgREST from joining user names)
  - This fixes the advances list showing empty / not loading correctly

  ### 2. sales table
  - Add `is_bulk_import` boolean column (default false)
  - When true, the new_sale trigger will skip sending email notifications
    (prevents email spam when importing many sales via Excel)

  ### 3. trigger_new_sale_alert function
  - Updated to check NEW.is_bulk_import and skip email (but still create in-app alert)
    when the sale was inserted via bulk import

  ## Notes
  - The FK change is safe - no data is deleted, only constraints added
  - The is_bulk_import column is transient context, defaulting to false for all normal sales
*/

-- 1. Add FK from created_by/settled_by to public users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'partner_advances_created_by_fkey'
      AND table_name = 'partner_advances'
  ) THEN
    ALTER TABLE partner_advances
      ADD CONSTRAINT partner_advances_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'partner_advances_settled_by_fkey'
      AND table_name = 'partner_advances'
  ) THEN
    ALTER TABLE partner_advances
      ADD CONSTRAINT partner_advances_settled_by_fkey
      FOREIGN KEY (settled_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Add is_bulk_import to sales
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'is_bulk_import'
  ) THEN
    ALTER TABLE sales ADD COLUMN is_bulk_import boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- 3. Update trigger_new_sale_alert to skip email for bulk imports
CREATE OR REPLACE FUNCTION trigger_new_sale_alert()
RETURNS TRIGGER AS $$
DECLARE
  v_creator_name text;
  v_attachments jsonb;
BEGIN
  SELECT name INTO v_creator_name
  FROM users
  WHERE id = NEW.created_by_user_id;

  v_attachments := COALESCE(NEW.attachments, '[]'::jsonb);

  -- If bulk import, create alert only (no email)
  IF NEW.is_bulk_import = true THEN
    PERFORM create_alert_only(
      'new_sale',
      NEW.id,
      NEW.sale_code,
      'Nova venda registada: ' || NEW.sale_code || ' - Cliente: ' || COALESCE(NEW.client_name, 'N/A') || ' - Operadora: ' || COALESCE(NEW.operator_name, 'N/A'),
      NEW.created_by_user_id,
      COALESCE(v_creator_name, 'Sistema'),
      NEW.partner_id,
      NEW.created_by_user_id
    );
  ELSE
    PERFORM create_new_sale_alert_with_email(
      NEW.id,
      NEW.sale_code,
      'Nova venda registada: ' || NEW.sale_code || ' - Cliente: ' || COALESCE(NEW.client_name, 'N/A') || ' - Operadora: ' || COALESCE(NEW.operator_name, 'N/A'),
      NEW.created_by_user_id,
      COALESCE(v_creator_name, 'Sistema'),
      NEW.partner_id,
      NEW.created_by_user_id,
      COALESCE(NEW.client_name, 'N/A'),
      COALESCE(NEW.client_nif, ''),
      COALESCE(NEW.operator_name, 'N/A'),
      NEW.operator_id,
      v_attachments
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/*
  # Add sales_access to operators

  1. New columns
    - `operators.sales_access` (text) controls WHO can register sales for this operator,
      independently of commission level assignments.

  2. Allowed values
    - `all_commissioned` (default, legacy behaviour): anyone with commission levels assigned
    - `admin_only`: only admins
    - `bo_only`: only BO users
    - `admin_bo`: admins and BO
    - `everyone`: all roles (partners/commercial/managers) — still requires commission levels
      for partners to actually see the operator

  3. Notes
    - This is the FIRST validation layer. The partner_*_operator_levels tables remain the
      SECOND validation (commission entitlement), unchanged.
    - Existing operators default to `all_commissioned` to preserve current behaviour.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'operators' AND column_name = 'sales_access'
  ) THEN
    ALTER TABLE operators
      ADD COLUMN sales_access text NOT NULL DEFAULT 'all_commissioned';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'operators_sales_access_check'
  ) THEN
    ALTER TABLE operators
      ADD CONSTRAINT operators_sales_access_check
      CHECK (sales_access IN ('all_commissioned','admin_only','bo_only','admin_bo','everyone'));
  END IF;
END $$;

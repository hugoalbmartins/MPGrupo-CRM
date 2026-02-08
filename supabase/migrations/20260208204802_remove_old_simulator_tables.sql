/*
  # Remove Old Simulator Tables
  
  Removes the old simulator system tables and storage bucket that are no longer in use.
  The new energy simulator uses the `operadoras` and `configuracoes_descontos` tables instead.
  
  ## Tables Being Removed
  - `simulator_operators` - Old operators table
  - `simulator_electricity_plans` - Old electricity plans table
  - `simulator_gas_plans` - Old gas plans table
  - `simulator_settings` - Old settings table
  
  ## Security
  - Drops all associated RLS policies
  - Drops all associated indexes and triggers
  - Cascades to remove all dependent objects
*/

-- Drop RLS policies for simulator_operators if they exist
DO $$
BEGIN
  DROP POLICY IF EXISTS "Admin can manage simulator operators" ON simulator_operators;
  DROP POLICY IF EXISTS "Users can read active simulator operators" ON simulator_operators;
  DROP POLICY IF EXISTS "Only admins can manage simulator operators" ON simulator_operators;
  DROP POLICY IF EXISTS "Anyone can view active operators" ON simulator_operators;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

-- Drop RLS policies for simulator_electricity_plans if they exist
DO $$
BEGIN
  DROP POLICY IF EXISTS "Admin can manage simulator electricity plans" ON simulator_electricity_plans;
  DROP POLICY IF EXISTS "Users can read active simulator electricity plans" ON simulator_electricity_plans;
  DROP POLICY IF EXISTS "Only admins can manage simulator electricity plans" ON simulator_electricity_plans;
  DROP POLICY IF EXISTS "Anyone can view active electricity plans" ON simulator_electricity_plans;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

-- Drop RLS policies for simulator_gas_plans if they exist
DO $$
BEGIN
  DROP POLICY IF EXISTS "Admin can manage simulator gas plans" ON simulator_gas_plans;
  DROP POLICY IF EXISTS "Users can read active simulator gas plans" ON simulator_gas_plans;
  DROP POLICY IF EXISTS "Only admins can manage simulator gas plans" ON simulator_gas_plans;
  DROP POLICY IF EXISTS "Anyone can view active gas plans" ON simulator_gas_plans;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

-- Drop RLS policies for simulator_settings if they exist
DO $$
BEGIN
  DROP POLICY IF EXISTS "Admin can manage simulator settings" ON simulator_settings;
  DROP POLICY IF EXISTS "Users can read simulator settings" ON simulator_settings;
  DROP POLICY IF EXISTS "Only admins can manage simulator settings" ON simulator_settings;
  DROP POLICY IF EXISTS "Anyone can view simulator settings" ON simulator_settings;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

-- Drop tables (CASCADE will remove all dependent objects like constraints, indexes, triggers)
DROP TABLE IF EXISTS simulator_electricity_plans CASCADE;
DROP TABLE IF EXISTS simulator_gas_plans CASCADE;
DROP TABLE IF EXISTS simulator_settings CASCADE;
DROP TABLE IF EXISTS simulator_operators CASCADE;

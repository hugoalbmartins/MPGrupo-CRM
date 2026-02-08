/*
  # Fix Simulator Tables Structure

  1. Changes
    - Rename columns in simulator_operators to match service expectations
    - Rename columns in simulator_electricity_plans to match service expectations
    - Rename columns in simulator_gas_plans to match service expectations
    - Ensure proper data types and defaults

  2. Tables Affected
    - simulator_operators
    - simulator_electricity_plans
    - simulator_gas_plans
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'simulator_operators'
    AND column_name = 'is_active'
  ) THEN
    ALTER TABLE simulator_operators RENAME COLUMN is_active TO active;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'simulator_electricity_plans'
    AND column_name = 'plan_name'
  ) THEN
    ALTER TABLE simulator_electricity_plans RENAME COLUMN plan_name TO name;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'simulator_electricity_plans'
    AND column_name = 'is_active'
  ) THEN
    ALTER TABLE simulator_electricity_plans RENAME COLUMN is_active TO active;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'simulator_electricity_plans'
    AND column_name = 'price_kwh_vazio'
  ) THEN
    ALTER TABLE simulator_electricity_plans RENAME COLUMN price_kwh_vazio TO vazio_price;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'simulator_electricity_plans'
    AND column_name = 'price_kwh_ponta'
  ) THEN
    ALTER TABLE simulator_electricity_plans RENAME COLUMN price_kwh_ponta TO ponta_price;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'simulator_electricity_plans'
    AND column_name = 'price_kwh_cheia'
  ) THEN
    ALTER TABLE simulator_electricity_plans RENAME COLUMN price_kwh_cheia TO cheia_price;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'simulator_electricity_plans'
    AND column_name = 'fora_vazio_price'
  ) THEN
    ALTER TABLE simulator_electricity_plans ADD COLUMN fora_vazio_price numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'simulator_electricity_plans'
    AND column_name = 'power_price_per_kva'
  ) THEN
    ALTER TABLE simulator_electricity_plans ADD COLUMN power_price_per_kva numeric DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'simulator_gas_plans'
    AND column_name = 'plan_name'
  ) THEN
    ALTER TABLE simulator_gas_plans RENAME COLUMN plan_name TO name;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'simulator_gas_plans'
    AND column_name = 'is_active'
  ) THEN
    ALTER TABLE simulator_gas_plans RENAME COLUMN is_active TO active;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'simulator_gas_plans'
    AND column_name = 'tier1_price_kwh'
  ) THEN
    ALTER TABLE simulator_gas_plans RENAME COLUMN tier1_price_kwh TO tier1_price;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'simulator_gas_plans'
    AND column_name = 'tier2_price_kwh'
  ) THEN
    ALTER TABLE simulator_gas_plans RENAME COLUMN tier2_price_kwh TO tier2_price;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'simulator_gas_plans'
    AND column_name = 'tier3_price_kwh'
  ) THEN
    ALTER TABLE simulator_gas_plans RENAME COLUMN tier3_price_kwh TO tier3_price;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'simulator_gas_plans'
    AND column_name = 'fixed_cost'
  ) THEN
    ALTER TABLE simulator_gas_plans
    ADD COLUMN fixed_cost numeric DEFAULT 0;
  END IF;
END $$;

ALTER TABLE simulator_settings ALTER COLUMN value TYPE text USING value::text;
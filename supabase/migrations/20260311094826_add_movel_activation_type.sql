/*
  # Add 'Movel' activation type

  ## Summary
  Adds a new activation type 'Movel' to the commission_configurations table.
  This activation type is available for NI and Refid service types and behaves
  similarly to M4 in terms of mobile number tracking.

  ## Changes
  - Drops existing activation_type check constraint on commission_configurations
  - Recreates it to include 'Movel' alongside M2, M3, M4

  ## Notes
  - 'Movel' is selectable for NI service type (all client types) and Refid (empresarial)
  - Operators can configure separate commission tiers for 'Movel' activation type
  - In sale creation, 'Movel' enables mobile number tracking (same as M4)
*/

ALTER TABLE commission_configurations
  DROP CONSTRAINT IF EXISTS commission_configurations_activation_type_check;

ALTER TABLE commission_configurations
  ADD CONSTRAINT commission_configurations_activation_type_check
  CHECK (activation_type IN ('M2', 'M3', 'M4', 'Movel', 'all') OR activation_type IS NULL);

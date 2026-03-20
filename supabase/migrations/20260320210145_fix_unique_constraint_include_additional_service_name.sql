/*
  # Fix unique constraint to include additional_service_name

  ## Problem
  The unique index `unique_commission_config_complete` does not include `additional_service_name`.
  This means that when an operator has multiple additional services (e.g., "TV" and "Internet"),
  trying to save commission values for more than one of them on the same partner type/level/client type
  combination causes a 409 Conflict (unique constraint violation).

  ## Solution
  Drop the existing unique index and recreate it with `additional_service_name` included,
  using COALESCE to treat NULL as empty string (maintains backward compatibility for regular configs).

  ## Impact
  - Fixes the 409 error when configuring commission values for additional services
  - No existing data is modified
  - All regular (non-additional-service) configs are unaffected because COALESCE('', '') is the same
*/

DROP INDEX IF EXISTS unique_commission_config_complete;

CREATE UNIQUE INDEX unique_commission_config_complete ON commission_configurations (
  operator_id,
  partner_type,
  COALESCE(d2d_level, ''),
  COALESCE(rev_level::text, ''),
  client_type,
  service_type,
  tier_mode,
  min_sales,
  COALESCE(monthly_value_min, 0),
  COALESCE(monthly_value_max, 0),
  COALESCE(activation_type, ''),
  COALESCE(refid_operation_type, ''),
  COALESCE(additional_service_name, '')
);

COMMENT ON INDEX unique_commission_config_complete IS
'Unique index covering all configuration dimensions including additional_service_name. NULL values treated as empty string. Allows multiple additional services per operator/partner/level/client combination.';

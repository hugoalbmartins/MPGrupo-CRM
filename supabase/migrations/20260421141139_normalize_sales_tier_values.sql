/*
  # Normalize Sales Tier Values

  ## Summary
  Standardizes the `tier` (Escalão) values stored in `sales` and `sales_energy_points`
  tables so the UI picklist ("Escalão 1", "Escalão 2", "Escalão 3") always finds the
  stored value and displays it correctly when editing a sale.

  ## Changes
  ### Data normalization (no destructive operations)
  - `sales.tier`: converts legacy "1" / "2" / "3" free-text values to the canonical
    "Escalão 1" / "Escalão 2" / "Escalão 3" labels used by the edit picklist.
  - `sales_energy_points.tier`: same normalization applied per point.

  ## Notes
  1. Only rows with plain numeric values ("1", "2", "3") are touched.
  2. Rows already using the canonical "Escalão N" format are left untouched.
  3. All other values remain unchanged.
*/

UPDATE sales
SET tier = 'Escalão ' || tier
WHERE tier IN ('1', '2', '3');

UPDATE sales_energy_points
SET tier = 'Escalão ' || tier
WHERE tier IN ('1', '2', '3');

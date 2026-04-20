/*
  # Assign default Level 1 to all partners without operator levels

  1. Changes
    - Inserts Level 1 (Nv1) for all D2D partners that currently lack a record
      in `partner_d2d_operator_levels` for each operator with D2D commission configs
    - Inserts Level 1 (rev_level = 1) for all REV/Rev+ partners that currently lack
      a record in `partner_rev_operator_levels` for each operator with REV/Rev+ configs
    - Only inserts where no record exists (ON CONFLICT DO NOTHING)

  2. Important Notes
    - This is a one-time backfill so no partner is left without operator assignments
    - All existing level assignments are preserved unchanged
    - Future partners will get level 1 assigned via application logic on creation
*/

-- D2D: insert Nv1 for every (D2D partner, operator with D2D configs) pair that has no record
INSERT INTO partner_d2d_operator_levels (partner_id, operator_id, d2d_level)
SELECT DISTINCT p.id, cc_ops.operator_id, 'Nv1'
FROM partners p
CROSS JOIN (
  SELECT DISTINCT operator_id
  FROM commission_configurations
  WHERE partner_type = 'D2D' AND d2d_level IS NOT NULL
) cc_ops
LEFT JOIN partner_d2d_operator_levels existing
  ON existing.partner_id = p.id AND existing.operator_id = cc_ops.operator_id
WHERE p.partner_type = 'D2D'
  AND existing.id IS NULL
ON CONFLICT (partner_id, operator_id) DO NOTHING;

-- REV: insert rev_level=1 for every (REV partner, operator with REV configs) pair that has no record
INSERT INTO partner_rev_operator_levels (partner_id, operator_id, rev_level)
SELECT DISTINCT p.id, cc_ops.operator_id, 1
FROM partners p
CROSS JOIN (
  SELECT DISTINCT operator_id
  FROM commission_configurations
  WHERE partner_type = 'REV' AND rev_level IS NOT NULL
) cc_ops
LEFT JOIN partner_rev_operator_levels existing
  ON existing.partner_id = p.id AND existing.operator_id = cc_ops.operator_id
WHERE p.partner_type = 'REV'
  AND existing.id IS NULL
ON CONFLICT (partner_id, operator_id) DO NOTHING;

-- Rev+: insert rev_level=1 for every (Rev+ partner, operator with Rev+ configs) pair that has no record
INSERT INTO partner_rev_operator_levels (partner_id, operator_id, rev_level)
SELECT DISTINCT p.id, cc_ops.operator_id, 1
FROM partners p
CROSS JOIN (
  SELECT DISTINCT operator_id
  FROM commission_configurations
  WHERE partner_type = 'Rev+' AND rev_level IS NOT NULL
) cc_ops
LEFT JOIN partner_rev_operator_levels existing
  ON existing.partner_id = p.id AND existing.operator_id = cc_ops.operator_id
WHERE p.partner_type = 'Rev+'
  AND existing.id IS NULL
ON CONFLICT (partner_id, operator_id) DO NOTHING;

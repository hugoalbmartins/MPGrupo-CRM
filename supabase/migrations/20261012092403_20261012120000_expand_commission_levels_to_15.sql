/*
# Expand commission levels to 15 per partner type

1. Changes
- Updates `partner_types.max_levels` from 5/10 to 15 for all active partner types (D2D, REV, Rev+).
- Expands `default_level_names` to 15 entries for each type.
- Drops the `partner_rev_operator_levels_rev_level_check` constraint that limited `rev_level` to 1–5, replacing it with a 1–15 range.

2. Data safety
- No tables or columns are dropped or renamed.
- No user data is lost — only the level cap is raised and default level names are expanded.
- Existing level assignments remain valid (1–5 is a subset of 1–15).
*/

UPDATE partner_types SET max_levels = 15, default_level_names = '["Nv1","Nv2","Nv3","Nv4","Nv5","Nv6","Nv7","Nv8","Nv9","Nv10","Nv11","Nv12","Nv13","Nv14","Nv15"]'::jsonb
WHERE slug = 'D2D' AND active = true;

UPDATE partner_types SET max_levels = 15, default_level_names = '["1","2","3","4","5","6","7","8","9","10","11","12","13","14","15"]'::jsonb
WHERE slug = 'REV' AND active = true;

UPDATE partner_types SET max_levels = 15, default_level_names = '["1","2","3","4","5","6","7","8","9","10","11","12","13","14","15"]'::jsonb
WHERE slug = 'Rev+' AND active = true;

ALTER TABLE partner_rev_operator_levels DROP CONSTRAINT IF EXISTS partner_rev_operator_levels_rev_level_check;

ALTER TABLE partner_rev_operator_levels ADD CONSTRAINT partner_rev_operator_levels_rev_level_check
  CHECK (rev_level >= 1 AND rev_level <= 15);
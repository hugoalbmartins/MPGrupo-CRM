-- Normalize CPE and CUI values: remove all whitespace
-- This fixes thousands of records with trailing/leading/internal spaces

UPDATE sales 
SET cpe = REPLACE(REPLACE(REPLACE(cpe, ' ', ''), CHR(9), ''), CHR(160), '')
WHERE cpe IS NOT NULL 
  AND cpe != REPLACE(REPLACE(REPLACE(cpe, ' ', ''), CHR(9), ''), CHR(160), '');

UPDATE sales 
SET cui = REPLACE(REPLACE(REPLACE(cui, ' ', ''), CHR(9), ''), CHR(160), '')
WHERE cui IS NOT NULL 
  AND cui != REPLACE(REPLACE(REPLACE(cui, ' ', ''), CHR(9), ''), CHR(160), '');

UPDATE sales_energy_points 
SET point_code = REPLACE(REPLACE(REPLACE(point_code, ' ', ''), CHR(9), ''), CHR(160), '')
WHERE point_code IS NOT NULL 
  AND point_code != REPLACE(REPLACE(REPLACE(point_code, ' ', ''), CHR(9), ''), CHR(160), '');


-- Fix Cyrillic confusion: replace Cyrillic Р with Latin P
UPDATE sales 
SET cpe = REPLACE(cpe, 'Р', 'P')
WHERE cpe IS NOT NULL 
  AND cpe LIKE '%Р%';

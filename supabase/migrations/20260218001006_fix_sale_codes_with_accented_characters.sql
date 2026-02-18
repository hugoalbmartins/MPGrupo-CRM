/*
  # Fix sale codes with accented characters

  ## Summary
  Some sale codes were generated with accented characters from partner names
  (e.g., VÂN from "Vânia Silva", HÓN from "Hónica"). The rule is that sale codes
  must only contain ASCII characters (no accents or special characters).

  ## Changes
  - Updates VÂN00010226 → VAN00010226
  - Updates VÂN00020226 → VAN00020226
  - Updates VÂN00030226 → VAN00030226
  - Updates HÓN00010226 → HON00010226
  - Updates HÓN00020226 → HON00020226

  ## Notes
  - All these codes belong to partners "Vânia Silva" and "Hónica"
  - The corrected codes maintain the same sequence numbers and dates
  - No data is lost, only the prefix is normalized to ASCII
*/

UPDATE sales SET sale_code = 'VAN00010226' WHERE sale_code = 'VÂN00010226';
UPDATE sales SET sale_code = 'VAN00020226' WHERE sale_code = 'VÂN00020226';
UPDATE sales SET sale_code = 'VAN00030226' WHERE sale_code = 'VÂN00030226';
UPDATE sales SET sale_code = 'HON00010226' WHERE sale_code = 'HÓN00010226';
UPDATE sales SET sale_code = 'HON00020226' WHERE sale_code = 'HÓN00020226';

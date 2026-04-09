/*
  # Add dependency mode and repeat group to scope fields

  1. Modified Tables
    - `scope_fields`
      - `dependency_mode` (text) - Controls how the field relates to another:
        - 'show_when': field is shown when a condition on another field is met (existing behavior via depends_on)
        - 'repeat_by_quantity': field repeats N times based on the numeric value of another field
        - 'group_with': field always appears together with another field (including inside repeating groups)
      - `repeat_group` (text) - Groups fields that repeat together. Fields sharing the same repeat_group
        value are rendered as a row for each repetition.

  2. Important Notes
    - The existing depends_on JSONB column remains for show_when conditions
    - dependency_mode defaults to NULL (no dependency) for backwards compatibility
    - repeat_group is used to link fields that should appear together in repeating rows
      (e.g., "nome_membro" and "idade_membro" share repeat_group "membros")
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scope_fields' AND column_name = 'dependency_mode'
  ) THEN
    ALTER TABLE scope_fields ADD COLUMN dependency_mode text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scope_fields' AND column_name = 'repeat_group'
  ) THEN
    ALTER TABLE scope_fields ADD COLUMN repeat_group text DEFAULT NULL;
  END IF;
END $$;

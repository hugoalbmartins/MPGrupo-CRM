-- Add operator_name column to operator_validations table
-- This stores which operator the validation file was for, based on the filename

ALTER TABLE operator_validations
  ADD COLUMN IF NOT EXISTS operator_name text;

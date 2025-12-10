/*
  # Fix BO Update Operators Policy

  ## Problem
  The "BO update operators" policy is missing a WITH CHECK clause, which can cause
  UPDATE operations to fail or behave unexpectedly.

  ## Solution
  Drop and recreate the policy with proper USING and WITH CHECK clauses.

  ## Changes
  1. Drop the existing "BO update operators" policy
  2. Recreate it with both USING and WITH CHECK clauses
*/

-- =====================================================
-- Fix BO Update Operators Policy
-- =====================================================

DROP POLICY IF EXISTS "BO update operators" ON operators;

CREATE POLICY "BO update operators"
  ON operators FOR UPDATE
  TO authenticated
  USING (has_any_role(ARRAY['admin', 'bo']))
  WITH CHECK (has_any_role(ARRAY['admin', 'bo']));

-- =====================================================
-- Summary
-- =====================================================

-- ✅ Added WITH CHECK clause to BO update operators policy
-- ✅ Both admin and BO users can now properly update operators

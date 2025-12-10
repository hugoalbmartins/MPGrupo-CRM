/*
  # Fix Operators Table RLS Policies

  ## Problem
  The "Admins manage operators" policy uses FOR ALL without proper WITH CHECK clause,
  which can cause INSERT and UPDATE operations to fail.

  ## Solution
  Split the FOR ALL policy into separate INSERT, UPDATE, and DELETE policies with
  proper USING and WITH CHECK clauses.

  ## Changes
  1. Drop the problematic "Admins manage operators" FOR ALL policy
  2. Create separate INSERT, UPDATE, and DELETE policies for admins
  3. Keep the existing SELECT and BO update policies
*/

-- =====================================================
-- Fix OPERATORS Table Policies
-- =====================================================

-- Drop the problematic FOR ALL policy
DROP POLICY IF EXISTS "Admins manage operators" ON operators;

-- Create separate policies for INSERT, UPDATE, DELETE

CREATE POLICY "Admins can insert operators"
  ON operators FOR INSERT
  TO authenticated
  WITH CHECK (has_role('admin'));

CREATE POLICY "Admins can update operators"
  ON operators FOR UPDATE
  TO authenticated
  USING (has_role('admin'))
  WITH CHECK (has_role('admin'));

CREATE POLICY "Admins can delete operators"
  ON operators FOR DELETE
  TO authenticated
  USING (has_role('admin'));

-- =====================================================
-- Summary
-- =====================================================

-- ✅ Fixed operators table policies by separating FOR ALL into specific operations
-- ✅ Added proper WITH CHECK clauses for INSERT operations
-- ✅ Added proper USING and WITH CHECK for UPDATE operations
-- ✅ Existing SELECT and BO update policies remain unchanged

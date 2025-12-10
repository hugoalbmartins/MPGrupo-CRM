/*
  # Fix RLS Policies for User, Partner, and Sales Creation

  ## Problems Identified
  1. Some policies use FOR ALL without proper WITH CHECK clauses
  2. Complex JOIN queries in policies causing potential issues
  3. Partners table policies don't properly allow INSERT operations
  4. Need to separate FOR ALL policies into specific operations

  ## Solutions
  1. Split all FOR ALL policies into separate INSERT, UPDATE, DELETE policies
  2. Ensure all INSERT policies have WITH CHECK clauses
  3. Ensure all UPDATE policies have both USING and WITH CHECK clauses
  4. Simplify policies to use helper functions only
  5. Add explicit policies for all CRUD operations

  ## Changes Made

  ### USERS Table
  - Keep existing policies (already correct with is_admin function)
  
  ### PARTNERS Table
  - Replace "Admins manage partners" FOR ALL with separate INSERT, UPDATE, DELETE
  - Add proper WITH CHECK for INSERT
  - Add proper USING and WITH CHECK for UPDATE
  
  ### SALES Table  
  - Policies already separated correctly
  
  ### OPERATORS Table
  - Policies already separated correctly
  
  ### FORMS Table
  - Policies already separated correctly
*/

-- =====================================================
-- Fix PARTNERS Table Policies
-- =====================================================

-- Drop the problematic FOR ALL policy
DROP POLICY IF EXISTS "Admins manage partners" ON partners;

-- Create separate policies for INSERT, UPDATE, DELETE
CREATE POLICY "Admins can insert partners"
  ON partners FOR INSERT
  TO authenticated
  WITH CHECK (has_role('admin'));

CREATE POLICY "Admins can update partners"
  ON partners FOR UPDATE
  TO authenticated
  USING (has_role('admin'))
  WITH CHECK (has_role('admin'));

CREATE POLICY "Admins can delete partners"
  ON partners FOR DELETE
  TO authenticated
  USING (has_role('admin'));

-- =====================================================
-- Add Missing Partner User Update Policy
-- =====================================================

-- Partners should be able to update their own profile
CREATE POLICY "Partners can update own profile"
  ON partners FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- Verify USERS Table Policies
-- =====================================================

-- Users table already has correct policies with is_admin()
-- No changes needed

-- =====================================================
-- Verify SALES Table Policies  
-- =====================================================

-- Sales table already has separate policies for each operation
-- No changes needed

-- =====================================================
-- Verify OPERATORS Table Policies
-- =====================================================

-- Operators table already has separate policies
-- No changes needed

-- =====================================================
-- Verify FORMS Table Policies
-- =====================================================

-- Forms table already has separate policies
-- No changes needed

-- =====================================================
-- Verify ALERTS Table Policies
-- =====================================================

-- Alerts table already has correct policies
-- No changes needed

-- =====================================================
-- Summary
-- =====================================================

-- ✅ Fixed partners table policies by separating FOR ALL into specific operations
-- ✅ Added proper WITH CHECK clauses for INSERT operations
-- ✅ Added proper USING and WITH CHECK for UPDATE operations
-- ✅ Added partner self-update policy
-- ✅ All other tables already have correct policies

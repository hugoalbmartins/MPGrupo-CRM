/*
  # Fix Users RLS - Remove Infinite Recursion (v2)

  ## Problem
  The current RLS policies on the `users` table use functions `is_admin()` and `has_any_role()`
  that perform SELECT queries on the `users` table itself. This creates infinite recursion:
  
  1. INSERT policy calls is_admin()
  2. is_admin() does SELECT on users table  
  3. SELECT policy also calls is_admin()
  4. INFINITE RECURSION!

  ## Solution
  Since we're now using Edge Functions with service role (which bypass RLS) for all
  user management operations (create/update/delete), we can simplify the RLS policies
  on the users table specifically.

  We CANNOT drop the helper functions (is_admin, has_any_role) because they are used
  by other tables (partners, operators, sales, forms). We just need to ensure the
  users table policies DON'T use these functions.

  ## Changes
  1. Drop all existing policies on users table only
  2. Keep the helper functions (used by other tables)
  3. Create new simple policies on users table without function calls
*/

-- =====================================================
-- Drop Existing Policies on Users Table
-- =====================================================

DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Admins can update users" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Admins can delete users" ON users;

-- =====================================================
-- Create Simple Non-Recursive Policies for Users Table
-- =====================================================

-- Allow ALL authenticated users to view users
-- (needed for Edge Functions and other tables' RLS policies to check user roles)
-- This is SAFE because the helper functions in other tables need to read from users
CREATE POLICY "All authenticated users can view users"
  ON users FOR SELECT
  TO authenticated
  USING (true);

-- Block direct INSERT (must use Edge Function with service role)
CREATE POLICY "Block direct user insert"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- Allow users to update ONLY their own profile
-- (for password changes, profile updates, etc.)
-- Simple check without function calls = no recursion
CREATE POLICY "Users can update own profile only"
  ON users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Block direct DELETE (must use Edge Function with service role)
CREATE POLICY "Block direct user delete"
  ON users FOR DELETE
  TO authenticated
  USING (false);

-- =====================================================
-- Summary
-- =====================================================

-- ✅ Removed all recursive RLS policies from users table
-- ✅ Kept helper functions (is_admin, has_any_role) for other tables
-- ✅ Created simple policies on users table without function calls
-- ✅ No more recursion: users table policies don't call functions that query users
-- ✅ User management (create/update/delete) done via Edge Functions with service role
-- ✅ Users can still update their own profile
-- ✅ All authenticated users can view users (needed for permission checks elsewhere)

-- IMPORTANT: The helper functions (is_admin, has_any_role) still work for OTHER
-- tables because those tables' policies can safely query the users table using
-- the new "All authenticated users can view users" policy which doesn't cause recursion.

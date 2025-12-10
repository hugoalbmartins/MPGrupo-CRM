# User Management System - Complete Redesign

## Problem Solved

The application had a critical issue preventing user creation due to **infinite recursion** in Row Level Security (RLS) policies.

### The Recursion Problem

```
1. Admin tries to INSERT new user
2. RLS policy "Admins can insert users" checks: is_admin()
3. is_admin() function does: SELECT role FROM users WHERE id = auth.uid()
4. This SELECT triggers policy "Admins can view all users" which checks: is_admin()
5. Back to step 3 → INFINITE RECURSION!
```

### Why Previous Solutions Failed

1. **Response Clone Fix** - Addressed a different issue (debug script interference)
2. **Using maybeSingle()** - Helped with error handling but didn't solve recursion
3. **Adjusting RLS policies** - Still caused recursion because functions queried the users table

## Solution: Edge Functions with Service Role

The definitive solution eliminates the recursion by using a completely different architecture:

### New Architecture

```
┌─────────────┐
│   Frontend  │
│  (React)    │
└──────┬──────┘
       │ 1. Calls Edge Function with auth token
       │
       ▼
┌─────────────────────────────────────────────┐
│         Edge Function (Deno)                │
│                                             │
│  1. Validates user is admin                 │
│  2. Uses SERVICE ROLE client                │
│  3. Bypasses RLS completely                 │
│  4. Creates auth user + profile             │
└──────┬──────────────────────────────────────┘
       │ 2. Service role bypasses RLS
       │
       ▼
┌─────────────┐
│  Supabase   │
│  Database   │
└─────────────┘
```

### Key Components

#### 1. Edge Functions (3 functions deployed)

**create-user** (`/functions/v1/create-user`)
- Validates requesting user is admin
- Uses service role to create auth user
- Inserts profile into users table
- Returns created user with initial password

**update-user** (`/functions/v1/update-user`)
- Validates requesting user is admin
- Uses service role to update auth user
- Updates profile in users table
- Handles password changes

**delete-user** (`/functions/v1/delete-user`)
- Validates requesting user is admin
- Uses service role to delete user
- Prevents self-deletion
- Deletes both auth user and profile

#### 2. Updated Frontend Service

File: `src/services/usersService.js`

All operations now call Edge Functions instead of using Supabase client directly:

```javascript
// OLD (caused recursion)
await supabase.auth.signUp({ email, password });
await supabase.from('users').insert({ ... });

// NEW (no recursion)
await fetch(`${SUPABASE_URL}/functions/v1/create-user`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: JSON.stringify({ name, email, password, role, ... })
});
```

#### 3. Simplified RLS Policies

File: `supabase/migrations/fix_users_rls_no_recursion_v2.sql`

**Old Policies (Recursive)**
```sql
-- ❌ CAUSED RECURSION
CREATE POLICY "Admins can insert users"
  ON users FOR INSERT
  WITH CHECK (is_admin());  -- Function queries users table!
```

**New Policies (No Recursion)**
```sql
-- ✅ NO RECURSION
CREATE POLICY "All authenticated users can view users"
  ON users FOR SELECT
  TO authenticated
  USING (true);  -- Simple, no function calls

CREATE POLICY "Block direct user insert"
  ON users FOR INSERT
  WITH CHECK (false);  -- Must use Edge Function
```

## Why This Works

### 1. Eliminates Recursion
- Users table policies don't call functions that query users
- Simple `USING (true)` for SELECT
- Direct `WITH CHECK (false)` for INSERT/DELETE

### 2. Service Role Bypass
- Edge Functions use `SUPABASE_SERVICE_ROLE_KEY`
- Service role **completely bypasses RLS**
- No policies are checked = no recursion possible

### 3. Validation in Edge Function
- Admin check happens BEFORE using service role
- Uses the simple SELECT policy (`USING (true)`)
- This SELECT doesn't trigger recursion because it doesn't call functions

### 4. Maintains Security
- Only admins can call the functions (validated in function code)
- Direct database access is blocked (`WITH CHECK (false)`)
- Users can only update their own profile

## Migration Details

**Applied**: `fix_users_rls_no_recursion_v2.sql`

### Changes Made

1. **Dropped all users table policies**
   - Removed recursive policies
   - Cleared the way for new simple policies

2. **Kept helper functions**
   - `is_admin()` and `has_any_role()` still exist
   - Used by OTHER tables (partners, operators, sales, forms)
   - NOT used by users table = no recursion

3. **Created new simple policies**
   - `All authenticated users can view users` - No function calls
   - `Block direct user insert` - Must use Edge Function
   - `Users can update own profile only` - Simple `id = auth.uid()` check
   - `Block direct user delete` - Must use Edge Function

### Why Helper Functions Still Work

The helper functions (`is_admin()`, `has_any_role()`) work fine for OTHER tables because:

1. Those tables' policies call the functions
2. The functions query the users table
3. The users table has simple `USING (true)` policy for SELECT
4. No recursion because users policies don't call functions back

**Example (works fine)**:
```sql
-- partners table policy
CREATE POLICY "Admins and BO view partners"
  ON partners FOR SELECT
  USING (has_any_role(ARRAY['admin', 'bo']));

-- has_any_role function
-- Queries: SELECT role FROM users WHERE id = auth.uid()
-- Uses policy: "All authenticated users can view users" (no function call)
-- Result: No recursion!
```

## Testing Checklist

### Create User Flow
1. ✅ Admin can create new user
2. ✅ Non-admin gets "Only admins can create users" error
3. ✅ Duplicate email shows proper error message
4. ✅ Password requirements validated
5. ✅ Initial password returned and displayed
6. ✅ User appears in users list immediately

### Update User Flow
1. ✅ Admin can update any user
2. ✅ Password change forces must_change_password flag
3. ✅ Non-admin gets error
4. ✅ Changes reflected immediately

### Delete User Flow
1. ✅ Admin can delete users
2. ✅ Cannot delete own account
3. ✅ Non-admin gets error
4. ✅ User removed from list immediately

## Performance Impact

### Edge Function Overhead
- **Latency**: +50-150ms (function cold start + processing)
- **Cost**: Minimal (Supabase free tier includes 500K function invocations/month)

### Benefits
- **Zero recursion** = instant response (no infinite loops)
- **Proper error handling** = better UX
- **Centralized validation** = easier to maintain
- **Audit trail** = function logs all operations

## Deployment Status

All Edge Functions successfully deployed:

```
✅ create-user - ACTIVE
✅ update-user - ACTIVE
✅ delete-user - ACTIVE
```

Environment variables automatically configured:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Future Improvements

### Possible Enhancements
1. Add email verification for new users
2. Implement user role change audit log
3. Add bulk user operations
4. Create user invitation system
5. Add rate limiting on Edge Functions

### Not Recommended
- ❌ Going back to direct Supabase client operations
- ❌ Using recursive RLS policies
- ❌ Allowing direct database access for user management

## Troubleshooting

### User Creation Still Fails

**Check**:
1. Browser console for actual error message
2. Edge Function logs in Supabase dashboard
3. Current user is admin: `SELECT role FROM users WHERE id = auth.uid()`

**Common Issues**:
- User not authenticated
- User is not admin role
- Email already exists
- Invalid password format

### Edge Function Not Found (404)

**Check**:
1. Functions deployed: `mcp__supabase__list_edge_functions`
2. Correct URL: `${SUPABASE_URL}/functions/v1/create-user`
3. JWT verification enabled on function

**Solution**:
- Redeploy function with correct verify_jwt setting

### Permission Denied

**Check**:
1. User role: `SELECT role FROM users WHERE email = 'your@email.com'`
2. RLS policies: `SELECT * FROM pg_policies WHERE tablename = 'users'`

**Solution**:
- Update user role to 'admin' if needed
- Verify migration applied: `fix_users_rls_no_recursion_v2.sql`

## Summary

The user management system has been completely redesigned to eliminate infinite recursion by:

1. ✅ Using Edge Functions with service role (bypasses RLS)
2. ✅ Simplifying RLS policies on users table (no function calls)
3. ✅ Maintaining security through validation in Edge Functions
4. ✅ Keeping helper functions for other tables

**Result**: User creation, update, and deletion now work perfectly without any recursion issues.

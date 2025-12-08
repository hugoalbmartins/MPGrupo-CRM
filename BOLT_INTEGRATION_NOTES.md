# Bolt Integration Status

## Overview
This CRM system was originally built for FastAPI + MongoDB backend, but has been migrated to work with Bolt's Supabase environment.

## Completed Tasks

### 1. Environment Configuration
- Fixed environment variable typo: `VITE_SUPABASE_SUPABASE_ANON_KEY` → `VITE_SUPABASE_ANON_KEY`
- Supabase URL and Anon Key are properly configured in `.env`

### 2. Database Schema
- Created complete Supabase PostgreSQL schema with:
  - `users` table (with roles: admin, bo, partner, partner_commercial)
  - `partners` table
  - `operators` table
  - `sales` table
  - `alerts` table
  - `forms` table
- Implemented Row Level Security (RLS) policies for all tables
- Added indexes for performance optimization
- Created triggers for automatic `updated_at` timestamps

### 3. Frontend Updates
- Installed `@supabase/supabase-js` package
- Created Supabase client configuration (`src/lib/supabase.js`)
- Created authentication service (`src/lib/auth.js`)
- Updated `App.js` to use Supabase authentication
- Updated `Login.js` to use Supabase authentication

## Critical Next Steps

### 1. Create Initial Admin User
Since Supabase Auth manages user creation, you need to create the first admin user through one of these methods:

**Method A: Using Supabase Dashboard (Recommended)**
1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add user" → "Create new user"
3. Email: `admin@mpgrupo.com`
4. Password: `Admin@123` (or your preferred password)
5. Confirm email automatically
6. After creating the auth user, copy the User ID
7. Go to Table Editor → `users` table
8. Insert a new row:
   - `id`: [paste the User ID from step 6]
   - `name`: Administrator
   - `email`: admin@mpgrupo.com
   - `role`: admin
   - `position`: System Administrator
   - `must_change_password`: false

**Method B: Using the Application**
1. Temporarily disable RLS on the users table
2. Use the application's registration flow to create the first admin
3. Re-enable RLS after creation

### 2. Migrate Backend Business Logic

The current codebase has extensive backend logic in `/backend/server.py` that needs to be migrated to either:

**Option A: Supabase Edge Functions** (for server-side processing)
- Commission calculations
- Complex validation logic
- File uploads/downloads
- Excel export functionality
- Dashboard statistics aggregation

**Option B: Client-side JavaScript** (for simpler operations)
- Form validation
- Simple CRUD operations
- UI state management

**Recommended Approach:**
- Start with client-side implementation for basic CRUD operations
- Move complex business logic (commissions, reports) to Edge Functions as needed
- Use Supabase Storage for file uploads

### 3. Update Remaining Pages

The following pages still need to be updated to use Supabase instead of axios:
- `Dashboard.js` - Fetch statistics from Supabase
- `Partners.js` - CRUD operations for partners
- `Sales.js` - CRUD operations for sales
- `Operators.js` - CRUD operations for operators
- `Users.js` - User management
- `Profile.js` - User profile updates
- `Alerts.js` - Alert notifications
- `Forms.js` - Form submissions
- `ChangePassword.js` - Password change flow

### 4. Implement Key Features

Priority features to implement:
1. **Commission Calculation** - Port the commission tier logic from Python to JavaScript/Edge Function
2. **Dashboard Statistics** - Create database views or Edge Functions for aggregated data
3. **File Upload** - Migrate to Supabase Storage
4. **Excel Export** - Create Edge Function or client-side export
5. **Code Generation** - Port partner code and sale code generation logic

### 5. Testing Requirements
- Test authentication flow (login, logout, password change)
- Test RLS policies for each user role
- Test CRUD operations for each entity
- Test commission calculations
- Test file uploads/downloads
- Test dashboard statistics

## Known Limitations

### 1. Backend Architecture Mismatch
- The Python FastAPI backend cannot run in Bolt environment
- All backend logic must be migrated to Edge Functions or client-side

### 2. MongoDB to PostgreSQL
- The data models were designed for MongoDB (document-based)
- Some fields stored as JSONB may need better normalization

### 3. File Storage
- Current file storage in `/uploads` directory needs to migrate to Supabase Storage
- Document URLs need to be updated

### 4. Complex Business Logic
- Commission calculation with tiers is complex and needs careful migration
- Sale code generation logic needs porting
- Partner code generation needs porting

## Development Workflow

1. **Local Testing**: Run `npm start` in the frontend directory
2. **Build**: Run `npm run build` to verify no compilation errors
3. **Database Changes**: Use migrations via Supabase tools
4. **Edge Functions**: Deploy using Supabase CLI or dashboard

## Important Notes

- All passwords must be at least 8 characters with 1 uppercase, 1 digit, 1 special char
- RLS policies are enforced - test with different user roles
- Supabase Auth handles password hashing automatically
- Session management is automatic with Supabase Auth
- File uploads need Supabase Storage configuration

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Auth Guide](https://supabase.com/docs/guides/auth)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase Storage](https://supabase.com/docs/guides/storage)

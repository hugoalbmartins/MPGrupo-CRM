# How to Create the First Admin User

Since the database is now set up with Supabase, you need to create the first admin user to log in.

## Method 1: Using Supabase Dashboard (Recommended)

### Step 1: Create Auth User
1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Users**
3. Click **"Add user"** → **"Create new user"**
4. Enter:
   - **Email**: `admin@mpgrupo.com` (or your preferred admin email)
   - **Password**: Create a strong password (8+ chars, 1 uppercase, 1 digit, 1 special char)
   - **Auto Confirm Email**: ✅ Enable this
5. Click **Create user**
6. **IMPORTANT**: Copy the User ID (UUID) that appears - you'll need it in the next step

### Step 2: Add User Profile
1. Go to **Table Editor** → Select **users** table
2. Click **"Insert"** → **"Insert row"**
3. Fill in:
   - **id**: Paste the User ID you copied from Step 1
   - **name**: `Administrator`
   - **email**: `admin@mpgrupo.com` (same as Step 1)
   - **role**: `admin`
   - **position**: `System Administrator`
   - **must_change_password**: `false`
   - Leave other fields as default
4. Click **Save**

### Step 3: Test Login
1. Go to your application
2. Login with:
   - Email: `admin@mpgrupo.com`
   - Password: [the password you set in Step 1]
3. You should see the admin dashboard with all menu options

---

## Method 2: Using SQL (Advanced)

If you prefer SQL, you can run this in the Supabase SQL Editor:

```sql
-- IMPORTANT: Replace 'YourSecurePassword123!' with your actual password

-- Step 1: Create auth user (this will generate a user_id)
-- This must be done via Supabase Dashboard Authentication → Users
-- because password hashing requires Supabase's internal auth system

-- Step 2: After creating the auth user, get the user_id and run:
INSERT INTO users (
  id,
  name,
  email,
  role,
  position,
  must_change_password
) VALUES (
  'PASTE_USER_ID_HERE'::uuid,
  'Administrator',
  'admin@mpgrupo.com',
  'admin',
  'System Administrator',
  false
);
```

---

## Troubleshooting

### "User not found" error when logging in
- Check that you added a row in the `users` table with the same `id` as the auth user
- Verify the email matches exactly between auth.users and public.users

### "Invalid credentials" error
- Double-check your password
- Try resetting the password in Supabase Dashboard → Authentication → Users

### Can't see any menu items
- Verify the user's `role` is set to `'admin'` (not Admin, ADMIN, or administrator)
- Check browser console for errors

### RLS Policy Errors
- Ensure the user's `id` in the users table matches the auth user's ID
- Try refreshing the page after creating the user

---

## Creating Additional Users

Once you have admin access, you can create additional users through the application:

1. Log in as admin
2. Go to **Utilizadores** (Users) page
3. Click **"+ Novo Utilizador"**
4. Fill in the form and select the appropriate role
5. A strong password will be generated automatically
6. The new user will need to change their password on first login

---

## User Roles Explained

- **admin**: Full system access, can manage all users, partners, operators, and sales
- **bo** (Backoffice): Can manage sales and operators, no access to commissions
- **partner**: Can view their own sales and commissions
- **partner_commercial**: Can view only sales they created, no commission access

---

## Security Notes

- Always use strong passwords (8+ characters, 1 uppercase, 1 digit, 1 special character)
- Row Level Security (RLS) is enabled on all tables
- Session tokens are managed automatically by Supabase
- Passwords are hashed automatically by Supabase Auth

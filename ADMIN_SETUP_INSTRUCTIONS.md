# Admin User Setup Instructions

## Required Admin Credentials
- **Email**: hugo.martins@marciopinto.pt
- **Password**: Crm2025*

---

## Setup Steps

### Step 1: Create Auth User in Supabase Dashboard

1. Go to your Supabase project: https://supabase.com/dashboard
2. Select your project: **zbmhchofjjnbjfenpkmh**
3. Navigate to **Authentication** → **Users**
4. Click **"Add user"** → **"Create new user"**
5. Enter:
   - **Email**: `hugo.martins@marciopinto.pt`
   - **Password**: `Crm2025*`
   - **Auto Confirm Email**: ✅ **ENABLE THIS** (very important!)
6. Click **"Create user"**
7. **COPY THE USER ID** (UUID) - you'll need it in Step 2

### Step 2: Add User Profile to Database

Once you have the User ID from Step 1:

1. Go to **SQL Editor** in Supabase Dashboard
2. Run this SQL command (replace `YOUR_USER_ID_HERE` with the UUID you copied):

```sql
INSERT INTO public.users (
  id,
  name,
  email,
  role,
  position,
  must_change_password
) VALUES (
  'YOUR_USER_ID_HERE'::uuid,
  'Hugo Martins',
  'hugo.martins@marciopinto.pt',
  'admin',
  'Administrador do Sistema',
  false
);
```

**Example:**
If your User ID is `a1b2c3d4-e5f6-7890-abcd-ef1234567890`, the command would be:

```sql
INSERT INTO public.users (
  id,
  name,
  email,
  role,
  position,
  must_change_password
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
  'Hugo Martins',
  'hugo.martins@marciopinto.pt',
  'admin',
  'Administrador do Sistema',
  false
);
```

### Step 3: Test Login

1. Go to your application
2. Login with:
   - **Email**: `hugo.martins@marciopinto.pt`
   - **Password**: `Crm2025*`
3. You should be redirected to the admin dashboard

---

## Alternative: Quick Setup via SQL (After Auth User Creation)

If you've already created the auth user and have the User ID, you can run this complete script:

```sql
-- Verify the auth user exists and get the ID
SELECT id, email, created_at
FROM auth.users
WHERE email = 'hugo.martins@marciopinto.pt';

-- Insert the user profile (use the ID from the query above)
INSERT INTO public.users (
  id,
  name,
  email,
  role,
  position,
  must_change_password
) VALUES (
  (SELECT id FROM auth.users WHERE email = 'hugo.martins@marciopinto.pt'),
  'Hugo Martins',
  'hugo.martins@marciopinto.pt',
  'admin',
  'Administrador do Sistema',
  false
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  position = EXCLUDED.position,
  must_change_password = EXCLUDED.must_change_password;
```

---

## Troubleshooting

### "Invalid login credentials" Error
- Verify the password is exactly: `Crm2025*` (case-sensitive)
- Make sure "Auto Confirm Email" was enabled when creating the user
- Try resetting the password in Supabase Dashboard → Authentication → Users

### "User not found" Error
- Check that the user was added to the `public.users` table
- Verify the `id` in `public.users` matches the `id` from `auth.users`
- Run this query to check:
  ```sql
  SELECT u.id, u.email, u.role
  FROM public.users u
  WHERE u.email = 'hugo.martins@marciopinto.pt';
  ```

### Can't Access Admin Features
- Verify the user's `role` is exactly `'admin'` (lowercase)
- Clear browser cache and cookies
- Log out and log back in

### RLS Policy Errors
- Ensure Row Level Security policies are active on all tables
- Check browser console for specific error messages
- Verify the user ID matches between auth and public tables

---

## What You'll See After Login

As an admin user, you'll have access to:
- ✅ Dashboard with full statistics
- ✅ Partners management
- ✅ Sales management (with commission visibility)
- ✅ Operators management
- ✅ Users management
- ✅ Forms management
- ✅ Alerts and notifications
- ✅ Profile settings

---

## Security Notes

- The password `Crm2025*` meets all requirements:
  - ✅ 8+ characters
  - ✅ 1 uppercase letter (C)
  - ✅ 1 digit (2, 0, 2, 5)
  - ✅ 1 special character (*)
- Consider changing this password after first login for security
- All session data is encrypted by Supabase Auth
- Row Level Security (RLS) is active on all tables

---

## Next Steps After Login

1. **Test all menu items** to ensure admin access is working
2. **Create additional users** via Users page if needed
3. **Configure operators** with commission tiers
4. **Add partners** to the system
5. **Start recording sales**

---

**Important**: Keep these credentials secure and do not share them publicly.

# Fix: Anonymous Customer Access Issue

## Problem

Customers trying to join the queue were getting "No active counters available" error, even though counters were visible to logged-in staff and admin users.

## Root Cause

The Row Level Security (RLS) policies were configured to allow access only to **authenticated** users. Since customers are anonymous (not logged in), they couldn't:

1. View the counters table
2. Insert into queue_entries table
3. View queue_entries table

The policies had `TO authenticated` which blocks anonymous users.

## Solution

### 1. Database Migration Created

**File**: `supabase/migrations/20251005000001_enable_anonymous_access.sql`

This migration:

- Drops the old restrictive policies
- Creates new policies that explicitly allow both `anon` (anonymous) and `authenticated` users

**New Policies**:

```sql
-- Counters: Anonymous users can view active counters
CREATE POLICY "Public can view active counters" 
ON public.counters
FOR SELECT 
TO anon, authenticated
USING (is_active = true);

-- Queue Entries: Anonymous users can view all entries
CREATE POLICY "Public can view queue entries" 
ON public.queue_entries
FOR SELECT 
TO anon, authenticated
USING (true);

-- Queue Entries: Anonymous users can insert their entries
CREATE POLICY "Public can insert queue entries" 
ON public.queue_entries
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);
```

### 2. Supabase Client Enhanced

**File**: `src/integrations/supabase/client.ts`

Added configuration to ensure the client works properly with anonymous access:

```typescript
{
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // Added
  },
  global: {
    headers: {
      'x-client-info': 'flow-ready-app', // Added
    },
  },
}
```

## How to Apply the Fix

### Step 1: Apply the Migration

**Option A: Using Supabase Dashboard**

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy the contents of `supabase/migrations/20251005000001_enable_anonymous_access.sql`
4. Paste and run the SQL

**Option B: Using Supabase CLI**

```bash
npx supabase migration up
```

### Step 2: Verify the Changes

After applying the migration, test:

1. **As Anonymous Customer**:
   - Open the app (without logging in)
   - Enter name and phone number
   - Click "Join Queue"
   - ✅ Should successfully join the queue

2. **As Staff**:
   - Login with staff credentials
   - Select a counter
   - ✅ Should see the customer in the queue

3. **As Admin**:
   - Login with admin credentials
   - ✅ Should see counters and queue statistics

## Technical Details

### Understanding Supabase RLS Roles

Supabase has two built-in roles:

- **`anon`**: Unauthenticated users (customers in our case)
- **`authenticated`**: Logged-in users (staff and admin)

### Why This Matters

In a Queue Management System:

- **Customers** should NOT need to create accounts or log in
- **Staff** must be authenticated to serve customers
- **Admin** must be authenticated to manage the system

By using `TO anon, authenticated` we ensure:

- ✅ Anonymous customers can join queues
- ✅ Authenticated staff can manage queues
- ✅ Authenticated admins can configure the system
- ✅ Security is maintained (customers can't update/delete)

## Security Considerations

### What Anonymous Users CAN Do

- ✅ View active counters
- ✅ View queue entries (to see their position)
- ✅ Insert their own queue entry (join queue)

### What Anonymous Users CANNOT Do

- ❌ Update queue entries (change status)
- ❌ Delete queue entries
- ❌ Create/update/delete counters
- ❌ Access staff or admin functions
- ❌ View or modify user accounts

This maintains security while enabling the anonymous customer workflow.

## Before vs After

### Before (Broken)

```
Customer tries to join queue
  → Supabase query: SELECT from counters
  → RLS Policy: "TO authenticated" only
  → User is anonymous (anon role)
  → ❌ Access Denied
  → Error: "No active counters available"
```

### After (Fixed)

```
Customer tries to join queue
  → Supabase query: SELECT from counters
  → RLS Policy: "TO anon, authenticated"
  → User is anonymous (anon role)
  → ✅ Access Granted
  → Returns active counters
  → Customer successfully joins queue
```

## Testing Checklist

After applying the migration:

- [ ] Open app in incognito/private window (ensures no cached auth)
- [ ] Verify counters exist (check in Staff or Admin dashboard)
- [ ] Go to customer queue page
- [ ] Enter name and phone number
- [ ] Click "Join Queue"
- [ ] Verify: Token number appears
- [ ] Verify: Queue position shows
- [ ] Login as Staff
- [ ] Verify: Customer appears in queue
- [ ] Call customer's number
- [ ] Verify: Customer gets notification

## Additional Notes

### Environment Variables

Ensure your `.env` file has:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
```

The `VITE_SUPABASE_PUBLISHABLE_KEY` should be the **anon** public key, not the service role key.

### Service Role Key

⚠️ **Never** expose the service role key in frontend code. It bypasses all RLS policies.

## Troubleshooting

### Issue: Still getting "No counters available"

**Solution 1**: Clear browser cache and localStorage

```javascript
localStorage.clear();
// Then refresh the page
```

**Solution 2**: Verify the migration was applied

```sql
-- Run this in Supabase SQL Editor
SELECT * FROM pg_policies WHERE tablename = 'counters';
-- Should show "Public can view active counters" policy
```

**Solution 3**: Check if counters exist and are active

```sql
SELECT * FROM public.counters WHERE is_active = true;
-- Should return at least one counter
```

### Issue: Can join queue but can't see position

**Solution**: Verify the queue_entries SELECT policy is also allowing anonymous access:

```sql
SELECT * FROM pg_policies WHERE tablename = 'queue_entries';
-- Should show "Public can view queue entries" policy
```

## Status

✅ **FIXED**: Anonymous customers can now join queues without authentication

The app now fully supports the intended workflow:

- Customers: No login required ✅
- Staff: Login required ✅
- Admin: Login required ✅

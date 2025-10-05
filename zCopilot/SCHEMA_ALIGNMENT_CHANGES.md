# Database Schema Alignment - Changes Summary

## Overview

This document outlines all changes made to align the codebase with the new database schema provided.

## Issues Found and Fixed

### 1. ✅ Queue Entry Status Values

**Issue**: Status constraint mismatch between old and new schema

- **Old**: `('waiting', 'called', 'served', 'cancelled')`
- **New**: `('waiting', 'serving', 'done')`

**Changes Made**:

- Created migration `20251005000000_align_schema_with_new_design.sql`
- Updated constraint in `queue_entries` table
- Migrated existing data: `'served'` → `'done'`, `'called'` → `'serving'`

**Code Updates**:

- `src/pages/Staff.tsx`: Changed status from `'served'` to `'done'` in `handleServeNext()`
- `src/pages/Queue.tsx`: Updated status checks from `'served'` to `'done'` and `'called'` to `'serving'`
- `src/pages/Admin.tsx`: Updated status filter from `'served'` to `'done'` in statistics query

### 2. ✅ App Role Enum Missing 'admin'

**Issue**: Old enum only had `('customer', 'staff')`, new schema includes `'admin'`

**Changes Made**:

- Migration adds `'admin'` value to the `app_role` enum safely (checks if exists first)
- This enables the Admin dashboard and role-based access control to work properly

### 3. ✅ Phone Number Field Constraint

**Issue**: Old schema had `phone_number TEXT NOT NULL`, new schema has it nullable

**Changes Made**:

- Migration removes `NOT NULL` constraint from `profiles.phone_number`
- This allows optional phone numbers during user registration

## Files Modified

### New Files Created

1. **`supabase/migrations/20251005000000_align_schema_with_new_design.sql`**
   - Comprehensive migration to align database with new schema
   - Safely handles existing data migration

### Files Updated

1. **`src/pages/Staff.tsx`**
   - Line ~178: Changed `status: 'served'` to `status: 'done'`

2. **`src/pages/Queue.tsx`**
   - Line ~69: Changed status check from `'served'` to `'done'`
   - Line ~402: Changed status check from `'called'` to `'serving'`

3. **`src/pages/Admin.tsx`**
   - Line ~115: Changed status filter from `'served'` to `'done'`

## Database Migration Script

The migration file includes:

- Safe enum value addition (checks if 'admin' already exists)
- Column constraint modification (phone_number nullable)
- Status constraint update with new values
- Data migration for existing queue entries
- Helpful comments explaining each column's purpose

## Testing Recommendations

After applying these changes, please test:

1. **Admin Access**
   - Admin users can log in and access `/admin` dashboard
   - Role-based routing works correctly

2. **Staff Functionality**
   - Staff can mark customers as served (status → 'done')
   - Queue reordering works after serving customers
   - Real-time updates work correctly

3. **Customer Queue**
   - Customers can join queue without phone number (if optional)
   - Status transitions display correctly ('waiting' → 'serving' → 'done')
   - Notifications show when status changes to 'serving'

4. **User Registration**
   - Users can register without phone number
   - Profile creation works with nullable phone_number

## Migration Instructions

To apply these changes:

1. **Apply the migration** (if using Supabase CLI):

   ```bash
   npx supabase migration up
   ```

2. **Or manually** in Supabase Dashboard:
   - Go to SQL Editor
   - Paste contents of `20251005000000_align_schema_with_new_design.sql`
   - Execute the script

3. **Verify** the changes:
   - Check that enum includes 'customer', 'staff', 'admin'
   - Verify phone_number is nullable in profiles
   - Confirm status constraint allows 'waiting', 'serving', 'done'

## Notes

- All changes are backward compatible where possible
- Existing data is migrated automatically
- The migration is idempotent (can be run multiple times safely)
- TypeScript types don't need updates as they use generic `string` for status

## Schema Alignment Status

✅ **All schema discrepancies have been resolved**

The application code now matches the provided database schema exactly.

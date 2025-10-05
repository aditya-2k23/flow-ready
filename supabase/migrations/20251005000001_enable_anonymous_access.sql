-- ================================
-- Migration to enable anonymous customer access
-- ================================
-- This migration allows unauthenticated users (customers) to:
-- 1. View active counters
-- 2. View queue entries
-- 3. Insert their own queue entries

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Anyone can view counters" ON public.counters;
DROP POLICY IF EXISTS "Anyone can view queue entries" ON public.queue_entries;
DROP POLICY IF EXISTS "Anyone can insert queue entries" ON public.queue_entries;

-- Create new policies that allow anonymous (unauthenticated) access

-- Allow EVERYONE (including anonymous users) to view active counters
CREATE POLICY "Public can view active counters" 
ON public.counters
FOR SELECT 
TO anon, authenticated
USING (is_active = true);

-- Allow EVERYONE (including anonymous users) to view queue entries
CREATE POLICY "Public can view queue entries" 
ON public.queue_entries
FOR SELECT 
TO anon, authenticated
USING (true);

-- Allow EVERYONE (including anonymous users) to insert queue entries
CREATE POLICY "Public can insert queue entries" 
ON public.queue_entries
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

-- Note: Staff and Admin policies remain unchanged as they require authentication

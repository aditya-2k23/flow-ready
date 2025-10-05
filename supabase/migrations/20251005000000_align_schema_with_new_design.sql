-- ================================
-- Migration to align schema with new design
-- ================================

-- 1. Add 'admin' to app_role enum if not exists
DO $$ 
BEGIN
    -- Check if 'admin' already exists in the enum
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'app_role' AND e.enumlabel = 'admin'
    ) THEN
        ALTER TYPE public.app_role ADD VALUE 'admin';
    END IF;
END $$;

-- 2. Make phone_number nullable in profiles table
ALTER TABLE public.profiles ALTER COLUMN phone_number DROP NOT NULL;

-- 3. Update queue_entries status constraint
-- First, drop the old constraint
ALTER TABLE public.queue_entries DROP CONSTRAINT IF EXISTS queue_entries_status_check;

-- Add new constraint with updated status values
ALTER TABLE public.queue_entries ADD CONSTRAINT valid_status 
    CHECK (status IN ('waiting', 'serving', 'done'));

-- 4. Update any existing 'served' status to 'done'
UPDATE public.queue_entries SET status = 'done' WHERE status = 'served';

-- 5. Update any existing 'called' status to 'serving'
UPDATE public.queue_entries SET status = 'serving' WHERE status = 'called';

-- 6. Update any existing 'cancelled' status to 'done' (or you can keep them as is)
-- Uncomment if you want to migrate cancelled entries
-- UPDATE public.queue_entries SET status = 'done' WHERE status = 'cancelled';

COMMENT ON COLUMN public.queue_entries.status IS 'Queue entry status: waiting (in queue), serving (being served), done (completed)';
COMMENT ON COLUMN public.queue_entries.called_at IS 'Timestamp when customer was called to counter (status changed to serving)';
COMMENT ON COLUMN public.queue_entries.served_at IS 'Timestamp when service was completed (status changed to done)';

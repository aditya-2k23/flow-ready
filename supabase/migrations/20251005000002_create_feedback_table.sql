-- ================================
-- Create feedback table for customer feedback
-- ================================

CREATE TABLE public.feedback (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_entry_id uuid NOT NULL REFERENCES public.queue_entries(id) ON DELETE CASCADE,
    rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comments text,
    customer_name text,
    customer_phone text,
    counter_id uuid REFERENCES public.counters(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on feedback
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Create indexes for better query performance
CREATE INDEX idx_feedback_queue_entry ON public.feedback (queue_entry_id);
CREATE INDEX idx_feedback_counter ON public.feedback (counter_id);
CREATE INDEX idx_feedback_rating ON public.feedback (rating);
CREATE INDEX idx_feedback_created_at ON public.feedback (created_at);

-- Add updated_at trigger
CREATE TRIGGER update_feedback_updated_at 
    BEFORE UPDATE ON public.feedback
    FOR EACH ROW 
    EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies for feedback table

-- Allow anonymous users to insert feedback (customers don't need to be logged in)
CREATE POLICY "Public can insert feedback" 
ON public.feedback
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

-- Allow staff and admin to view all feedback
CREATE POLICY "Staff can view all feedback" 
ON public.feedback
FOR SELECT 
TO authenticated
USING (
    public.has_role(auth.uid(), 'staff'::public.app_role) 
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Allow admin to delete feedback
CREATE POLICY "Admin can delete feedback" 
ON public.feedback
FOR DELETE 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Add helpful comments
COMMENT ON TABLE public.feedback IS 'Customer feedback after service completion';
COMMENT ON COLUMN public.feedback.rating IS 'Customer satisfaction rating from 1 (poor) to 5 (excellent)';
COMMENT ON COLUMN public.feedback.comments IS 'Optional customer comments about their experience';
COMMENT ON COLUMN public.feedback.customer_name IS 'Name of the customer who provided feedback';
COMMENT ON COLUMN public.feedback.customer_phone IS 'Phone number of the customer (for follow-up if needed)';

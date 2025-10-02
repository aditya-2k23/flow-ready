-- Create function to reorder queue positions after serving a customer
CREATE OR REPLACE FUNCTION public.reorder_queue_positions(p_counter_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Reorder positions for waiting entries at the specified counter
  WITH ordered_entries AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY position_in_queue) as new_position
    FROM public.queue_entries
    WHERE counter_id = p_counter_id
    AND status = 'waiting'
  )
  UPDATE public.queue_entries qe
  SET 
    position_in_queue = oe.new_position,
    estimated_wait_minutes = oe.new_position * 2
  FROM ordered_entries oe
  WHERE qe.id = oe.id;
END;
$$;
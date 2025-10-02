-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('customer', 'staff');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  email TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'customer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create counters table
CREATE TABLE public.counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  counter_number INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  current_staff_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on counters
ALTER TABLE public.counters ENABLE ROW LEVEL SECURITY;

-- Counters policies - everyone can view active counters
CREATE POLICY "Anyone can view active counters"
  ON public.counters FOR SELECT
  USING (true);

CREATE POLICY "Staff can update counters"
  ON public.counters FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'staff'
  ));

-- Create queue_entries table
CREATE TABLE public.queue_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_number INTEGER NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  counter_id UUID NOT NULL REFERENCES public.counters(id) ON DELETE CASCADE,
  position_in_queue INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'called', 'served', 'cancelled')),
  estimated_wait_minutes INTEGER,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  called_at TIMESTAMPTZ,
  served_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on queue_entries
ALTER TABLE public.queue_entries ENABLE ROW LEVEL SECURITY;

-- Queue entries policies
CREATE POLICY "Users can view own queue entries"
  ON public.queue_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Staff can view all queue entries"
  ON public.queue_entries FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'staff'
  ));

CREATE POLICY "Users can insert own queue entries"
  ON public.queue_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Staff can update queue entries"
  ON public.queue_entries FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'staff'
  ));

-- Create function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone_number, email, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.raw_user_meta_data->>'phone_number', ''),
    new.email,
    COALESCE((new.raw_user_meta_data->>'role')::app_role, 'customer')
  );
  RETURN new;
END;
$$;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_counters_updated_at
  BEFORE UPDATE ON public.counters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_queue_entries_updated_at
  BEFORE UPDATE ON public.queue_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for queue_entries
ALTER PUBLICATION supabase_realtime ADD TABLE public.queue_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.counters;

-- Insert some initial counters
INSERT INTO public.counters (counter_number, name, is_active) VALUES
  (1, 'Counter 1', true),
  (2, 'Counter 2', true),
  (3, 'Counter 3', true);
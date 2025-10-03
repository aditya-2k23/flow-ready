-- Create user_roles table for proper role management
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Make user_id nullable in queue_entries for anonymous users
ALTER TABLE public.queue_entries ALTER COLUMN user_id DROP NOT NULL;

-- Drop old RLS policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Staff can view all queue entries" ON public.queue_entries;
DROP POLICY IF EXISTS "Staff can update queue entries" ON public.queue_entries;
DROP POLICY IF EXISTS "Users can view own queue entries" ON public.queue_entries;
DROP POLICY IF EXISTS "Users can insert own queue entries" ON public.queue_entries;
DROP POLICY IF EXISTS "Anyone can view active counters" ON public.counters;
DROP POLICY IF EXISTS "Staff can update counters" ON public.counters;

-- New RLS policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- New RLS policies for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- New RLS policies for queue_entries (allow anonymous)
CREATE POLICY "Anyone can insert queue entries" ON public.queue_entries
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view queue entries" ON public.queue_entries
  FOR SELECT USING (true);

CREATE POLICY "Staff can update queue entries" ON public.queue_entries
  FOR UPDATE USING (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete queue entries" ON public.queue_entries
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- New RLS policies for counters
CREATE POLICY "Anyone can view counters" ON public.counters
  FOR SELECT USING (true);

CREATE POLICY "Staff can update counters" ON public.counters
  FOR UPDATE USING (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert counters" ON public.counters
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete counters" ON public.counters
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Update handle_new_user to assign role to user_roles table
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, full_name, phone_number, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone_number', ''),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'customer')
  );
  
  -- Insert role into user_roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'customer')
  );
  
  RETURN NEW;
END;
$$;
-- Backfill user_roles from existing profiles
INSERT INTO public.user_roles (user_id, role)
SELECT id, role
FROM public.profiles
WHERE role IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Update your specific account to admin
UPDATE public.profiles
SET role = 'admin'
WHERE id = 'cc1c7735-fbab-40a8-9394-39a492daff78';

-- Ensure admin role exists in user_roles
INSERT INTO public.user_roles (user_id, role)
VALUES ('cc1c7735-fbab-40a8-9394-39a492daff78', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
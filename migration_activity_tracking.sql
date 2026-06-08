-- Add columns to public.clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS assigned_telecaller uuid REFERENCES public.users(user_id) ON DELETE SET NULL;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS team text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS priority text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Relax status check constraint
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_status_check;

-- Create customer_activities table
CREATE TABLE IF NOT EXISTS public.customer_activities (
  activity_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES public.clients(client_id) ON DELETE SET NULL,
  client_name text,
  client_mobile text,
  created_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  activity_type text NOT NULL,
  call_result text,
  outcome text,
  notes text,
  callback_time timestamptz,
  status text NOT NULL DEFAULT 'RECORDED',
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS for customer_activities
ALTER TABLE public.customer_activities ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Activities select policy" ON public.customer_activities;
DROP POLICY IF EXISTS "Activities modify policy" ON public.customer_activities;

-- Create select policy
CREATE POLICY "Activities select policy" ON public.customer_activities
  FOR SELECT USING (
    (client_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.client_id = customer_activities.client_id
      AND c.agency_id = public.get_my_agency_id()
    ))
    OR
    (client_id IS NULL AND created_by IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = customer_activities.created_by
      AND u.agency_id = public.get_my_agency_id()
    ))
  );

-- Create modify policy
CREATE POLICY "Activities modify policy" ON public.customer_activities
  FOR ALL USING (
    (client_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.client_id = customer_activities.client_id
      AND c.agency_id = public.get_my_agency_id()
    ))
    OR
    (client_id IS NULL AND created_by IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = customer_activities.created_by
      AND u.agency_id = public.get_my_agency_id()
    ))
  );

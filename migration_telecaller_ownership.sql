-- ============================================================
-- STAR CREDIT MANAGEMENT - TELECALLER OWNERSHIP MIGRATION
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Add Telecaller Tracking Columns to public.clients Table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS current_stage text DEFAULT 'New Lead';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS progress_percentage integer DEFAULT 15;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS last_follow_up_date timestamptz;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS next_follow_up_date timestamptz;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS last_visit_date timestamptz;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS total_collections numeric(20,2) DEFAULT 0.00;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS stage_updated_at timestamptz DEFAULT now();

-- Ensure assigned_telecaller is foreign keyed (it was added in a previous migration, but check/add constraint for safety)
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_assigned_telecaller_fkey;
ALTER TABLE public.clients ADD CONSTRAINT clients_assigned_telecaller_fkey FOREIGN KEY (assigned_telecaller) REFERENCES public.users(user_id) ON DELETE SET NULL;

-- 2. Migrate Existing Records: Map assigned_manager cases to assigned_telecaller
UPDATE public.clients 
SET assigned_telecaller = assigned_manager
WHERE assigned_telecaller IS NULL AND assigned_manager IS NOT NULL;

-- 3. Drop assigned_manager Column
ALTER TABLE public.clients DROP COLUMN IF EXISTS assigned_manager CASCADE;

-- 4. Re-create Clients RLS Policies without assigned_manager

-- Drop existing clients policies
DROP POLICY IF EXISTS "Clients select policy" ON public.clients;
DROP POLICY IF EXISTS "Clients update policy" ON public.clients;

-- Clients Select: Owners & Managers see all; Workers, Telecallers, and Clients see their assigned cases
CREATE POLICY "Clients select policy" ON public.clients
  FOR SELECT USING (
    agency_id = public.get_my_agency_id() AND (
      public.get_my_role() IN ('owner', 'manager') OR
      (public.get_my_role() = 'worker' AND assigned_worker = auth.uid()) OR
      (public.get_my_role() = 'telecaller' AND assigned_telecaller = auth.uid()) OR
      (public.get_my_role() = 'client' AND client_id = auth.uid()) OR
      (public.get_my_role() = 'client_manager' AND client_manager_id = auth.uid())
    )
  );

-- Clients Update: Owners, Managers, Workers, and Telecallers can update their assigned cases
CREATE POLICY "Clients update policy" ON public.clients
  FOR UPDATE USING (
    agency_id = public.get_my_agency_id() AND (
      public.get_my_role() IN ('owner', 'manager') OR
      (public.get_my_role() = 'worker' AND assigned_worker = auth.uid()) OR
      (public.get_my_role() = 'telecaller' AND assigned_telecaller = auth.uid())
    )
  );

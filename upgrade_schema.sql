-- ============================================================
-- STAR CREDIT MANAGEMENT - CLIENT MANAGER PORTAL UPGRADE SCRIPT
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Update users Table Role Check Constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('owner', 'manager', 'worker', 'client', 'telecaller', 'client_manager'));

-- 2. Add client_manager_id to public.clients Table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS client_manager_id uuid REFERENCES public.users(user_id) ON DELETE SET NULL;

-- 3. Clients Policies
DROP POLICY IF EXISTS "Clients select policy" ON public.clients;
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

-- 4. Sensitive Details Policies
DROP POLICY IF EXISTS "Sensitive details select policy" ON public.client_sensitive_details;
CREATE POLICY "Sensitive details select policy" ON public.client_sensitive_details
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.client_id = client_sensitive_details.client_id
        AND c.agency_id = public.get_my_agency_id()
        AND (
          public.get_my_role() IN ('owner', 'manager') OR
          c.client_id = auth.uid() OR
          c.client_manager_id = auth.uid()
        )
    )
  );

-- 5. Disputes Policies
DROP POLICY IF EXISTS "Disputes select policy" ON public.disputes;
CREATE POLICY "Disputes select policy" ON public.disputes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.client_id = disputes.client_id
        AND c.agency_id = public.get_my_agency_id()
        AND (
          public.get_my_role() IN ('owner', 'manager') OR
          (public.get_my_role() = 'worker' AND c.assigned_worker = auth.uid()) OR
          (public.get_my_role() = 'telecaller' AND c.assigned_telecaller = auth.uid()) OR
          (public.get_my_role() = 'client' AND c.client_id = auth.uid()) OR
          (public.get_my_role() = 'client_manager' AND c.client_manager_id = auth.uid())
        )
    )
  );

-- 6. Tasks Policies
DROP POLICY IF EXISTS "Tasks select policy" ON public.tasks;
CREATE POLICY "Tasks select policy" ON public.tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.client_id = tasks.client_id
        AND c.agency_id = public.get_my_agency_id()
    ) AND (
      public.get_my_role() IN ('owner', 'manager') OR
      assigned_user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.client_id = tasks.client_id
          AND c.client_manager_id = auth.uid()
      )
    )
  );

-- 7. Activities Policies
DROP POLICY IF EXISTS "Activities select policy" ON public.customer_activities;
CREATE POLICY "Activities select policy" ON public.customer_activities
  FOR SELECT USING (
    (client_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.client_id = customer_activities.client_id
      AND c.agency_id = public.get_my_agency_id()
      AND (
        public.get_my_role() IN ('owner', 'manager', 'telecaller', 'worker') OR
        (public.get_my_role() = 'client' AND c.client_id = auth.uid()) OR
        (public.get_my_role() = 'client_manager' AND c.client_manager_id = auth.uid())
      )
    ))
    OR
    (client_id IS NULL AND created_by IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = customer_activities.created_by
      AND u.agency_id = public.get_my_agency_id()
      AND public.get_my_role() IN ('owner', 'manager', 'telecaller', 'worker')
    ))
  );

-- 8. Customer Visits Policies
DROP POLICY IF EXISTS "Visits select policy" ON public.customer_visits;
CREATE POLICY "Visits select policy" ON public.customer_visits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.client_id = customer_visits.client_id
        AND c.agency_id = public.get_my_agency_id()
        AND (
          public.get_my_role() IN ('owner', 'manager', 'worker') OR
          (public.get_my_role() = 'client_manager' AND c.client_manager_id = auth.uid())
        )
    )
  );

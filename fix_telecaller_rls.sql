-- ============================================================
-- STAR CREDIT MANAGEMENT - TELECALLER RLS & ROLE FIX SCRIPT
-- Run this in your Supabase SQL Editor to enable telecaller support
-- ============================================================

-- 1. Redefine get_my_role to be case-insensitive by using lower()
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
  SELECT lower(role) FROM public.users WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. Clients Select Policy
DROP POLICY IF EXISTS "Clients select policy" ON public.clients;
CREATE POLICY "Clients select policy" ON public.clients
  FOR SELECT USING (
    agency_id = public.get_my_agency_id() AND (
      public.get_my_role() IN ('owner', 'manager') OR
      (public.get_my_role() = 'worker' AND assigned_worker = auth.uid()) OR
      (public.get_my_role() = 'telecaller' AND assigned_telecaller = auth.uid()) OR
      (public.get_my_role() = 'client' AND client_id = auth.uid())
    )
  );

-- 3. Clients Update Policy
DROP POLICY IF EXISTS "Clients update policy" ON public.clients;
CREATE POLICY "Clients update policy" ON public.clients
  FOR UPDATE USING (
    agency_id = public.get_my_agency_id() AND (
      public.get_my_role() IN ('owner', 'manager') OR
      (public.get_my_role() = 'worker' AND assigned_worker = auth.uid()) OR
      (public.get_my_role() = 'telecaller' AND assigned_telecaller = auth.uid())
    )
  );

-- 4. Disputes Select Policy
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
          (public.get_my_role() = 'client' AND c.client_id = auth.uid())
        )
    )
  );

-- 5. Disputes Modify Policy
DROP POLICY IF EXISTS "Disputes modify policy" ON public.disputes;
CREATE POLICY "Disputes modify policy" ON public.disputes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.client_id = disputes.client_id
        AND c.agency_id = public.get_my_agency_id()
        AND (
          public.get_my_role() IN ('owner', 'manager') OR
          (public.get_my_role() = 'worker' AND c.assigned_worker = auth.uid()) OR
          (public.get_my_role() = 'telecaller' AND c.assigned_telecaller = auth.uid())
        )
    )
  );

-- 6. Tasks Select Policy
DROP POLICY IF EXISTS "Tasks select policy" ON public.tasks;
CREATE POLICY "Tasks select policy" ON public.tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.client_id = tasks.client_id
        AND c.agency_id = public.get_my_agency_id()
        AND (
          public.get_my_role() IN ('owner', 'manager', 'worker', 'telecaller') OR
          (public.get_my_role() = 'client' AND c.client_id = auth.uid())
        )
    )
  );

-- 7. Tasks Modify Policy
DROP POLICY IF EXISTS "Tasks modify policy" ON public.tasks;
CREATE POLICY "Tasks modify policy" ON public.tasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.client_id = tasks.client_id
        AND c.agency_id = public.get_my_agency_id()
        AND (
          public.get_my_role() IN ('owner', 'manager', 'worker', 'telecaller')
        )
    )
  );

-- ============================================================
-- 8. Customer Activities - Select Policy
-- Telecallers can see activities they created OR activities on their assigned clients
-- ============================================================
DROP POLICY IF EXISTS "Activities select policy" ON public.customer_activities;
CREATE POLICY "Activities select policy" ON public.customer_activities
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.client_id = customer_activities.client_id
        AND c.agency_id = public.get_my_agency_id()
        AND (
          public.get_my_role() IN ('owner', 'manager') OR
          (public.get_my_role() = 'worker'      AND c.assigned_worker     = auth.uid()) OR
          (public.get_my_role() = 'telecaller'  AND c.assigned_telecaller = auth.uid())
        )
    )
    OR customer_activities.created_by  = auth.uid()
  );

-- 9. Customer Activities - Insert Policy
DROP POLICY IF EXISTS "Activities insert policy" ON public.customer_activities;
CREATE POLICY "Activities insert policy" ON public.customer_activities
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.client_id = customer_activities.client_id
        AND c.agency_id = public.get_my_agency_id()
        AND (
          public.get_my_role() IN ('owner', 'manager') OR
          (public.get_my_role() = 'worker'     AND c.assigned_worker    = auth.uid()) OR
          (public.get_my_role() = 'telecaller' AND c.assigned_telecaller = auth.uid())
        )
    )
  );

-- 10. Customer Activities - Update Policy
DROP POLICY IF EXISTS "Activities update policy" ON public.customer_activities;
CREATE POLICY "Activities update policy" ON public.customer_activities
  FOR UPDATE USING (
    public.get_my_role() IN ('owner', 'manager') OR
    created_by = auth.uid()
  );

-- 11. Users select policy - all roles in same agency can read user list
DROP POLICY IF EXISTS "Users select policy" ON public.users;
CREATE POLICY "Users select policy" ON public.users
  FOR SELECT USING (
    agency_id = public.get_my_agency_id()
  );

-- 12. Employees select policy
DROP POLICY IF EXISTS "Employees select policy" ON public.employees;
CREATE POLICY "Employees select policy" ON public.employees
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = employees.user_id
        AND u.agency_id = public.get_my_agency_id()
    )
  );

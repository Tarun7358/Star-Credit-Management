-- 1. Clients Select Policy
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

-- 2. Clients Update Policy
DROP POLICY IF EXISTS "Clients update policy" ON public.clients;
CREATE POLICY "Clients update policy" ON public.clients
  FOR UPDATE USING (
    agency_id = public.get_my_agency_id() AND (
      public.get_my_role() IN ('owner', 'manager') OR
      (public.get_my_role() = 'worker' AND assigned_worker = auth.uid()) OR
      (public.get_my_role() = 'telecaller' AND assigned_telecaller = auth.uid())
    )
  );

-- 3. Disputes Select Policy
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

-- 4. Disputes Modify Policy
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

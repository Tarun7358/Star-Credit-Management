-- ============================================================
-- STAR CREDIT MANAGEMENT - CRM MIGRATION SCRIPT
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Update users Table Role Check Constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('owner', 'manager', 'worker', 'client', 'telecaller'));

-- 2. Create clients Table
CREATE TABLE IF NOT EXISTS public.clients (
  client_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id uuid REFERENCES public.agencies(agency_id) ON DELETE CASCADE NOT NULL,
  customer_name text NOT NULL,
  mobile text NOT NULL,
  alternate_mobile text,
  address text NOT NULL,
  dob date,
  assigned_worker uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  assigned_manager uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'NEW_LEAD' CHECK (status IN (
    'NEW_LEAD', 'VERIFICATION', 'DOCUMENT_COLLECTION', 'CREDIT_ANALYSIS',
    'DISPUTE_CREATION', 'BUREAU_SUBMISSION', 'REVIEW', 'FOLLOW_UP', 'COMPLETED'
  )),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS for clients
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- 3. Create client_sensitive_details Table
CREATE TABLE IF NOT EXISTS public.client_sensitive_details (
  client_id uuid REFERENCES public.clients(client_id) ON DELETE CASCADE PRIMARY KEY,
  ssn text,
  credit_score integer,
  financial_records text,
  private_notes text,
  admin_comments text,
  payment_info text,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS for client_sensitive_details
ALTER TABLE public.client_sensitive_details ENABLE ROW LEVEL SECURITY;

-- 4. Create disputes Table
CREATE TABLE IF NOT EXISTS public.disputes (
  dispute_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES public.clients(client_id) ON DELETE CASCADE NOT NULL,
  bureau text NOT NULL CHECK (bureau IN ('EQUIFAX', 'EXPERIAN', 'TRANSUNION')),
  item_disputed text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'RESOLVED', 'REJECTED')),
  response_details text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS for disputes
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

-- 5. Create tasks Table
CREATE TABLE IF NOT EXISTS public.tasks (
  task_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES public.clients(client_id) ON DELETE CASCADE NOT NULL,
  assigned_user_id uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  due_date timestamptz,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED')),
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS for tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- 6. Create audit_logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  log_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(client_id) ON DELETE CASCADE,
  action text NOT NULL,
  previous_value jsonb,
  updated_value jsonb,
  timestamp timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS for audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- AUDIT TRIGGER LOGIC
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_client_changes()
RETURNS trigger as $$
BEGIN
  INSERT INTO public.audit_logs (user_id, client_id, action, previous_value, updated_value)
  VALUES (
    auth.uid(),
    coalesce(new.client_id, old.client_id),
    tg_op,
    CASE WHEN old IS NULL THEN NULL ELSE row_to_json(old)::jsonb END,
    CASE WHEN tg_op = 'DELETE' THEN NULL ELSE row_to_json(new)::jsonb END
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_clients_trigger ON public.clients;
CREATE TRIGGER audit_clients_trigger
  AFTER UPDATE OR DELETE ON public.clients
  FOR EACH ROW EXECUTE PROCEDURE public.log_client_changes();

DROP TRIGGER IF EXISTS audit_client_details_trigger ON public.client_sensitive_details;
CREATE TRIGGER audit_client_details_trigger
  AFTER UPDATE OR DELETE ON public.client_sensitive_details
  FOR EACH ROW EXECUTE PROCEDURE public.log_client_changes();

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Clients Policies
DROP POLICY IF EXISTS "Clients select policy" ON public.clients;
CREATE POLICY "Clients select policy" ON public.clients
  FOR SELECT USING (
    agency_id = public.get_my_agency_id() AND (
      public.get_my_role() IN ('owner', 'manager') OR
      (public.get_my_role() = 'worker' AND assigned_worker = auth.uid()) OR
      (public.get_my_role() = 'client' AND client_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Clients insert policy" ON public.clients;
CREATE POLICY "Clients insert policy" ON public.clients
  FOR INSERT WITH CHECK (
    agency_id = public.get_my_agency_id() AND
    public.get_my_role() IN ('owner', 'manager')
  );

DROP POLICY IF EXISTS "Clients update policy" ON public.clients;
CREATE POLICY "Clients update policy" ON public.clients
  FOR UPDATE USING (
    agency_id = public.get_my_agency_id() AND (
      public.get_my_role() IN ('owner', 'manager') OR
      (public.get_my_role() = 'worker' AND assigned_worker = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Clients delete policy" ON public.clients;
CREATE POLICY "Clients delete policy" ON public.clients
  FOR DELETE USING (
    agency_id = public.get_my_agency_id() AND
    public.get_my_role() = 'owner'
  );

-- Sensitive Details Policies
DROP POLICY IF EXISTS "Sensitive details select policy" ON public.client_sensitive_details;
CREATE POLICY "Sensitive details select policy" ON public.client_sensitive_details
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.client_id = client_sensitive_details.client_id
        AND c.agency_id = public.get_my_agency_id()
    ) AND (
      public.get_my_role() IN ('owner', 'manager') OR
      client_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Sensitive details modify policy" ON public.client_sensitive_details;
CREATE POLICY "Sensitive details modify policy" ON public.client_sensitive_details
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.client_id = client_sensitive_details.client_id
        AND c.agency_id = public.get_my_agency_id()
    ) AND public.get_my_role() IN ('owner', 'manager')
  );

-- Disputes Policies
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
          (public.get_my_role() = 'client' AND c.client_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "Disputes modify policy" ON public.disputes;
CREATE POLICY "Disputes modify policy" ON public.disputes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.client_id = disputes.client_id
        AND c.agency_id = public.get_my_agency_id()
        AND (
          public.get_my_role() IN ('owner', 'manager') OR
          (public.get_my_role() = 'worker' AND c.assigned_worker = auth.uid())
        )
    )
  );

-- Tasks Policies
DROP POLICY IF EXISTS "Tasks select policy" ON public.tasks;
CREATE POLICY "Tasks select policy" ON public.tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.client_id = tasks.client_id
        AND c.agency_id = public.get_my_agency_id()
    ) AND (
      public.get_my_role() IN ('owner', 'manager') OR
      assigned_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Tasks modify policy" ON public.tasks;
CREATE POLICY "Tasks modify policy" ON public.tasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.client_id = tasks.client_id
        AND c.agency_id = public.get_my_agency_id()
    ) AND public.get_my_role() IN ('owner', 'manager')
  );

-- Audit Logs Policies
DROP POLICY IF EXISTS "Audit logs select policy" ON public.audit_logs;
CREATE POLICY "Audit logs select policy" ON public.audit_logs
  FOR SELECT USING (
    public.get_my_role() IN ('owner', 'manager')
  );

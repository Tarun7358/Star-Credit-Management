-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. agencies Table
create table public.agencies (
  agency_id uuid default gen_random_uuid() primary key,
  agency_name text not null,
  owner_name text not null,
  phone text not null,
  email text not null,
  subscription_plan text not null default 'STANDARD',
  status text not null default 'ACTIVE',
  created_at timestamptz default now() not null
);

-- Enable RLS for agencies
alter table public.agencies enable row level security;

-- 2. users Table (Linked to auth.users)
create table public.users (
  user_id uuid primary key,
  agency_id uuid references public.agencies(agency_id) on delete cascade not null,
  role text not null check (role in ('owner', 'telecaller', 'worker')),
  full_name text not null,
  phone text not null,
  email text not null,
  status text not null check (status in ('active', 'pending', 'inactive')) default 'pending',
  branch text,
  created_at timestamptz default now() not null
);

-- Enable RLS for users
alter table public.users enable row level security;

-- 3. employees Table
create table public.employees (
  employee_id text primary key, -- Custom ID like TC001, WK001
  agency_id uuid references public.agencies(agency_id) on delete cascade not null,
  user_id uuid references public.users(user_id) on delete cascade not null,
  designation text not null,
  joining_date timestamptz default now() not null,
  active_status boolean not null default true
);

-- Enable RLS for employees
alter table public.employees enable row level security;

-- 3b. employee_requests Table
create table public.employee_requests (
  request_id uuid default gen_random_uuid() primary key,
  agency_id uuid references public.agencies(agency_id) on delete cascade not null,
  full_name text not null,
  phone text not null,
  email text not null,
  role text not null check (role in ('telecaller', 'worker')),
  branch text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now() not null
);

-- Enable RLS for employee_requests
alter table public.employee_requests enable row level security;

-- 4. leads Table
create table public.leads (
  lead_id uuid default gen_random_uuid() primary key,
  agency_id uuid references public.agencies(agency_id) on delete cascade not null,
  customer_name text not null,
  mobile text not null,
  alternate_mobile text,
  address text not null,
  loan_type text not null,
  loan_amount numeric not null,
  bank_name text not null,
  assigned_telecaller uuid references public.users(user_id) on delete set null,
  assigned_worker uuid references public.users(user_id) on delete set null,
  status text not null default 'NEW',
  uploaded_date timestamptz default now() not null,
  created_at timestamptz default now() not null
);

-- Enable RLS for leads
alter table public.leads enable row level security;

-- 5. lead_activities Table
create table public.lead_activities (
  activity_id uuid default gen_random_uuid() primary key,
  lead_id uuid references public.leads(lead_id) on delete cascade not null,
  user_id uuid references public.users(user_id) on delete cascade not null,
  activity_type text not null,
  remark text,
  timestamp timestamptz default now() not null
);

-- Enable RLS for lead_activities
alter table public.lead_activities enable row level security;

-- 6. followups Table
create table public.followups (
  followup_id uuid default gen_random_uuid() primary key,
  lead_id uuid references public.leads(lead_id) on delete cascade not null,
  telecaller_id uuid references public.users(user_id) on delete cascade not null,
  next_followup_date timestamptz not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'COMPLETED', 'MISSED')),
  remarks text
);

-- Enable RLS for followups
alter table public.followups enable row level security;

-- 7. documents Table
create table public.documents (
  document_id uuid default gen_random_uuid() primary key,
  lead_id uuid references public.leads(lead_id) on delete cascade not null,
  uploaded_by uuid references public.users(user_id) on delete set null,
  file_url text not null,
  file_name text,
  document_type text not null,
  upload_date timestamptz default now() not null
);

-- Enable RLS for documents
alter table public.documents enable row level security;

-- Helper Functions for RLS Isolation
create or replace function public.get_my_agency_id()
returns uuid as $$
  select agency_id from public.users where user_id = auth.uid();
$$ language sql security definer;

create or replace function public.get_my_role()
returns text as $$
  select role from public.users where user_id = auth.uid();
$$ language sql security definer;

-- Create Policies

-- Agencies policies
create policy "Agencies insert public" on public.agencies
  for insert with check (true);

create policy "Agencies read isolation" on public.agencies
  for select using (agency_id = public.get_my_agency_id());

create policy "Agencies update owner only" on public.agencies
  for update using (agency_id = public.get_my_agency_id() and public.get_my_role() = 'owner');

-- Users policies
create policy "Users select same agency" on public.users
  for select using (agency_id = public.get_my_agency_id());

create policy "Users self update" on public.users
  for update using (user_id = auth.uid());

create policy "Users owner updates" on public.users
  for update using (agency_id = public.get_my_agency_id() and public.get_my_role() = 'owner');

-- Employees policies
create policy "Employees select same agency" on public.employees
  for select using (agency_id = public.get_my_agency_id());

create policy "Employees owner modify" on public.employees
  for all using (agency_id = public.get_my_agency_id() and public.get_my_role() = 'owner');

-- Employee Requests policies
create policy "Employee requests insert public" on public.employee_requests
  for insert with check (true);

create policy "Employee requests select owner" on public.employee_requests
  for select using (agency_id = public.get_my_agency_id() and public.get_my_role() = 'owner');

create policy "Employee requests modify owner" on public.employee_requests
  for all using (agency_id = public.get_my_agency_id() and public.get_my_role() = 'owner');

-- Leads policies
create policy "Leads owner full access" on public.leads
  for all using (agency_id = public.get_my_agency_id() and public.get_my_role() = 'owner');

create policy "Leads telecaller access" on public.leads
  for all using (agency_id = public.get_my_agency_id() and public.get_my_role() = 'telecaller' and assigned_telecaller = auth.uid());

create policy "Leads worker access" on public.leads
  for all using (agency_id = public.get_my_agency_id() and public.get_my_role() = 'worker' and assigned_worker = auth.uid());

-- Lead Activities policies
create policy "Lead activities owner full access" on public.lead_activities
  for all using (
    exists (select 1 from public.leads where leads.lead_id = lead_activities.lead_id and leads.agency_id = public.get_my_agency_id() and public.get_my_role() = 'owner')
  );

create policy "Lead activities telecaller access" on public.lead_activities
  for all using (
    exists (select 1 from public.leads where leads.lead_id = lead_activities.lead_id and leads.agency_id = public.get_my_agency_id() and leads.assigned_telecaller = auth.uid())
  );

create policy "Lead activities worker access" on public.lead_activities
  for all using (
    exists (select 1 from public.leads where leads.lead_id = lead_activities.lead_id and leads.agency_id = public.get_my_agency_id() and leads.assigned_worker = auth.uid())
  );

-- Followups policies
create policy "Followups owner full access" on public.followups
  for all using (
    exists (select 1 from public.leads where leads.lead_id = followups.lead_id and leads.agency_id = public.get_my_agency_id() and public.get_my_role() = 'owner')
  );

create policy "Followups telecaller access" on public.followups
  for all using (
    exists (select 1 from public.leads where leads.lead_id = followups.lead_id and leads.agency_id = public.get_my_agency_id() and leads.assigned_telecaller = auth.uid())
  );

-- Documents policies
create policy "Documents owner full access" on public.documents
  for all using (
    exists (select 1 from public.leads where leads.lead_id = documents.lead_id and leads.agency_id = public.get_my_agency_id() and public.get_my_role() = 'owner')
  );

create policy "Documents telecaller view only" on public.documents
  for select using (
    exists (select 1 from public.leads where leads.lead_id = documents.lead_id and leads.agency_id = public.get_my_agency_id() and leads.assigned_telecaller = auth.uid())
  );

create policy "Documents worker full access" on public.documents
  for all using (
    exists (select 1 from public.leads where leads.lead_id = documents.lead_id and leads.agency_id = public.get_my_agency_id() and leads.assigned_worker = auth.uid())
  );

-- 8. Auth trigger for user profile sync
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (user_id, agency_id, role, full_name, phone, email, status, branch)
  values (
    new.id,
    coalesce((new.raw_user_meta_data->>'agency_id')::uuid, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(new.raw_user_meta_data->>'role', 'worker'),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'status', 'pending'),
    coalesce(new.raw_user_meta_data->>'branch', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

# Star Credit Management (SCM)

> A secure, invite-only, enterprise-grade SaaS portal for finance agencies, DSAs, and credit intermediaries.

![SCM Portal](https://img.shields.io/badge/Platform-SaaS-6366f1?style=for-the-badge)
![Stack](https://img.shields.io/badge/Stack-React%20%2B%20Supabase-3ecf8e?style=for-the-badge)
![License](https://img.shields.io/badge/License-Private-red?style=for-the-badge)

---

## 🚀 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript + Material UI |
| Backend | Supabase (PostgreSQL, Auth, RLS, Storage) |
| Bundler | Vite |
| Charts | Recharts |
| PDF/Excel | jsPDF + SheetJS |

---

## 🏗️ Architecture

This is a **fully serverless** application. There is no Express backend — all data operations run directly against Supabase via the `@supabase/supabase-js` client with **Row Level Security (RLS)** enforcing multi-tenant data isolation at the database level.

```
┌─────────────────┐      ┌─────────────────────────────┐
│   React SPA     │ ───► │         Supabase             │
│  (Vite + MUI)   │      │  ┌──────┐ ┌──────┐ ┌──────┐ │
│                 │      │  │ Auth │ │  DB  │ │Store │ │
└─────────────────┘      │  └──────┘ └──────┘ └──────┘ │
                         └─────────────────────────────┘
```

---

## 👥 User Roles

| Role | Access |
|------|--------|
| **Owner** | Full dashboard, leads, employees, reports |
| **Telecaller** | Leads assigned to them, call remarks, follow-ups |
| **Worker** | Leads assigned to them, document uploads, status updates |

**Access is invite-only** — no public registration. Agency workspaces are created manually by SCM administrators. Owners create employee accounts from within the portal.

---

## ⚙️ Setup & Installation

### 1. Clone the repository
```bash
git clone https://github.com/Tarun7358/Star-Credit-Management.git
cd Star-Credit-Management
```

### 2. Install frontend dependencies
```bash
cd frontend
npm install
```

### 3. Configure environment
```bash
cp .env.example .env
```
Edit `frontend/.env` and fill in your Supabase credentials:
```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 4. Set up Supabase database
1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run `supabase_schema.sql`
3. Then run `supabase_setup_admin.sql` to fix the auth trigger and create the default agency

### 5. Create the first admin user
1. Go to **Authentication → Users → Add User** in your Supabase dashboard
2. Create your owner account (email + password)
3. Copy the UUID shown for that user
4. In **SQL Editor**, run:
```sql
INSERT INTO public.users (user_id, agency_id, role, full_name, phone, email, status)
SELECT
  'YOUR_USER_UUID'::uuid,
  agency_id,
  'owner',
  'Your Name',
  '9999999999',
  'your@email.com',
  'active'
FROM public.agencies
WHERE email = 'your@email.com'
LIMIT 1;
```

### 6. Run the development server
```bash
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📁 Project Structure

```
Star-Credit-Management/
├── frontend/                  # React SPA
│   ├── src/
│   │   ├── context/           # AuthContext (Supabase session)
│   │   ├── layouts/           # DashboardLayout
│   │   ├── pages/             # Login, Dashboard, Leads, Employees, Reports
│   │   ├── theme/             # MUI dark theme
│   │   └── utils/             # supabaseClient.ts
│   ├── .env.example           # Template for environment variables
│   └── package.json
├── supabase_schema.sql        # Full PostgreSQL schema + RLS policies
├── supabase_setup_admin.sql   # First-time admin setup script
├── mock_leads.csv             # Sample leads for import testing
└── package.json
```

---

## 🔒 Security

- All data is isolated per agency via **PostgreSQL Row Level Security (RLS)**
- No public registration routes exist anywhere
- Authentication is **invite-only** — credentials are issued by SCM administrators
- Supabase Auth handles session management and JWT tokens

---

## 📄 License

This project is proprietary software. All rights reserved.

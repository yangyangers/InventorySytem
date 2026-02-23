# 📦 IMS Platform — Vite + React

**Fast, lightweight** Inventory Management System built with **Vite**, **React 18**, **TypeScript**, and **Supabase**.

No Next.js. No SSR complexity. Just a blazing-fast SPA.

---

## 🗂️ Project Structure

```
ims-vite/
├── src/
│   ├── pages/               ← All page components
│   │   ├── LoginPage.tsx    ← Username login (split panel)
│   │   ├── DashboardPage.tsx
│   │   ├── InventoryPage.tsx
│   │   ├── TransactionsPage.tsx
│   │   ├── SuppliersPage.tsx
│   │   ├── ProfilePage.tsx  ← Profile/Security/Appearance tabs
│   │   ├── StaffPage.tsx    ← Admin only
│   │   ├── ReportsPage.tsx  ← Admin only
│   │   └── CategoriesPage.tsx ← Admin only
│   ├── components/
│   │   ├── layout/
│   │   │   ├── DashboardLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Topbar.tsx
│   │   └── ui/
│   │       └── Modal.tsx
│   ├── store/
│   │   └── auth.ts          ← Zustand store (session in localStorage)
│   ├── lib/
│   │   ├── supabase.ts      ← Supabase client
│   │   └── utils.ts         ← Helpers
│   ├── types/index.ts       ← All TypeScript types
│   ├── App.tsx              ← Router setup
│   ├── main.tsx             ← Entry point
│   └── index.css            ← Global styles (dark industrial theme)
├── supabase/
│   └── schema.sql           ← Full DB schema + RLS + seeds
├── scripts/
│   └── seed-admin.js        ← Generate bcrypt hashes for admins
├── .env.example
├── vite.config.ts
└── vercel.json              ← Vercel SPA config
```

---

## 🚀 Setup in 4 Steps

### Step 1 — Create Supabase Project
1. Go to [supabase.com](https://supabase.com) → New Project
2. Region: **Southeast Asia (Singapore)**
3. Wait ~2 minutes for it to initialize

### Step 2 — Run the Database Schema
1. In Supabase → **SQL Editor** → **New Query**
2. Paste the contents of `supabase/schema.sql`
3. **DO NOT click Run yet!** First generate the admin hashes:

### Step 3 — Generate Admin Hashes
```bash
npm install
node scripts/seed-admin.js
```
This prints the correct `INSERT` SQL with real bcrypt hashes.
Copy the output SQL, replace the placeholder lines in `schema.sql`, then run it.

### Step 4 — Configure Environment
```bash
cp .env.example .env
```
Fill in `.env`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```
Get these from: **Supabase → Settings → API**

### Run Locally
```bash
npm run dev
# → http://localhost:5173
```

Login with: `@admin.wellbuild` / `Admin@123456` (or whatever password you used)

---

## ☁️ Deploy to Vercel

```bash
# Push to GitHub first
git init && git add . && git commit -m "IMS Platform"
git remote add origin https://github.com/YOU/ims-platform.git
git push -u origin main
```

Then:
1. [vercel.com](https://vercel.com) → **Add New Project** → Import from GitHub
2. Framework: **Vite** (auto-detected)
3. Add Environment Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Click **Deploy** ✅

The `vercel.json` already handles SPA routing so all page refreshes work.

---

## 👥 Roles & Access

| Feature | Admin | Staff |
|---|---|---|
| Dashboard | ✅ | ✅ |
| Inventory (view + add + edit) | ✅ | ✅ |
| Delete / Archive Products | ✅ | ❌ |
| Record Transactions | ✅ | ✅ |
| View Transactions | ✅ | ✅ |
| Suppliers (view + add + edit) | ✅ | ✅ |
| Delete Suppliers | ✅ | ❌ |
| Staff Management | ✅ | ❌ |
| Reports & Analytics | ✅ | ❌ |
| Categories | ✅ | ❌ |
| Profile (own account) | ✅ | ✅ |

---

## 🔐 How Authentication Works

This app uses **Supabase directly from the frontend** (anon key) with:
- **bcryptjs** — password hashing/verification runs in the browser
- **Zustand + localStorage** — session persists across browser refreshes
- **React Router** — protected routes redirect to `/login` if no session

> **Note:** The anon key is safe to expose in frontend apps. The RLS policies in `schema.sql` control what the anon key can access. For production, tighten the RLS policies to only allow users to read their own `business_id` data.

---

## 🏢 Business Isolation

Every table has `business_id`. When a user logs in, their `business_id` is saved in the session. Every Supabase query automatically filters by that `business_id` — so WELLBUILD users never see TC CHEMICAL data.

---

## 📞 Troubleshooting

**"Failed to login"** → Run `node scripts/seed-admin.js` and make sure you used the generated SQL

**"permission denied for table users"** → Make sure you ran the RLS policies section in `schema.sql`

**Page shows 404 on Vercel refresh** → Make sure `vercel.json` is in your project root

**"VITE_SUPABASE_URL is not defined"** → Your `.env` file is missing or not loaded — restart dev server

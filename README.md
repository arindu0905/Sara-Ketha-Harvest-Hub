# 🌾 HarvestHub — Agricultural Collection Centre Management System

> A production-ready enterprise digital transformation platform for agricultural collection centres in Sri Lanka.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Project Structure](#project-structure)
5. [Quick Start](#quick-start)
6. [Environment Setup](#environment-setup)
7. [Database Setup](#database-setup)
8. [Running the Application](#running-the-application)
9. [User Roles](#user-roles)
10. [Documentation](#documentation)

---

## Overview

HarvestHub connects farmers, collection centre staff, quality inspectors, buyers, finance officers, transport coordinators, and administrators into one secure, integrated platform.

**Key capabilities:**
- Farmer & crop registration and management
- Produce collection, digital weighing, and quality grading
- Inventory and warehouse management with batch traceability
- Buyer marketplace, ordering, and invoicing
- Farmer payment calculation and disbursement
- Transport and delivery coordination
- Analytics dashboards and financial reporting
- Real-time notifications and audit logging

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│           FRONTEND (React + Vite)               │
│        Deployed on Vercel                        │
└──────────────────┬──────────────────────────────┘
                   │ REST API (Axios)
┌──────────────────▼──────────────────────────────┐
│        BACKEND (Node.js + Express)              │
│        Deployed on Render / Railway              │
└──────────────────┬──────────────────────────────┘
                   │ Supabase JS Client
┌──────────────────▼──────────────────────────────┐
│               SUPABASE                          │
│  PostgreSQL · Auth · Storage · Realtime · RLS   │
└─────────────────────────────────────────────────┘
```

---

## Prerequisites

- Node.js 18 or higher — https://nodejs.org
- npm 9 or higher
- A Supabase project — https://supabase.com
- Git

---

## Project Structure

```
harvesthub/
├── frontend/          React + Vite + TypeScript + Tailwind CSS
├── backend/           Node.js + Express + TypeScript REST API
├── supabase/          Migrations, RLS policies, seed data
├── documents/         Architecture, API docs, deployment guides
└── README.md
```

---

## Quick Start

### 1. Clone and install dependencies

```bash
# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install
```

### 2. Configure environment variables

```bash
# Frontend
cp frontend/.env.example frontend/.env.local

# Backend
cp backend/.env.example backend/.env
```

Fill in your Supabase credentials in both files.

### 3. Set up the database

In your Supabase project, open the SQL Editor and run **every file in `supabase/migrations/` in numeric order (001 → 026)**, then the seed:

```
supabase/migrations/001_initial_schema.sql
...                                         (002 – 022 as before)
supabase/migrations/023_manager_role_and_notification_types.sql   <- run this one ALONE and let it commit
supabase/migrations/024_inventory_integrity.sql                   (atomic reserve/release, wastage, expiry sweep)
supabase/migrations/025_receipts_inspection_payments.sql          (finalize_inspection, receipts, partial payments)
supabase/migrations/026_management_reports_and_bid_results.sql    (management reports, bid-result notifications)
supabase/seed/001_seed_data.sql
```

> 023 adds values to PostgreSQL enums (`ALTER TYPE ... ADD VALUE`). Postgres cannot use a new enum value in the same transaction that
> adds it, so run 023 as its own query before 024-026.

Optional: the SQL regression scripts in `supabase/tests/` (`run.sh`) rebuild a **scratch** database and exercise stock reservation,
wastage, inspection, receipts and payments. Never point them at production.

### 4. Run the application

```bash
# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev
```

The frontend will be available at http://localhost:5173
The backend API will be available at http://localhost:4000

---

## Environment Setup

### Frontend (`frontend/.env.local`)

```
VITE_API_BASE_URL=http://localhost:4000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Backend (`backend/.env`)

```
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d
MAX_FILE_SIZE=10485760
```

---

## User Roles

| Role | Description |
|------|-------------|
| Farmer | Register crops, schedule deliveries, view payments |
| Collection Centre Officer | Register farmers, record deliveries |
| Quality Inspector | Grade produce, manage inspections |
| Inventory Manager | Manage stock, warehouses, allocations |
| Buyer | Browse products, create orders |
| Finance Officer | Process payments, generate invoices |
| Transport Coordinator | Schedule deliveries, manage vehicles |
| Manager | Read-only management reports (operations, farmer/buyer performance, waste, forecasts, financials) and orders |
| Administrator | Full system access |

**Demo credentials (after running seed data):**

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@harvesthub.lk | Admin@123456 |
| Farmer | farmer@harvesthub.lk | Farmer@123456 |
| Officer | officer@harvesthub.lk | Officer@123456 |
| Inspector | inspector@harvesthub.lk | Inspector@123456 |
| Buyer | buyer@harvesthub.lk | Buyer@123456 |
| Finance | finance@harvesthub.lk | Finance@123456 |

---

## Documentation

| Document | Location |
|----------|----------|
| User-story coverage (40 stories) | `docs/STORY_COVERAGE.md` |
| API Reference | `documents/api-documentation/API.md` |
| Database Schema | `documents/database/ERD.md` |
| Architecture | `documents/architecture/ARCHITECTURE.md` |
| Security | `documents/security/SECURITY.md` |
| Deployment | `documents/deployment/DEPLOYMENT.md` |
| BCDR | `documents/deployment/BCDR.md` |

---

## Testing

```bash
cd backend && npm test          # Jest: schemas, crop advisor scoring, CSV safety, error mapping, auctions
cd frontend && npx tsc --noEmit # type-check; `npm test` runs Vitest
```

## Security notes

- Never commit `.env` files. If a Supabase service-role key or Gemini key was ever committed or shared, **rotate it** in the Supabase / Google console.
- The backend uses the service-role key, so authorisation is enforced in the Express routes (role + ownership checks). Several older
  migrations still contain permissive `USING (true)` RLS policies for `authenticated`; tighten them before exposing the Supabase anon key to untrusted clients.

---

## License

This project is developed as an enterprise solution for agricultural collection centres in Sri Lanka.
Currency: LKR (Sri Lankan Rupee) | Weight Unit: Kilograms (kg)

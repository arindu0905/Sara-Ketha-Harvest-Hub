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

In your Supabase project, open the SQL Editor and run:

```bash
# In order:
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_rls_policies.sql
supabase/migrations/003_functions_triggers.sql
supabase/seed/001_seed_data.sql
```

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
| API Reference | `documents/api-documentation/API.md` |
| Database Schema | `documents/database/ERD.md` |
| Architecture | `documents/architecture/ARCHITECTURE.md` |
| Security | `documents/security/SECURITY.md` |
| Deployment | `documents/deployment/DEPLOYMENT.md` |
| BCDR | `documents/deployment/BCDR.md` |

---

## License

This project is developed as an enterprise solution for agricultural collection centres in Sri Lanka.
Currency: LKR (Sri Lankan Rupee) | Weight Unit: Kilograms (kg)

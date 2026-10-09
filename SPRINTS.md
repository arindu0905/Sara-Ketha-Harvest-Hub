# 🌾 HarvestHub — Project Sprint Plan (3 Sprints)

> Agricultural Collection Centre Management System

---

## 📅 Sprint Overview

| Sprint | Theme | Key Modules Added | Status |
|--------|-------|-------------------|--------|
| [Sprint 1](Sprint-1/README.md) | Foundation → Full Platform | E1: Auth, Farmer, Crop; E2: Delivery, Collection, Inspection; E3: Inventory, Warehouse, Buyers, Orders; E4: Payments, Invoicing | 🟡 In Progress |
| [Sprint 2](Sprint-2/README.md) | Inventory & Buyer Operations | E3: Inventory Batches, Warehouse Management, Buyer Marketplace, Purchase Orders | 🔵 Planned |
| [Sprint 3](Sprint-3/README.md) | Payments & Full Platform | E4: Farmer Payments, Buyer Invoicing, Finance Reports, Chatbot, Transport, Audit | 🔵 Planned |

> ✅ Each sprint is **cumulative** — it includes everything from previous sprints plus new features.

---

## 🏗️ Feature → Sprint Map

```
Feature Area                         Sprint 1   Sprint 2   Sprint 3
────────────────────────────────────────────────────────────────────
Project Setup & Infrastructure          ✅
Database Schema & Migrations            ✅
Authentication & RBAC (8 roles)         ✅
Farmer Registration & Profile           ✅         (E1-US1 to US5)
Crop Registration                       ✅         (E1-US6)
Admin Dashboard                         ✅
User Management                         ✅
Crop Categories                         ✅
Delivery Appointments                   ✅         (E2-US1)
Produce Collection & Weighing           ✅         (E2-US2, E2-US3)
Quality Inspection & Grading            ✅         (E2-US4, E2-US5)
Inventory Batches & Traceability        ✅         (E3-US1, E3-US3)
Warehouse & Storage Management          ✅         (E3-US2)
Buyer Registration & Product Browsing   ✅         (E3-US5)
Buyer Purchase Orders                   ✅         (E3-US6)
Order Approval & Stock Reservation      ✅         (E3-US7)
Price Management                        ✅
Farmer Payment Calculation & Approval   ✅         (E4-US1, E4-US2)
Farmer Payment Tracking                 ✅         (E4-US3)
Buyer Payment & Invoice Management      ✅         (E4-US4)
────────────────────────────────────────────────────────────────────
Live Auction System                                           ✅
Transport & Delivery Coordination                             ✅
Finance Dashboard & Reports                                   ✅
Real-time Notifications                                       ✅
AI Chatbot Assistant                                          ✅
Admin Audit Logs & Reports                                    ✅
```

---

## 👤 User Roles per Sprint

| Role | Sprint 1 | Sprint 2 | Sprint 3 |
|------|----------|----------|----------|
| Administrator | ✅ | ✅ | ✅ |
| Collection Centre Officer | ✅ | ✅ | ✅ |
| Farmer | ✅ | ✅ | ✅ |
| Quality Inspector | ✅ | ✅ | ✅ |
| Inventory Manager | ✅ | ✅ | ✅ |
| Buyer | ✅ | ✅ | ✅ |
| Finance Officer | ✅ | — | ✅ |
| Transport Coordinator | — | — | ✅ |

---

## 🗂️ Folder Structure

```
HarvestHub/
├── Sprint-1/               ← Foundation & Auth (runnable)
│   ├── backend/
│   ├── frontend/
│   ├── supabase/
│   └── README.md
├── Sprint-2/               ← Collection & Operations (runnable)
│   ├── backend/
│   ├── frontend/
│   ├── supabase/
│   └── README.md
├── Sprint-3/               ← Full Platform (runnable)
│   ├── backend/
│   ├── frontend/
│   ├── supabase/
│   └── README.md
├── backend/                ← Main source (development)
├── frontend/               ← Main source (development)
├── ml-service/             ← Java ML Crop Prediction
└── supabase/               ← Migrations & Seed Data
```

---

## 🚀 Running Any Sprint

Each sprint folder is fully self-contained. Just go into the sprint folder and run:

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4000

---

## 🔑 Demo Credentials (All Sprints)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@harvesthub.lk | Admin@123456 |
| Farmer | farmer@harvesthub.lk | Farmer@123456 |
| Officer | officer@harvesthub.lk | Officer@123456 |
| Inspector | inspector@harvesthub.lk | Inspector@123456 |
| Buyer | buyer@harvesthub.lk | Buyer@123456 |
| Finance | finance@harvesthub.lk | Finance@123456 |

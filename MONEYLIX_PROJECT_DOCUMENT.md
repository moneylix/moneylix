# MONEYLIX
## Complete Project Documentation
### Finance Management SaaS — v1.0

---

**Live URL:** https://moneylix.in  
**GitHub:** https://github.com/abisheke02/money  
**Platform:** Web + iOS + Android (Capacitor)  
**Built by:** Abishek Elumalai  
**Date:** June 2026  

---

## TABLE OF CONTENTS

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [System Architecture](#3-system-architecture)
4. [Project File Structure](#4-project-file-structure)
5. [Database Design](#5-database-design)
6. [API Reference](#6-api-reference)
7. [Features by Page](#7-features-by-page)
8. [Pricing Plans](#8-pricing-plans)
9. [Mobile App](#9-mobile-app)
10. [Server & Deployment](#10-server--deployment)
11. [Email System](#11-email-system)
12. [Security](#12-security)
13. [Pending & Future Work](#13-pending--future-work)

---

## 1. PROJECT OVERVIEW

**Moneylix** is a full-stack SaaS finance management application built for Indian freelancers, creators, and small businesses. It allows users to track income and expenses, manage receivables, view analytics, and get AI-powered investment advice — all from a single platform available on web, iOS, and Android.

### Key Objectives

| Objective | Description |
|-----------|-------------|
| Income & Expense Tracking | Log all transactions with categories, notes, tags, and payment method |
| Multi-Business Support | Switch between multiple businesses with isolated data |
| Receivables Management | Track pending client payments with due-date reminders |
| AI Investment Advisor | Claude AI gives personalized investment suggestions |
| Analytics Dashboard | Cash flow charts, spending split, savings rate |
| Plan-Based Access | Free / Pro / Premium tiers with Razorpay payments |
| Mobile App | Native iOS and Android app via Capacitor |
| Admin Panel | Full admin control of users, plans, and platform stats |

### Target Users

- Freelancers (designers, developers, consultants)
- Small business owners
- Creators and solopreneurs in India

---

## 2. TECH STACK

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Framework | Next.js (App Router) | 14.2.3 | Full-stack React framework |
| Language | TypeScript | 5.x | Type safety across frontend and backend |
| Styling | Tailwind CSS | 3.x | Utility-first CSS |
| Database | SQLite (better-sqlite3) | 12.x | Embedded relational database (async-wrapped via `db.async.ts`) |
| ORM/Query | Raw SQL via `dbQuery` (async wrapper) | — | Direct database queries; `db.postgres.ts` prepped (uses `pg`) for future Postgres cutover |
| Bank Sync | Setu Account Aggregator | — | RBI-regulated bank statement fetch (`src/lib/setu/client.ts`) |
| Auth | JWT + bcryptjs | — | Session tokens + password hashing |
| AI | Anthropic Claude SDK | 0.90.0 | AI financial advisor |
| Payments | Razorpay | 2.9.6 | Indian payment gateway |
| Email | Resend | 6.x | Transactional emails |
| Charts | Recharts | 2.x | Dashboard data visualizations |
| Mobile | Capacitor | 8.x | iOS and Android WebView wrapper |
| PWA | next-pwa | 5.x | Installable Progressive Web App |
| OCR | Tesseract.js | 7.x | Receipt scanning |
| Rate Limiting | Upstash Redis | — | API rate limiting |
| Validation | Zod | 4.x | Input schema validation |
| Icons | Lucide React | 0.378 | UI icon library |
| Animation | Framer Motion | 12.x | Page transitions |
| CSV Parsing | PapaParse | 5.x | CSV import/export |
| Hosting | PM2 + Nginx | — | Process management + reverse proxy |
| SSL | Let's Encrypt | — | HTTPS certificate |
| DNS | Cloudflare | — | Domain management |

---

## 3. SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────┐
│                  CLIENT LAYER                        │
│  Browser (moneylix.in)  │  iOS App  │  Android App  │
│         React 18 + Next.js App Router                │
└─────────────────┬───────────────────────────────────┘
                  │ HTTPS
┌─────────────────▼───────────────────────────────────┐
│                  NGINX (Reverse Proxy)               │
│         SSL Termination → Port 3006 (Next.js)        │
└─────────────────┬───────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────┐
│            NEXT.JS APP ROUTER (Server)               │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐                 │
│  │  Page Routes  │  │  API Routes  │                 │
│  │  (RSC/Client) │  │ (/api/*)     │                 │
│  └──────────────┘  └──────┬───────┘                 │
│                            │                         │
│  ┌─────────────────────────▼──────────────────────┐ │
│  │              Business Logic Layer               │ │
│  │  Auth │ Transactions │ Plans │ AI │ Payments   │ │
│  └─────────────────────────┬──────────────────────┘ │
└────────────────────────────┼────────────────────────┘
                             │
          ┌──────────────────▼──────────────────────┐
          │           SQLITE DATABASE               │
          │   moneylix.db (WAL mode, FK enabled)    │
          └─────────────────────────────────────────┘

External Services:
  ├── Anthropic API  → AI investment recommendations
  ├── Razorpay       → Payment processing
  ├── Resend         → Transactional email
  └── Upstash Redis  → Rate limiting
```

---

## 4. PROJECT FILE STRUCTURE

```
D:\Projects\Money\
├── src/
│   ├── app/
│   │   │
│   │   ├── page.tsx                          ← Landing / marketing page
│   │   ├── layout.tsx                        ← Root layout, PWA meta, viewport
│   │   ├── not-found.tsx                     ← 404 error page
│   │   ├── icon.tsx                          ← Dynamic app icon
│   │   │
│   │   ├── offline/
│   │   │   └── page.tsx                      ← PWA offline fallback page
│   │   │
│   │   ├── onboarding/
│   │   │   └── page.tsx                      ← First-time business setup wizard
│   │   │
│   │   ├── auth/
│   │   │   ├── login/page.tsx                ← Sign in form
│   │   │   ├── register/page.tsx             ← Create account form
│   │   │   ├── forgot-password/page.tsx      ← Request password reset
│   │   │   └── reset-password/page.tsx       ← Set new password via token
│   │   │
│   │   ├── dashboard/
│   │   │   ├── layout.tsx                    ← Sidebar + mobile bottom nav + header
│   │   │   ├── page.tsx                      ← Main dashboard (stats + charts)
│   │   │   ├── transactions/page.tsx         ← All transactions management
│   │   │   ├── categories/page.tsx           ← Income & expense categories
│   │   │   ├── receivables/page.tsx          ← Pending client payments
│   │   │   ├── overall/page.tsx              ← Cross-business analytics
│   │   │   ├── bank/page.tsx                 ← Bank Sync: connections + transactions (Pro+)
│   │   │   ├── bank/status/page.tsx          ← Setu consent approval redirect/status
│   │   │   ├── recurring/page.tsx            ← Recurring/scheduled transactions
│   │   │   ├── ai/page.tsx                   ← Claude AI investment advisor
│   │   │   ├── calculator/page.tsx           ← Financial calculator with history
│   │   │   ├── profile/page.tsx              ← User profile (name, email, password, delete account)
│   │   │   ├── settings/page.tsx             ← Currency, export, import data
│   │   │   ├── pricing/page.tsx              ← Plan upgrade page
│   │   │   └── help/page.tsx                 ← FAQs and support
│   │   │
│   │   ├── admin/
│   │   │   ├── layout.tsx                    ← Admin sidebar layout
│   │   │   ├── login/page.tsx                ← Admin login (bcrypt)
│   │   │   ├── page.tsx                      ← Admin dashboard + KPIs
│   │   │   ├── users/page.tsx                ← View and manage all users
│   │   │   ├── admins/page.tsx               ← Manage admin accounts
│   │   │   ├── subscriptions/page.tsx        ← All active subscriptions
│   │   │   ├── broadcast/page.tsx            ← Send messages to all users
│   │   │   ├── features/page.tsx             ← Feature flags and voting
│   │   │   └── tickets/page.tsx              ← Support ticket management
│   │   │
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── login/route.ts            ← POST → JWT session token
│   │   │   │   ├── register/route.ts         ← POST → create user account
│   │   │   │   ├── me/route.ts               ← GET → current user profile
│   │   │   │   ├── forgot-password/route.ts  ← POST → send reset email
│   │   │   │   ├── reset-password/route.ts   ← POST → update password
│   │   │   │   ├── verify-email/route.ts     ← GET → confirm email token
│   │   │   │   ├── resend-verification/      ← POST → resend verify email
│   │   │   │   └── demo/route.ts             ← POST → instant demo login
│   │   │   │
│   │   │   ├── businesses/
│   │   │   │   ├── route.ts                  ← GET list / POST create
│   │   │   │   └── [id]/route.ts             ← PUT rename / DELETE
│   │   │   │
│   │   │   ├── transactions/
│   │   │   │   ├── route.ts                  ← GET (filtered+paginated) / POST
│   │   │   │   ├── [id]/route.ts             ← PUT edit / DELETE
│   │   │   │   └── bulk/route.ts             ← POST bulk create / PUT bulk update
│   │   │   │
│   │   │   ├── categories/
│   │   │   │   ├── route.ts                  ← GET list / POST create
│   │   │   │   └── [id]/route.ts             ← PUT edit / DELETE
│   │   │   │
│   │   │   ├── recurring/
│   │   │   │   ├── route.ts                  ← GET list / POST create scheduled transaction
│   │   │   │   └── [id]/route.ts             ← PATCH update / DELETE
│   │   │   │
│   │   │   ├── bank/                         ← Bank Sync (Setu Account Aggregator, Pro+)
│   │   │   │   ├── create-consent/route.ts   ← POST start AA consent flow
│   │   │   │   ├── consent-status/route.ts   ← GET poll consent approval status
│   │   │   │   ├── connections/route.ts      ← GET list connections / DELETE revoke
│   │   │   │   ├── sync/route.ts             ← POST fetch latest statement from FIP
│   │   │   │   ├── sync-status/route.ts      ← GET sync progress/result
│   │   │   │   ├── transactions/route.ts     ← GET fetched bank transactions
│   │   │   │   ├── categorise/route.ts       ← POST AI-categorise bank transactions
│   │   │   │   └── setu-webhook/route.ts     ← POST Setu AA notification webhook
│   │   │   │
│   │   │   ├── dashboard/route.ts            ← GET balance, income, expense summary
│   │   │   ├── charts/route.ts               ← GET daily cashflow + category spend
│   │   │   ├── overall/route.ts              ← GET cross-business totals
│   │   │   ├── export/route.ts               ← GET download CSV or JSON
│   │   │   ├── import/route.ts               ← POST bulk import from CSV
│   │   │   ├── currencies/route.ts           ← GET supported currencies list
│   │   │   ├── settings/route.ts             ← GET/PUT user settings
│   │   │   ├── health/route.ts               ← GET server health check
│   │   │   ├── support/route.ts              ← POST submit support ticket
│   │   │   ├── ai-recommendations/route.ts   ← POST Claude AI financial advice
│   │   │   │
│   │   │   ├── payments/
│   │   │   │   ├── create-order/route.ts     ← POST create Razorpay order
│   │   │   │   ├── verify/route.ts           ← POST verify + upgrade plan
│   │   │   │   └── webhook/route.ts          ← POST handle Razorpay events
│   │   │   │
│   │   │   ├── user/
│   │   │   │   ├── plan/route.ts             ← GET current plan + expiry date
│   │   │   │   ├── profile/route.ts          ← GET/PUT name, email, password
│   │   │   │   ├── delete-account/route.ts   ← POST permanently delete account + data
│   │   │   │   └── notifications/route.ts    ← GET in-app notifications
│   │   │   │
│   │   │   ├── cron/
│   │   │   │   ├── expire-subscriptions/     ← GET auto-expire old plans
│   │   │   │   └── process-recurring/        ← GET generate due recurring transactions
│   │   │   │
│   │   │   └── admin/
│   │   │       ├── _auth.ts                  ← Admin session verification helper (async)
│   │   │       ├── login/route.ts            ← POST admin login
│   │   │       ├── change-password/route.ts  ← POST change admin password
│   │   │       ├── stats/route.ts            ← GET platform KPI stats
│   │   │       ├── users/route.ts            ← GET all users
│   │   │       ├── users/[id]/route.ts       ← PUT/DELETE user
│   │   │       ├── admins/route.ts           ← GET/POST admin accounts
│   │   │       ├── admins/[id]/route.ts      ← DELETE admin account
│   │   │       ├── subscriptions/route.ts    ← GET all subscriptions
│   │   │       ├── broadcast/route.ts        ← POST send broadcast
│   │   │       ├── features/route.ts         ← GET/POST feature flags
│   │   │       └── tickets/route.ts          ← GET support tickets
│   │   │
│   │   ├── cookie-policy/page.tsx            ← Cookie usage disclosure page
│   │   ├── privacy/page.tsx                  ← Privacy policy page
│   │   ├── terms/page.tsx                    ← Terms of service page
│   │   │
│   │   └── components/
│   │       ├── BusinessSwitcher.tsx          ← Multi-business dropdown (compact/full)
│   │       ├── CurrencySelector.tsx          ← Currency picker dropdown
│   │       ├── CurrencyDisplay.tsx           ← Format amount by currency
│   │       ├── Scanner.tsx                   ← OCR receipt scanner (Tesseract.js)
│   │       ├── ThemeToggle.tsx               ← Dark/light mode switch
│   │       ├── ErrorBoundary.tsx             ← React error boundary wrapper
│   │       ├── GlobalErrorToast.tsx          ← App-wide error notifications
│   │       ├── PWAInstallPrompt.tsx          ← Add to home screen prompt
│   │       ├── BankSyncCard.tsx              ← Bank connection status + sync trigger card
│   │       ├── CookieBanner.tsx              ← GDPR/cookie consent banner
│   │       └── PlanGate.tsx                  ← Lock features by plan tier
│   │
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx                    ← Primary reusable button
│   │   │   ├── Input.tsx                     ← Form text input
│   │   │   ├── Select.tsx                    ← Dropdown select field
│   │   │   ├── Modal.tsx                     ← Slide-up modal sheet
│   │   │   ├── Badge.tsx                     ← Status / type badge
│   │   │   ├── AmountDisplay.tsx             ← Currency-formatted amount
│   │   │   ├── CalculatorInput.tsx           ← Number input for calculator
│   │   │   ├── EmptyState.tsx                ← Empty list placeholder UI
│   │   │   ├── LoadingSkeleton.tsx           ← Shimmer loading placeholder
│   │   │   ├── LoadingSpinner.tsx            ← Spinner animation
│   │   │   └── PageTransition.tsx            ← Page fade-in animation
│   │   │
│   │   └── payments/
│   │       └── UpgradeModal.tsx              ← Full Razorpay payment flow UI
│   │
│   ├── lib/
│   │   ├── db.ts                             ← SQLite connection, migrations, seed (sync, legacy)
│   │   ├── db.async.ts                       ← Async Promise wrapper around db.ts (current default import)
│   │   ├── db.postgres.ts                    ← Future PostgreSQL layer (pg Pool) — prepped, not yet wired in
│   │   ├── audit.ts                          ← RBI compliance audit logging (audit_logs table)
│   │   ├── razorpay.ts                       ← Razorpay client initialization
│   │   ├── schemas.ts                        ← Zod validation schemas
│   │   ├── schemas/index.ts                  ← Schema barrel exports
│   │   │
│   │   ├── setu/
│   │   │   └── client.ts                     ← Setu Account Aggregator API client
│   │   │
│   │   ├── auth/
│   │   │   ├── password.ts                   ← bcrypt hash + verify functions
│   │   │   └── session.ts                    ← JWT sign + verify helpers
│   │   │
│   │   ├── email/
│   │   │   └── resend.ts                     ← All email templates:
│   │   │                                        - Welcome email
│   │   │                                        - Email verification
│   │   │                                        - Password reset
│   │   │                                        - Plan upgrade confirmation
│   │   │                                        - Weekly financial recap
│   │   │
│   │   ├── contexts/
│   │   │   ├── BusinessContext.tsx           ← Active business global state
│   │   │   ├── CurrencyContext.tsx           ← User currency preference
│   │   │   ├── PlanContext.tsx               ← Plan features and gates
│   │   │   └── ThemeContext.tsx              ← Dark/light theme state
│   │   │
│   │   ├── hooks/
│   │   │   └── useLocalStorage.ts            ← Persistent browser storage hook
│   │   │
│   │   └── utils/
│   │       └── format.ts                     ← cn(), currency formatters
│   │
│   └── types/
│       └── index.ts                          ← TypeScript interfaces:
│                                                Transaction, Category, Business,
│                                                DashboardSummary, CategorySpend,
│                                                DailyCashflow, User
│
├── android/                                  ← Capacitor Android project
├── ios/                                      ← Capacitor iOS project
├── public/                                   ← Static assets
│   ├── logos/                                ← App icons, SVG marks
│   ├── manifest.json                         ← PWA manifest
│   └── sw.js                                 ← Service worker (PWA)
├── src/migrations/                           ← SQL migration files
├── capacitor.config.ts                       ← Capacitor configuration
├── next.config.js                            ← Next.js configuration
├── tailwind.config.ts                        ← Tailwind configuration
├── tsconfig.json                             ← TypeScript configuration
└── package.json                              ← Dependencies
```

**Total: 130 TypeScript/TSX source files**

---

## 5. DATABASE DESIGN

**Database:** SQLite (file: `moneylix.db`) — WAL mode, foreign keys enabled. Accessed through an async wrapper (`db.async.ts`) so routes are forward-compatible with the prepped PostgreSQL layer (`db.postgres.ts`).

### Tables

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `users` | id, username, email, password (bcrypt), role, created_at | All user accounts |
| `sessions` | id, user_id, token, expires_at | JWT session management |
| `businesses` | id, user_id, name, created_at | User businesses |
| `transactions` | id, user_id, business_id, type, amount, category_id, date, note, method, tags, status, currency | All financial records |
| `categories` | id, user_id, name, type (credit/debit/both), color | Transaction categories |
| `subscriptions` | id, user_id, plan, status, expires_at, amount_paid, payment_method | Plan billing records |
| `password_resets` | id, user_id, token, expires_at, used_at | Reset email tokens |
| `notifications` | id, user_id, type, message, read_at | In-app notifications |
| `support_tickets` | id, user_id, subject, message, status | Help requests |
| `feature_requests` / `feature_votes` | id, user_id, feature, voted_at | Feature request votes |
| `currencies` | code, name, symbol | Supported currency list |
| `user_settings` | user_id, key, value | Per-user key/value preferences |
| `bank_connections` | id, user_id, consent_id, status, fip_id, masked_account_number, bank_name, consent_expiry, last_synced_at | Setu AA bank account links |
| `bank_transactions` | id, bank_connection_id, user_id, txn_id, type, amount, date, narration, category_id, ai_category_suggestion, ai_confidence, is_categorised, linked_transaction_id, is_duplicate, ignored | Statement lines fetched from banks |
| `recurring_transactions` | id, user_id, business_id, type, amount, category_id, frequency, interval_value, start_date, end_date, next_run_date, last_run_date, total_generated, status | Scheduled/recurring transaction templates |
| `audit_logs` | id, user_id, action, category, resource_type, resource_id, status, ip_address, created_at | RBI compliance audit trail (consent, data access, admin actions) |
| `schema_migrations` | version, name, applied_at | DB migration tracking |

### Key Relationships
```
users ──< businesses ──< transactions >── categories
users ──< sessions
users ──< subscriptions
users ──< password_resets
users ──< bank_connections ──< bank_transactions >── categories
                                     │
                                     └──> linked_transaction_id ──> transactions
users ──< recurring_transactions >── categories
users ──< audit_logs
```

---

## 6. API REFERENCE

### Authentication APIs

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | Public | Create new account |
| POST | `/api/auth/login` | Public | Login → returns JWT token |
| GET | `/api/auth/me` | Bearer | Get logged-in user profile |
| POST | `/api/auth/forgot-password` | Public | Send password reset email |
| POST | `/api/auth/reset-password` | Public | Set new password via token |
| GET | `/api/auth/verify-email` | Public | Verify email via token |
| POST | `/api/auth/demo` | Public | Instant demo login |

### Business APIs

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/businesses` | Bearer | List user's businesses |
| POST | `/api/businesses` | Bearer | Create new business |
| PUT | `/api/businesses/:id` | Bearer | Rename business |
| DELETE | `/api/businesses/:id` | Bearer | Delete business |

### Transaction APIs

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/transactions` | Bearer | List with filters, pagination, search |
| POST | `/api/transactions` | Bearer | Create transaction |
| PUT | `/api/transactions/:id` | Bearer | Update transaction |
| DELETE | `/api/transactions/:id` | Bearer | Delete transaction |
| POST | `/api/transactions/bulk` | Bearer | Bulk create (CSV import) |
| PUT | `/api/transactions/bulk` | Bearer | Bulk update category |

### Recurring Transaction APIs

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/recurring` | Bearer | List recurring transaction schedules |
| POST | `/api/recurring` | Bearer | Create a recurring schedule |
| PATCH | `/api/recurring/:id` | Bearer | Update / pause / resume a schedule |
| DELETE | `/api/recurring/:id` | Bearer | Delete a schedule |
| GET | `/api/cron/process-recurring` | Cron secret | Generate due transactions from active schedules |

### Bank Sync APIs (Setu Account Aggregator, Pro+)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/bank/create-consent` | Bearer | Start AA consent flow with Setu |
| GET | `/api/bank/consent-status` | Bearer | Poll consent approval status |
| GET | `/api/bank/connections` | Bearer | List linked bank connections |
| DELETE | `/api/bank/connections` | Bearer | Revoke / remove a connection |
| POST | `/api/bank/sync` | Bearer | Fetch latest statement from the FIP |
| GET | `/api/bank/sync-status` | Bearer | Poll sync progress / result |
| GET | `/api/bank/transactions` | Bearer | List fetched bank transactions |
| POST | `/api/bank/categorise` | Bearer | AI-categorise uncategorised bank transactions |
| POST | `/api/bank/setu-webhook` | Signature | Setu AA notification webhook (consent/data events) |

### User Profile APIs

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/user/profile` | Bearer | Get name, email, account info |
| PUT | `/api/user/profile` | Bearer | Update name / email / password |
| POST | `/api/user/delete-account` | Bearer | Permanently delete account and all data |
| GET | `/api/user/plan` | Bearer | Current plan + expiry date |
| GET | `/api/user/notifications` | Bearer | In-app notifications |

### Dashboard & Charts

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/dashboard` | Bearer | Total balance, income, expense |
| GET | `/api/charts` | Bearer | Daily cashflow + category breakdown |
| GET | `/api/overall` | Bearer | Cross-business totals |

### Payment APIs

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/payments/create-order` | Bearer | Create Razorpay order |
| POST | `/api/payments/verify` | Bearer | Verify payment + activate plan |
| POST | `/api/payments/webhook` | Signature | Handle Razorpay events |

### Admin APIs (all require admin session)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/login` | Admin login (bcrypt) |
| POST | `/api/admin/change-password` | Change admin password |
| GET | `/api/admin/stats` | Platform KPIs |
| GET | `/api/admin/users` | All user accounts |
| PUT/DELETE | `/api/admin/users/:id` | Edit or remove a user |
| GET/POST | `/api/admin/admins` | List / create admin accounts |
| DELETE | `/api/admin/admins/:id` | Remove an admin account |
| GET | `/api/admin/subscriptions` | All subscriptions |
| POST | `/api/admin/broadcast` | Send message to all users |
| GET/POST | `/api/admin/features` | Feature flags / vote counts |
| GET | `/api/admin/tickets` | Support tickets |

---

## 7. FEATURES BY PAGE

### Landing Page (`/`)
- Marketing page with hero, stats, feature sections, pricing, security
- Detects Capacitor native app → redirects to `/auth/login` directly
- Responsive — desktop and mobile optimized

### Login (`/auth/login`)
- Email/username + password login
- Demo mode (instant access)
- Forgot password link
- Email verification resend
- Compact design for mobile

### Register (`/auth/register`)
- Username, email, password
- Email verification flow

### Dashboard (`/dashboard`)
- Welcome panel with business name, search, export, add transaction
- 4 stat cards: Total Balance, Monthly Income, Monthly Expense, Savings Rate
- Cash flow bar chart (last 7 / 30 days)
- Spending split donut chart
- Recent transactions list (compact cards on mobile)

### Transactions (`/dashboard/transactions`)
- Full transaction list with search, filter, sort, pagination
- Add / Edit / Delete modal
- Bulk select → bulk delete or bulk category change
- Export CSV / JSON
- Import CSV
- OCR receipt scanner (Premium)
- Mobile: compact card view (no horizontal scroll)
- Desktop: full table with all columns

### Categories (`/dashboard/categories`)
- Income and Expense categories
- Custom colors
- Add / Edit / Delete

### Receivables (`/dashboard/receivables`)
- Track pending client payments
- Due date and reminder days
- Mark as paid
- Shows amount in mobile header badge

### Overall (`/dashboard/overall`)
- Cross-business combined view
- Total balance across all businesses

### Bank Sync (`/dashboard/bank`) — Pro & Premium
- Connect bank accounts via Setu Account Aggregator (RBI-regulated consent flow)
- `BankSyncCard` shows connection status, masked account number, last sync time
- Manual "Sync now" trigger + sync progress polling
- Fetched bank transactions list with AI-suggested categories and confidence score
- One-click confirm/edit category, link to an existing manual transaction, or ignore/flag duplicate
- `/dashboard/bank/status` — handles redirect back from Setu consent approval and shows status
- All consent/data-fetch events written to the RBI compliance audit trail

### Recurring Transactions (`/dashboard/recurring`)
- Create scheduled transaction templates (daily / weekly / monthly / yearly, custom interval)
- Set start date, optional end date, and day-of-week / day-of-month / month-of-year rules
- Pause, resume, edit, or delete a schedule
- Shows next run date and total transactions generated so far
- Background cron (`/api/cron/process-recurring`) auto-creates due transactions

### Profile (`/dashboard/profile`)
- View and edit display name and email
- Change password
- Permanently delete account and all associated data (with confirmation)

### AI Advisor (`/dashboard/ai`)
- Powered by Anthropic Claude
- Natural language financial chat
- Investment recommendations (SIP, Gold, FD, PPF)
- Personalized to user income and savings

### Calculator (`/dashboard/calculator`)
- Standard financial calculator
- Calculation history

### Settings (`/dashboard/settings`)
- Currency selector (INR, USD, EUR, GBP, etc.)
- Data export (CSV / JSON)
- Data import (CSV)
- Links to Profile, Categories, Receivables, Calculator, Plans, Help
- Logout button (mobile only)

### Cookie Policy (`/cookie-policy`)
- Cookie usage disclosure, shown via `CookieBanner` consent prompt site-wide

### Pricing (`/dashboard/pricing`)
- Free / Pro / Premium plan cards
- Razorpay payment integration
- Annual and monthly billing

### Admin Panel (`/admin`)
- Platform KPIs (users, revenue, transactions)
- Plan distribution chart
- Renewal alerts (expiring plans)
- Recent user registrations
- Change admin password widget
- User management
- Subscription management
- Broadcast messaging

---

## 8. PRICING PLANS

| Feature | Free | Pro (₹199/mo) | Premium (₹499/mo) |
|---------|------|----------------|-------------------|
| Businesses | 1 | 3 | Unlimited |
| Transactions | ✓ | ✓ | ✓ |
| Dashboard | Basic | Full | Full |
| Categories | View only | Edit | Edit |
| Reports | ✗ | ✓ | ✓ |
| Receivables | ✗ | ✓ | ✓ |
| Bank Sync (Setu AA) | ✗ | ✓ | ✓ |
| Export CSV | ✗ | ✓ | ✓ |
| Export JSON | ✗ | ✗ | ✓ |
| AI Advisor | ✗ | ✗ | ✓ |
| OCR Scanner | ✗ | ✗ | ✓ |
| Priority Support | ✗ | ✗ | ✓ |

**Annual Billing:**
- Pro Annual: ₹1,788 (save ₹600)
- Premium Annual: ₹3,588 (save ₹2,400)

---

## 9. MOBILE APP

### Platform
- **iOS** — Capacitor 8.x WebView → App Store (in review)
- **Android** — Capacitor 8.x WebView → Play Store (pending upload)

### Native Detection
```typescript
const cap = (window as any).Capacitor
const isNative = cap?.isNativePlatform?.()
```

### Mobile-Specific UI (native app only)
- Bottom navigation bar (5 tabs: Home, Transactions, Bank, AI, Settings)
- Center FAB (+) button → Add Transaction
- App header: Logo + Business Switcher + Notification Bell + Avatar
- Backdrop blur when business switcher opens
- Safe area handling for iPhone notch (`env(safe-area-inset-top)`)
- Compact card layout for transactions (no horizontal scroll)

### iOS Build
- Built via **Codemagic** CI/CD (cloud Mac — no Mac required)
- Certificate: Apple Distribution (`ios_distribution.p12`)
- Provisioning Profile: App Store distribution
- Bundle ID: `in.moneylix.app`
- TestFlight: Build #5 approved and live

### Android Build
- Signed APK via `moneylix.jks` (password: MoneyLix@1152)
- Built locally with Android Studio

---

## 10. SERVER & DEPLOYMENT

### Infrastructure
```
Proxmox VE 9.0.11
└── Node: pve2
    └── VM 104 — abishek-ubuntu1
        ├── OS: Ubuntu 22.04 LTS
        ├── CPU: 4 vCPUs
        ├── RAM: 4 GB
        ├── Disk: 200 GB
        └── IP: 192.168.86.245 (LAN)
            Public: 172.91.220.192
```

### Access
- Proxmox Panel: `https://192.168.86.110:8006`
- SSH: `ssh moneyflow@192.168.86.245` (via Proxmox Console → VM 104)
- User: `moneyflow`

### App Location
```
/home/moneyflow/moneylix/     ← Application root
/home/moneyflow/moneylix/moneylix.db  ← SQLite database
```

### Process Management
```bash
pm2 status              # view all processes
pm2 restart moneylix    # restart app
pm2 logs moneylix       # view logs
pm2 save                # save process list
```

### Deploy Command
```bash
cd /home/moneyflow/moneylix && git pull && npm run build && pm2 restart moneylix
```

### Nginx Configuration
- Reverse proxy: `443 (HTTPS) → localhost:3006`
- SSL: Let's Encrypt (expires: 2026-08-06)
- DNS: Cloudflare → `moneylix.in`

### Environment Variables (`.env.local` on server)
```
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
RESEND_API_KEY=re_...
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_APP_URL=https://moneylix.in
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
SECRET_COOKIE_PASSWORD=...
```

---

## 11. EMAIL SYSTEM

**Provider:** Resend (`noreply@moneylix.in`)

| Email | Trigger | Content |
|-------|---------|---------|
| Welcome | On register | Account created confirmation |
| Email Verification | On register | Verify email link (expires 24h) |
| Password Reset | Forgot password | Reset link (expires 1 hour) |
| Plan Upgrade | Payment verified | Plan name + next billing date |
| Weekly Recap | Cron (weekly) | Income, expenses, pending receivables |

---

## 12. SECURITY

| Area | Implementation |
|------|---------------|
| Passwords | bcrypt (cost factor 12) |
| Sessions | JWT tokens (7 day expiry) |
| Admin Auth | Separate bcrypt + session system |
| API Auth | Bearer token on all private routes |
| Payment Verification | HMAC-SHA256 signature verification |
| Webhook Verification | Razorpay signature check |
| Rate Limiting | Upstash Redis per IP |
| Input Validation | Zod schemas on all API inputs |
| Data Isolation | All queries scoped by user_id |
| HTTPS | Let's Encrypt SSL everywhere |

---

## 13. PENDING & FUTURE WORK

### Immediate (configuration only)
- [ ] Add Resend API key to server `.env.local` → email will work
- [ ] Add Razorpay live keys to server `.env.local` → live payments
- [ ] Add Razorpay webhook secret → webhook verification
- [ ] Change admin password from default via `/admin` panel

### App Store
- [ ] Complete iOS App Store listing (description, screenshots) → submit
- [ ] Upload Android APK to Play Store → fill listing → submit

### Recently Completed (since June 1)
- [x] User profile page (`/dashboard/profile` — change name, email, password, delete account)
- [x] Recurring/scheduled transactions (`/dashboard/recurring` + cron generator)
- [x] Bank auto-import via Setu Account Aggregator (`/dashboard/bank` — Pro+, RBI audit-logged)
- [x] RBI compliance audit logging (`audit_logs` table + `src/lib/audit.ts`)
- [x] Cookie consent banner + cookie policy page
- [x] Async DB layer (`db.async.ts`) + PostgreSQL layer prepped (`db.postgres.ts`, uses `pg`)

### Future Features
- [ ] Push notifications for receivable due dates
- [ ] PDF export for reports
- [ ] Multi-currency conversion
- [ ] Tax/GST calculation module
- [ ] Cut over from `db.async.ts` (SQLite) to `db.postgres.ts` (PostgreSQL) when ready
- [ ] Student/Phase 2 module (if applicable)

---

## PROJECT STATISTICS

| Metric | Value |
|--------|-------|
| Total source files | 130 |
| Total API endpoints | 55+ |
| Database tables | 16 |
| Git commits | 110 |
| Lines of code (est.) | ~11,000 |
| Build time | ~45 seconds |
| Bundle size (shared JS) | 87.3 kB |

---

*Moneylix Project Documentation v1.1 — Updated 2026-06-08*  
*Built with Next.js 14 · SQLite · Tailwind CSS · Capacitor · Razorpay · Claude AI · Setu AA*

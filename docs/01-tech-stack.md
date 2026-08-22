# 01 — Proposed Tech Stack

## Dayflow — HR Management System

### 1. Database recommendation & rationale

**Primary choice: PostgreSQL (hosted via Supabase) — used as the application's managed Postgres.**

This app's workload is fundamentally relational: employees, attendance, leave, and payroll share tight foreign-key relationships; payroll and attendance require `JOIN`s across several tables; role-based access cuts every query by `role`. Postgres provides:

- **Relational integrity** (FK constraints, `UNIQUE(employeeId, date)` on attendance to stop duplicate check-ins, `UNIQUE` on employee IDs).
- **JSONB** for flexible fields: document metadata, allowance/deduction breakdowns in the salary structure, audit-log payloads — without giving up joins on the structured columns.
- **Range types / indexable dates** for the leave-overlap problem and date-range reporting.
- Full-fidelity reporting: window functions, group-bys, and joins for attendance summaries and salary slips.

Supabase is chosen as the *host* because it wraps a managed Postgres 15/16 instance with storage buckets (profile pictures, uploaded documents) and a ready-made connection string — so we keep a plain Node/Express + Prisma + JWT API (full control over RBAC middleware, the leave→attendance transaction, payroll validation, and audit logging) while dodging self-administering a database server. We deliberately use Supabase **only** as database + storage, not its PostgREST/auth/RLS stack, because the business rules here (atomic "approve leave ⇒ update attendance", overlap prevention, per-field audit of admin edits) are clearest and most testable in application code.

**Trade-offs vs. the alternatives:**

| Option | Verdict | Why not primary |
|---|---|---|
| **Postgres / Supabase** | ✅ **Chosen** | Relational integrity, JSONB, reporting joins, managed host, storage. |
| MySQL / MariaDB | Acceptable | Similar relational fit, but no native JSONB and weaker array/range support for the flexible salary/audit fields. |
| SQLite | ❌ Dev-only | Fine for prototyping `DATABASE_URL=file:...`, not for multi-user production; no concurrency / hosting story. |
| MongoDB | ❌ Poor fit | Documents vary little here; payroll/attendance reporting is join- and aggregate-heavy where Mongo is weakest; token/transaction behavior is weaker. |
| Firebase Firestore | ❌ MVP-only | Schemaless + no SQL; the complex relational reports this spec requires are painful to express. |
| Supabase *full stack* | Not chosen | Postgres+storage (+auth/RLS) is tempting, but moves RBAC/business rules into RLS policies that are harder to write for cross-table transactions (see schema & API docs). |

### 2. Frontend

- **React 18 + TypeScript + Vite** — single-page app.
- **React Router v6** — role-aware route guards (`<RequireAuth role="HR">`).
- **TanStack Query** — server-state cache for lists/dashboards.
- **Axios** — typed API client with JWT interceptor + 401 refresh/redirect.
- **Tailwind CSS** — responsive (mobile + desktop) utility-first styling.
- **Recharts** — lightweight charts for the reports/analytics page.

### 3. Backend

- **Node.js (22) + Express + TypeScript** — REST API.
- **Prisma ORM** — schema, migrations, type-safe queries against Postgres (`DATABASE_URL`).
- **Zod** — request validation/sanitization at every route boundary (reject unknown/oversized input).
- **bcryptjs** (pure-JS, no native build issues on Windows) — password hashing.
- **jsonwebtoken** — short-lived access token (15 min) + refresh token.
- **nodemailer** — transactional email (verification, leave decisions). SMTP configured via env; in dev, logs to console / Mailpit.

### 4. Auth strategy

- **Password rules:** min 8 chars, at least one uppercase, one lowercase, one digit, one symbol (validated on signup + password change).
- **Password storage:** bcrypt cost 12.
- **Email verification:** on signup, store a time-limited, single-use token and mark user `UNVERIFIED`; a verify endpoint activates the account. Logged-in-but-unverified users are sent to a "verify email" screen; unverified users cannot use HR features.
- **Session:** access JWT (15 min) + rotating refresh JWT (7 d, hashed at rest, revocable). Access tokens carry `sub` (userId) + `role` so RBAC middleware is a single check.
- **RBAC everywhere:** `requireAuth` (JWT valid) + `requireRole('HR' | 'EMPLOYEE')` middleware guards every protected route *and* every write path — not just the frontend. A user id check (`req.user.id === :employeeId` or role `HR`) prevents horizontal privilege escalation.
- **Security hygiene:** Helmet, CORS allowlist, rate limiting on auth routes, generic auth errors ("invalid credentials", not "user not found"), input length caps, `.env` secrets never committed.

### 5. Misc / operations

- `dotenv`, `cors`, `helmet`, `express-rate-limit`, `winston` (structured logs).
- Environment-based config via `.env` / `.env.example` (dev / staging / prod).
- CSV export for reports via `fast-csv`.
- Unit-ish testing on the API with **Vitest + Supertest** (DB exercised via a dedicated test database).
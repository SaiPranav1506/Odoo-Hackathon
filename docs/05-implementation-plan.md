# 05 — Step-by-step Implementation Plan

Phased and dependency-ordered. Each phase ends with something runnable/verifiable. Marked against the functional-requirements checklist.

---

## Phase 0 — Scaffold & foundation *(task 2)*
- Root npm workspace; `apps/api` + `apps/web` skeletons.
- Typed `env` loader (zod) reading `DATABASE_URL` (Supabase Postgres), `JWT_SECRET`, `SMTP_*`, `PORT`, storage creds.
- Prisma schema (docs/02) + `prisma validate`; `.env.example`.
- API bootstrap: helmet, cors, rate-limit, error handler, health check, `/api/v1` router.
- **Exit:** `GET /health` returns ok; `npx prisma validate` passes; TS compiles.

## Phase 1 — Auth & RBAC ✓ *(task 3)*
- `password.ts` (bcrypt, complexity validator) → signup → verification token + nodemailer email → verify-email → login (access+refresh) → refresh → logout → `me`.
- `middleware/auth.ts` (requireAuth), `middleware/rbac.ts` (requireRole), `middleware/validate.ts` (zod).
- Verification-only gating for unverified users.
- **Covers checklist:** 1 (all), 8 (password hashing, validation, RBAC middleware).
- **Exit:** signup→verify→login→authorized call round-trips.

## Phase 2 — Employee profiles + audit ✓ *(task 4)*
- Read `GET /employees/:id` (self-scoping + HR).
- Self-edit: server-side field allow-list (address, phone, picture) — any other field rejected for EMPLOYEE.
- HR edit: all fields; PATCH writes `AuditLog` per changed field (actor, old/new).
- Create/list/switch-view endpoints; document upload (storage); profile-picture signed URL.
- **Covers checklist:** 3 (view, limited self-edit, admin all-fields, audit), 2 (admin dashboard data share).
- **Exit:** employee changes own phone → HR sees audit entry; HR edits salary dept → audited.

## Phase 3 — Attendance ✓ *(task 5)*
- `check-in` / `check-out` + status auto-roll; `AttendanceRecord` `UNIQUE(employeeId,date)`.
- `daily` / `weekly` / `my` (self) views; admin `GET /attendance` with filters + pagination; `summary`.
- **Covers checklist:** 4 (all).
- **Exit:** check-in twice blocked; admin filters by range/employee.

## Phase 4 — Leave ✓ *(task 6)*
- `POST /leave` with overlap + balance validation (availability.service).
- `PATCH /leave/:id/decide`: **transaction** — approve → attendance `LEAVE` records (linked) + balance update drove in one tx; reject → no attendance change. Notification + email on decision.
- Admin list with status filters; employee list.
- **Covers checklist:** 5 (all) + 7 (notify).
- **Exit:** overlapping apply rejected; approve → attendance shows LEAVE for those days.

## Phase 5 — Payroll ✓ *(task 7)*
- Read-only `GET /payroll/me`; admin structure read/update (validation: amounts ≥0, tax ∈[0,100]); payslip generation with gross/net math + duplicate-period guard; audit + notify on change.
- **Covers checklist:** 6 (all) + 8 (validation).
- **Exit:** employee PATCH to payroll route is 403; admin update validates + notifies + audits.

## Phase 6 — Notifications & Reporting ✓ *(task 8)*
- In-app `Notification` feed + unread badge; read/read-all.
- Email via nodemailer (dev → console) for verification + leave decisions + salary change.
- Reports: attendance & leave summaries; salary slips; `fast-csv` CSV exports.
- **Covers checklist:** 7 (all), 8 (reporting export).
- **Exit:** notification persists on leave decision; attendance CSV downloads.

## Phase 7 — Frontend ✓ *(task 9)*
- Auth screens (login/signup/verify) + `AuthContext` + `RequireAuth`/`RequireRole` guards.
- Employee dashboard cards (Profile, Attendance, Leave, Logout) + activity feed; Admin dashboard (employee list, attendance overview, pending approvals, impersonate view).
- Feature pages for employee & HR per module; responsive (Tailwind); Toasts for feedback; 401 → refresh → redirect.
- **Covers checklist:** 2 (dashboards), responsive NFR.
- **Exit:** role drives visible nav; full flows clickable end-to-end.

## Phase 8 — Seed, tests & polish ✓ *(task 10)*
- `prisma seed` (HR + demo employees + data); Vitest+Supertest auth/leave/payroll happy + negative paths.
- README run instructions; `.env.example`; final pass over NFRs (rate limits, validation, generic errors, pagination everywhere).
- **Covers checklist:** 8 (env config, pagination, scalability).
- **Exit:** `npm run build` green; smoke tests pass; README runnable.

---

## Build order & risk notes
- Backend before frontend; contracts fixed by docs/03 so UI can be parallelized later.
- Highest-risk logic is **Phase 4's atomic approve→attendance transaction** and **Phase 2's field-level audit** — both front-loaded and covered by tests in Phase 8.
- DB runtime migration needs the user-supplied Supabase `DATABASE_URL` (from the hybrid choice); everything before that is `prisma validate` + `tsc` verifiable.
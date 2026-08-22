# 04 — Recommended Project / Folder Structure

Monorepo with two runnable apps (`apps/api`, `apps/web`) + shared config. Managed by a root `package.json` with npm workspaces (no extra toolchain required on Windows).

```
Dayflow/
├─ package.json                 # npm workspaces root (build/test scripts)
├─ README.md
├─ docs/                        # this design + API reference
│  ├─ 01-tech-stack.md
│  ├─ 02-database-schema.md
│  ├─ 03-api-routes.md
│  ├─ 04-folder-structure.md
│  └─ 05-implementation-plan.md
│
├─ apps/
│  ├─ api/                      # Express + TS backend
│  │  ├─ package.json
│  │  ├─ tsconfig.json
│  │  ├─ .env.example           # DATABASE_URL, JWT_SECRET, SMTP_*, PORT
│  │  ├─ prisma/
│  │  │  ├─ schema.prisma       # models in docs/02
│  │  │  ├─ migrations/         # generated SQL
│  │  │  └─ seed.ts             # demo HR + employees + data
│  │  └─ src/
│  │     ├─ server.ts           # bootstrap (helmet, cors, routers, error handler)
│  │     ├─ app.ts              # express app construction (testable)
│  │     ├─ config/
│  │     │  └─ env.ts           # typed env loading + zod validation
│  │     ├─ lib/
│  │     │  ├─ prisma.ts        # PrismaClient singleton
│  │     │  ├─ password.ts      # bcrypt helpers
│  │     │  ├─ tokens.ts        # sign/verify access+refresh (JWT)
│  │     │  ├─ mailer.ts        # nodemailer (SMTP; logs in dev)
│  │     │  └─ storage.ts       # Supabase storage signed-URL helpers
│  │     ├─ middleware/
│  │     │  ├─ auth.ts          # requireAuth
│  │     │  ├─ rbac.ts          # requireRole
│  │     │  ├─ validate.ts      # zod body(query/params) wrapper
│  │     │  ├─ error.ts         # AppError + central handler
│  │     │  └─ rateLimit.ts
│  │     ├─ modules/
│  │     │  ├─ auth/        { router, controller, service }
│  │     │  ├─ admin/       { router, controller, service }   # admin dashboard
│  │     │  ├─ employees/   { router, controller, service, audit.service }
│  │     │  ├─ attendance/  { router, controller, service }
│  │     │  ├─ leave/       { router, controller, service, availability } # overlap validation
│  │     │  ├─ payroll/     { router, controller, service, calculator }    # payslip math
│  │     │  ├─ notifications/{ router, controller, service }
│  │     │  └─ reports/     { router, controller, service }                # + csv export
│  │     ├─ middleware/… (editable guard on modules)
│  │     └─ utils/          (pagination, date math, apiError)
│  │
│  └─ web/                       # React + Vite + TS frontend
│     ├─ package.json
│     ├─ tsconfig.json
│     ├─ index.html
│     ├─ vite.config.ts         # dev proxy → http://localhost:4000
│     └─ src/
│        ├─ main.tsx
│        ├─ App.tsx             # router + auth provider
│        ├─ api/
│        │  ├─ client.ts        # axios + JWT interceptor
│        │  ├─ auth.ts / employees.ts / attendance.ts / leave.ts / payroll.ts / notifications.ts / reports.ts
│        │  └─ types.ts         # TS types mirroring API responses
│        ├─ auth/               # Login, SignUp, VerifyEmail, RequireAuth, RequireRole, AuthContext
│        ├─ components/         # shared UI: Layout, Sidebar, Topbar, Cards, Table, Pagination, StatTile, Badge, Modal, Toast
│        ├─ features/
│        │  ├─ dashboard/       # employee + admin dashboards
│        │  ├─ employees/       # list + detail + admin edit
│        │  ├─ attendance/      # my + admin views, check-in/out
│        │  ├─ leave/           # apply, my list, admin approvals
│        │  ├─ payroll/         # my payslip (RO), admin structure edit
│        │  ├─ notifications/   # feed + badge
│        │  └─ reports/         # attendance + payroll reports w/ export buttons
│        ├─ styles/index.css    # Tailwind
│        └─ hooks/              # useAuth, usePagination, useNotify
```

### Why this shape
- **`modules/` feature folders** on the API keep each business area self-contained (router → controller → service); RBAC lives in `middleware/` and is applied in the router, so no route can forget it.
- **Services, not controllers**, own all DB writes + audit + notifications — keeps transactional logic (approve-leave→attendance) testable without HTTP.
- **Frontend mirrors domain namespaces** (`features/<domain>`) so a feature touches one folder.
- **Root npm workspaces** install once; `vite` dev-proxies `/api` to Express; single `npm run build` builds both.
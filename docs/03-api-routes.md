# 03 — API Route / Endpoint Plan with RBAC

Base path: `/api/v1`. All routes except `auth/signup`, `auth/verify-email`, `auth/login` are behind `requireAuth`. Role gates are noted per route; every route is itself an authorization boundary (not UI-only).

Legend: **🧍** = EMPLOYEE, **🛡️** = HR/Admin. `:id` always means "the target employee's **userId**".

## Auth
| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/auth/signup` | public | employeeId, email, password, role. Validates password rules. Creates User(UNVERIFIED) + EmployeeProfile. Sends verification email. |
| GET | `/auth/verify-email?token=…` | public | Activates account if token valid & unexpired. |
| POST | `/auth/resend-verification` | 🧍🛡️ auth | re-send link (rate-limited). |
| POST | `/auth/login` | public | email + password → `{ accessToken, refreshToken, user }`. Errors are generic. Unverified users get `needsVerification:true`. |
| POST | `/auth/refresh` | public+ | rotate refresh token → new access token. |
| POST | `/auth/logout` | 🧍🛡️ | revoke refresh token. |
| GET | `/auth/me` | 🧍🛡️ | current user + profile summary + role. |

## Dashboard / activity
| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/dashboard/me` | 🧍 | quick-card data + recent activity/alerts feed (profile completeness, pending leave, recent approvals, unread notifications). |
| GET | `/dashboard/admin` | 🛡️ | employee count, attendance overview (today present/absent/leave), pending leave approvals, inactive accounts. |
| GET | `/employees/active` | 🛡️ | lightweight list for "switch into employee view". |

## Employee profiles
| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/employees/:id` | 🧍 self only · 🛡️ any | full profile (personal, job, salary, documents, picture). |
| PATCH | `/employees/:id` | 🧍 **self, limited fields only** (address, phone, profilePictureUrl) · 🛡️ any, **all fields** | Field allow-list on self-edit is enforced server-side. Profile update creates an `AuditLog`; includes `lastAudits` on read. |
| GET | `/employees?page&pageSize&search&department&status` | 🛡️ | paginated list (admin dashboard + management). |
| POST | `/employees` | 🛡️ | create employee (creates user+profile). |
| GET | `/employees/:id/audit` | 🛡️ | audit trail for an employee. |
| POST | `/employees/:id/documents` | 🧍 self · 🛡️ any | upload document (metadata + storage ref). |
| DELETE | `/employees/:id/documents/:docId` | 🧍 self · 🛡️ any | delete. |
| POST | `/storage/profile-picture` | 🧍🛡️ | upload avatar → signed URL. |

## Attendance
| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/attendance/daily` | 🧍 self | today (check-in/out status). |
| GET | `/attendance/my` | 🧍 self | own history; `?from&to` range; paginated. |
| POST | `/attendance/check-in` | 🧍 | sets today's check-in (fails if already checked in). |
| POST | `/attendance/check-out` | 🧍 | sets check-out (fails if not checked in; status autos to HALF_DAY if < half-shift). |
| GET | `/attendance/weekly/my` | 🧍 self | current week summary. |
| GET | `/attendance` | 🛡️ | all records; `?employeeId&from&to&status&page&pageSize` filters; paginated. |
| GET | `/attendance/summary` | 🛡️ | aggregate counts by status over a range (for reports). |

## Leave
| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/leave/my` | 🧍 self | own requests; `?status` filter; paginated. |
| POST | `/leave` | 🧍 | apply: type, startDate, endDate, reason. Validates balance + overlap (rejects overlapping PENDING/APPROVED). |
| GET | `/leave/:id` | 🧍 owner · 🛡️ any | detail incl. admin comment. |
| GET | `/leave` | 🛡️ | all requests; `?status&employeeId&from&to&page&pageSize`; paginated. |
| PATCH | `/leave/:id/decide` | 🛡️ | body `{ status: APPROVED\|REJECTED, comment }`. **Atomic:** on approve, creates/updates `AttendanceRecord.status=LEAVE` for each date in range (linked via `leaveRequestId`) and increments `LeaveBalance`; rejects snap existing (no attendance changes). Writes notification to requester + email. |
| GET | `/leave/balance` | 🧍 self · 🛡️ any | entitlement vs used. |

## Payroll
| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/payroll/me` | 🧍 **read-only** | own salary structure + payslips. |
| GET | `/payroll` | 🛡️ | all salary structures; paginated. |
| GET | `/payroll/employees/:id` | 🛡️ | one employee's structure + payslips. |
| PUT | `/payroll/employees/:id/structure` | 🛡️ | update salary structure. Validates non-negative amounts + tax in [0,100]; writes AuditLog + notifies employee. |
| POST | `/payroll/payslips` | 🛡️ | generate payslip for a period (validates no duplicate for `(employeeId, period)`, computes gross/net from structure). |

## Notifications
| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/notifications` | 🧍🛡️ (scoped to self) | paginated feed. |
| GET | `/notifications/unread-count` | self | badge. |
| PATCH | `/notifications/:id/read` | self | mark one read. |
| PATCH | `/notifications/read-all` | self | mark all read. |

## Reports
| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/reports/attendance?from&to&employeeId` | 🛡️ | summary counts + daily detail. |
| GET | `/reports/attendance/export` | 🛡️ | CSV download. |
| GET | `/reports/leave?from&to` | 🛡️ | leave stats by type/status. |
| GET | `/reports/payroll?period` | 🛡️ | payroll totals; payslip list. |
| GET | `/reports/payroll/export` | 🛡️ | CSV download. |

## Cross-cutting RBAC rules
1. `requireAuth` → verifies access JWT; if expired but a valid refresh cookie is present, issues a fresh access token transparently.
2. `requireRole(...roles)` → 403 if guardian role absent.
3. **Self-scoping:** any `:id`/employee-resource route compares `req.user.id` against the resource owner unless role is HR. This is enforced in the controller/service, not the UI.
4. Every mutating route validates with Zod; unknown fields rejected; sizes/date-ranges enforced.
5. Storage routes return **signed URLs** only; raw bucket objects never reach the client.
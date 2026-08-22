# 02 — Database Schema Design

Relational model on **PostgreSQL**. Rendered for **Prisma**. Enums are native PG enums.

## Entities & relationships

```
User 1─1 EmployeeProfile 1─N {AttendanceRecord, LeaveRequest, Notification, Document}
EmployeeProfile 1─1 SalaryStructure
EmployeeProfile 1─N Payslip
EmployeeProfile 1─1 LeaveBalance
LeaveRequest N─1 User (decidedBy, nullable)   ← HR approver
AuditLog N─1 User (actor), N─1 EmployeeProfile (subject)
```

## Models

### enum Role `EMPLOYEE` | `HR`
### enum LeaveType `PAID` | `SICK` | `UNPAID`
### enum LeaveStatus `PENDING` | `APPROVED` | `REJECTED`
### enum AttendanceStatus `PRESENT` | `ABSENT` | `HALF_DAY` | `LEAVE`
### enum NotificationType `EMAIL_VERIFICATION` | `LEAVE_APPROVED` | `LEAVE_REJECTED` | `LEAVE_REQUESTED` | `PROFILE_UPDATED` | `SALARY_UPDATED` | `PAYSLIP_ISSUED`

### User
| field | type | notes |
|---|---|---|
| id | Int PK | |
| email | String @unique | login identity; lowercase enforced |
| passwordHash | String | bcrypt |
| role | Role | EMPLOYEE or HR |
| emailVerifiedAt | DateTime? | null until verified by email link |
| verificationToken | String? @unique | single-use, time-limited |
| verificationTokenExpiry | DateTime? | |
| refreshTokenHash | String? | rotating refresh token, revocable on logout |
| createdAt / updatedAt | | |

> The Employee entity is intentionally separate from auth `User`: HR staff may also be employees, and auth columns (password/tokens) are not profile data.

### EmployeeProfile
| field | type | notes |
|---|---|---|
| id | Int PK | |
| userId | Int @unique @relation(User) | |
| employeeId | String @unique | human id, e.g. `EMP-0001` |
| firstName / lastName / dateOfBirth / gender / phone / personalEmail | | personal |
| address | String | self-editable |
| department / jobTitle / hireDate / employmentType | | job details (admin-managed) |
| profilePictureUrl | String? | stored in Supabase storage bucket |
| status | EMPLOYEE_STATUS enum ACTIVE/INACTIVE | |
| @@index([department]) | | |

### AttendanceRecord
| field | type | notes |
|---|---|---|
| id | Int PK | |
| employeeId | FK | |
| date | DateTime @db.Date | date at local tz |
| checkInTime / checkOutTime | DateTime? | |
| status | AttendanceStatus | PRESENT/ABSENT/HALF_DAY/LEAVE |
| leaveRequestId | Int? FK | populated when a leave is approved for that date |
| note | String? | |
| **@@unique([employeeId, date])** | | prevents duplicate check-ins / records per day |
| @@index([date]) | | date-range reporting |
| @@index([employeeId, date]) | | per-employee history |

### LeaveRequest
| field | type | notes |
|---|---|---|
| id | Int PK | |
| employeeId | FK | |
| leaveType | LeaveType | PAID/SICK/UNPAID |
| startDate / endDate | DateTime @db.Date | inclusive |
| days | Int | inclusive count (business days, configurable) |
| reason | String | required |
| status | LeaveStatus | PENDING → APPROVED/REJECTED |
| adminComment | String? | HR note on decision |
| decidedBy | User? FK | who decided |
| decidedAt | DateTime? | |
| createdAt / updatedAt | | |

**Overlap prevention:** enforced in app code — a new request is rejected if the employee has another `PENDING` or `APPROVED` request whose `[startDate, endDate]` overlaps the new `[startDate, endDate]`. (A hard DB constraint on date ranges is not portable to Prisma/Supabase without a `EXCLUDE` constraint; we additionally plan an `EXCLUDE USING gist` in a migration for defense-in-depth.)

### LeaveBalance
| field | type | notes |
|---|---|---|
| id | Int PK | |
| employeeId | Int @unique FK | |
| paidDaysEntitled / paidDaysUsed / sickDaysUsed / unpaidDaysUsed | Int | |

### SalaryStructure
| field | type | notes |
|---|---|---|
| id | Int PK | |
| employeeId | Int @unique FK | |
| basicPay | Decimal @db.Decimal(12,2) | |
| housingAllowance / transportAllowance | Decimal | |
| otherAllowances | Json | flexible breakdown |
| taxPercent | Decimal | |
| otherDeductions | Json | flexible |
| effectiveFrom | DateTime @db.Date | |
| createdAt / updatedAt | | |

Kept version-minimal (1 row per employee, admin edits update in place + audit log). If retention of history is later required, this becomes a versioned `(employeeId, effectiveFrom)` table.

### Payslip
| field | type | notes |
|---|---|---|
| id | Int PK | |
| employeeId | FK | |
| period | String | e.g. `2026-08` (YYYY-MM) |
| gross / net | Decimal | derived and stored |
| components | Json | breakdown for the slip |
| issuedAt | DateTime | |
| @@unique([employeeId, period]) | | one slip per employee/month |

### Notification
| field | type | notes |
|---|---|---|
| id | Int PK | |
| recipientUserId | FK → User | |
| type | NotificationType | |
| title / body | String | |
| link | String? | deep-link route |
| readAt | DateTime? | in-app read state |
| createdAt | | |
| @@index([recipientUserId, readAt]) | | unread feed query |

### Document
| field | type | notes |
|---|---|---|
| id | Int PK | |
| employeeId | FK | |
| name / type / url / uploadedBy | | url → Supabase storage object |
| createdAt | | |

### AuditLog
| field | type | notes |
|---|---|---|
| id | Int PK | |
| actorUserId | FK → User | who changed |
| subjectEmployeeId | Int? FK → EmployeeProfile | whose record changed (null for auth/self events) |
| action | String | `PROFILE_UPDATE`, `SALARY_UPDATE`, `SALARY_READ`, … |
| field | String? | column changed (for per-field admin-edit tracking) |
| oldValue / newValue | Json? | before/after |
| metadata | Json? | client ip, user-agent |
| createdAt | | |
| @@index([subjectEmployeeId, createdAt]) | | |
| @@index([actorUserId, createdAt]) | | |

### Storage (Supabase buckets, not a table)
- `profile-pictures/` — `{userId}/{uuid}.{ext}` (private by default).
- `employee-documents/` — `{employeeId}/{uuid}.{slug}.{ext}` (private).
- URLs are served through the API (signed URLs) so storage is never exposed directly to the client.

## Indexing & scalability notes
- Pagination on all list endpoints (`cursor`/`offset` + `take`).
- Composite FK + date indexes cover the hot query paths (attendance/date, leave/status, notifications/unread).
- JSONB columns carry `gin` indexes where filtered (rare here) — kept minimal.
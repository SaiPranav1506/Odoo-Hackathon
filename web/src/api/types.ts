export type Role = 'EMPLOYEE' | 'HR';

export interface Me {
  user: PublicUser;
}

export interface PublicUser {
  id: number;
  email: string;
  role: Role;
  emailVerified: boolean;
  profile?: { employeeId?: string; firstName?: string; lastName?: string } | null;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: PublicUser;
  needsVerification: boolean;
}

export interface EmployeeProfile {
  id: number;
  userId: number;
  employeeId: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  gender?: string | null;
  phone?: string | null;
  personalEmail?: string | null;
  address?: string | null;
  department?: string | null;
  jobTitle?: string | null;
  hireDate?: string | null;
  employmentType?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  profilePictureUrl?: string | null;
  user?: { email?: string; role?: Role; emailVerifiedAt?: string | null };
  recentAudits?: AuditEntry[];
  documents?: DocumentMeta[];
  salaryStructure?: SalaryStructure | null;
}

export interface AuditEntry {
  id: number;
  action: string;
  field?: string | null;
  oldValue?: { origin?: string; v?: string } | null;
  newValue?: unknown;
  createdAt: string;
  metadata?: unknown;
  actor?: { email?: string; role?: Role };
}

export interface DocumentMeta {
  id: number;
  name: string;
  type: string;
  url: string;
  createdAt: string;
}

export interface AttendanceRecord {
  id: number;
  date: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LEAVE';
  note?: string | null;
}

export interface LeaveRequest {
  id: number;
  leaveType: 'PAID' | 'SICK' | 'UNPAID';
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  adminComment?: string | null;
  decidedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: { employeeId?: string; firstName?: string; lastName?: string; department?: string | null; userId?: number };
}

export interface SalaryStructure {
  id: number;
  employeeId: number;
  basicPay: string;
  housingAllowance?: string | null;
  transportAllowance?: string | null;
  taxPercent?: string | null;
  otherAllowances?: Record<string, number> | null;
  otherDeductions?: Record<string, number> | null;
  effectiveFrom?: string | null;
}

export interface Payslip {
  id: number;
  period: string;
  gross: string;
  net: string;
  components: Record<string, never>;
  issuedAt: string;
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface Paged<T> {
  data: T[];
  meta: PaginationMeta;
}
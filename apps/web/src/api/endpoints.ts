import { api } from './client';
import { setTokens, clearTokens } from './storage';
import type {
  LoginResponse,
  PublicUser,
  Paged,
  EmployeeProfile,
  AttendanceRecord,
  LeaveRequest,
  SalaryStructure,
  Payslip,
  Notification,
} from './types';

interface SignupPayload {
  employeeId: string;
  email: string;
  password: string;
  role: 'EMPLOYEE' | 'HR';
  firstName: string;
  lastName: string;
  department?: string;
  jobTitle?: string;
  phone?: string;
}

export const authApi = {
  login: async (email: string, password: string) => {
    const { data } = await api.post<LoginResponse>('/auth/login', { email, password });
    setTokens(data.accessToken, data.refreshToken);
    return data;
  },
  signup: async (payload: SignupPayload) => {
    const { data } = await api.post('/auth/signup', payload);
    return data;
  },
  logout: async () => {
    try {
      await api.post('/auth/logout', { refreshToken: localStorage.getItem('dayflow_refresh') ?? '' });
    } finally {
      clearTokens();
    }
  },
  me: async () => {
    const { data } = await api.get<{ user: PublicUser }>('/auth/me');
    return data.user;
  },
  verifyEmail: async (token: string) => {
    const { data } = await api.get('/auth/verify-email', { params: { token } });
    return data as { message: string };
  },
  resendVerification: async () => {
    const { data } = await api.post('/auth/resend-verification');
    return data as { message: string; verificationLink?: string };
  },
  changePassword: async (currentPassword: string, newPassword: string) => {
    const { data } = await api.post('/auth/change-password', { currentPassword, newPassword });
    return data as { message: string };
  },
  forgotPassword: async (email: string) => {
    const { data } = await api.post('/auth/forgot-password', { email });
    return data as { message: string; resetLink?: string };
  },
  resetPassword: async (token: string, newPassword: string) => {
    const { data } = await api.post('/auth/reset-password', { token, newPassword });
    return data as { message: string };
  },
};

export const dashboardApi = {
  me: async () => (await api.get('/dashboard/me')).data,
  admin: async () => (await api.get('/dashboard/admin')).data,
};

export const employeesApi = {
  list: async (params: Record<string, unknown> = {}) => (await api.get<Paged<EmployeeProfile>>('/employees', { params })).data,
  active: async () => (await api.get('/employees/active')).data,
  get: async (id: number) => (await api.get<EmployeeProfile>(`/employees/${id}`)).data,
  update: async (id: number, payload: Record<string, unknown>) => (await api.patch(`/employees/${id}`, payload)).data,
  create: async (payload: Record<string, unknown>) => (await api.post('/employees', payload)).data,
  audit: async (id: number, params: Record<string, unknown> = {}) => (await api.get(`/employees/${id}/audit`, { params })).data,
  addDocument: async (id: number, name: string, type: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('name', name);
    fd.append('type', type);
    const { data } = await api.post(`/employees/${id}/documents`, fd);
    return data;
  },
  removeDocument: async (id: number, docId: number) => (await api.delete(`/employees/${id}/documents/${docId}`)).data,
  uploadPicture: async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const { data } = await api.post('/employees/storage/profile-picture', fd);
    return data as { url: string };
  },
};

export const attendanceApi = {
  daily: async () => (await api.get('/attendance/daily')).data as { data: AttendanceRecord | null },
  my: async (params: Record<string, unknown> = {}) => (await api.get('/attendance/my', { params })).data as Paged<AttendanceRecord>,
  weekly: async () => (await api.get('/attendance/weekly/my')).data,
  checkIn: async () => (await api.post('/attendance/check-in')).data,
  checkOut: async () => (await api.post('/attendance/check-out')).data,
  adminList: async (params: Record<string, unknown> = {}) => (await api.get('/attendance', { params })).data,
};

export const leaveApi = {
  my: async (params: Record<string, unknown> = {}) => (await api.get('/leave/my', { params })).data as Paged<LeaveRequest>,
  balance: async () => (await api.get('/leave/balance')).data,
  get: async (id: number) => (await api.get(`/leave/${id}`)).data as LeaveRequest,
  apply: async (payload: { leaveType: string; startDate: string; endDate: string; reason: string }) => (await api.post('/leave', payload)).data,
  adminList: async (params: Record<string, unknown> = {}) => (await api.get('/leave', { params })).data,
  decide: async (id: number, status: 'APPROVED' | 'REJECTED', comment?: string) =>
    (await api.patch(`/leave/${id}/decide`, { status, comment })).data,
};

export const payrollApi = {
  me: async () => (await api.get('/payroll/me')).data,
  adminList: async (params: Record<string, unknown> = {}) => (await api.get('/payroll', { params })).data,
  adminGet: async (id: number) => (await api.get(`/payroll/employees/${id}`)).data,
  updateStructure: async (id: number, payload: Record<string, unknown>) => (await api.put(`/payroll/employees/${id}/structure`, payload)).data,
  generatePayslip: async (id: number, period?: string) => (await api.post(`/payroll/payslips/employees/${id}`, { period })).data,
};

export const notificationsApi = {
  list: async (params: Record<string, unknown> = {}) => (await api.get('/notifications', { params })).data,
  unreadCount: async () => (await api.get('/notifications/unread-count')).data as { count: number },
  markRead: async (id: number) => (await api.patch(`/notifications/${id}/read`)),
  markAllRead: async () => (await api.patch('/notifications/read-all')),
};

export const reportsApi = {
  attendance: async (params: Record<string, unknown> = {}) => (await api.get('/reports/attendance', { params })).data,
  leave: async (params: Record<string, unknown> = {}) => (await api.get('/reports/leave', { params })).data,
  payroll: async (params: Record<string, unknown> = {}) => (await api.get('/reports/payroll', { params })).data,
  attendanceCsv: () => exportCsv('/reports/attendance/export'),
  leaveCsv: () => exportCsv('/reports/leave/export'),
  payrollCsv: () => exportCsv('/reports/payroll/export'),
};

async function exportCsv(path: string): Promise<void> {
  const token = localStorage.getItem('dayflow_access') ?? '';
  const res = await fetch(`/api/v1${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = path.split('/').pop()?.replace('export', 'csv') ?? 'report.csv';
  a.click();
  URL.revokeObjectURL(url);
}
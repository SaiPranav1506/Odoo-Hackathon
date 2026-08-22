import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth/AuthContext';
import { RequireAuth, RequireVerified, RequireRole } from './auth/Guards';
import { Layout } from './components/Layout';
import { Login } from './features/auth/Login';
import { SignUp } from './features/auth/SignUp';
import { VerifyEmail, VerifyEmailNotice } from './features/auth/VerifyEmail';
import { ForgotPassword } from './features/auth/ForgotPassword';
import { ResetPassword } from './features/auth/ResetPassword';
import { Account } from './features/account/Account';
import { EmployeeDashboard } from './features/dashboard/EmployeeDashboard';
import { AdminDashboard } from './features/dashboard/AdminDashboard';
import { MyAttendance } from './features/attendance/MyAttendance';
import { AdminAttendance } from './features/attendance/AdminAttendance';
import { MyLeave } from './features/leave/MyLeave';
import { AdminLeave } from './features/leave/AdminLeave';
import { MyPayroll } from './features/payroll/MyPayroll';
import { AdminPayroll } from './features/payroll/AdminPayroll';
import { Employees } from './features/employees/Employees';
import { EmployeeDetail } from './features/employees/EmployeeDetail';
import { Notifications } from './features/notifications/Notifications';
import { Reports } from './features/reports/Reports';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/verify-email/notice" element={<VerifyEmailNotice />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route element={<RequireAuth />}>
              <Route element={<RequireVerified />}>
                <Route element={<Layout />}>
                  {/* Role-agnostic, verified-user routes (shared by all roles). */}
                  <Route path="/account" element={<Account />} />
                  <Route path="/notifications" element={<Notifications />} />
                  {/* Role-scoped routes. */}
                  <Route element={<RequireRole role="EMPLOYEE" />}>
                    <Route path="/" element={<EmployeeDashboard />} />
                    <Route path="/attendance" element={<MyAttendance />} />
                    <Route path="/leave" element={<MyLeave />} />
                    <Route path="/payroll" element={<MyPayroll />} />
                  </Route>
                  <Route element={<RequireRole role="HR" />}>
                    <Route path="/admin" element={<AdminDashboard />} />
                    <Route path="/admin/employees" element={<Employees />} />
                    <Route path="/admin/employees/:id" element={<EmployeeDetail />} />
                    <Route path="/admin/attendance" element={<AdminAttendance />} />
                    <Route path="/admin/leave" element={<AdminLeave />} />
                    <Route path="/admin/payroll" element={<AdminPayroll />} />
                    <Route path="/admin/reports" element={<Reports />} />
                  </Route>
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<Login />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
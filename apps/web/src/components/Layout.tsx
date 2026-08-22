import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { notificationsApi } from '../api/endpoints';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  roles: Array<'EMPLOYEE' | 'HR'>;
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: '🏠', roles: ['EMPLOYEE'], end: true },
  { to: '/attendance', label: 'Attendance', icon: '🕐', roles: ['EMPLOYEE'] },
  { to: '/leave', label: 'Leave', icon: '🏖️', roles: ['EMPLOYEE'] },
  { to: '/payroll', label: 'Payroll', icon: '💰', roles: ['EMPLOYEE'] },
  { to: '/admin', label: 'Dashboard', icon: '📊', roles: ['HR'], end: true },
  { to: '/admin/employees', label: 'Employees', icon: '👥', roles: ['HR'] },
  { to: '/admin/attendance', label: 'Attendance', icon: '🕐', roles: ['HR'] },
  { to: '/admin/leave', label: 'Leave Approvals', icon: '🗂️', roles: ['HR'] },
  { to: '/admin/payroll', label: 'Payroll', icon: '💰', roles: ['HR'] },
  { to: '/admin/reports', label: 'Reports', icon: '📈', roles: ['HR'] },
  { to: '/account', label: 'Account', icon: '⚙️', roles: ['EMPLOYEE', 'HR'] },
];

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState(false);

  const { data } = useQuery({
    queryKey: ['unread'],
    queryFn: () => notificationsApi.unreadCount(),
    refetchInterval: 30000,
    enabled: !!user,
  });

  const items = NAV.filter((i) => user && i.roles.includes(user.role));
  const initials = user?.profile?.firstName?.[0] && user?.profile?.lastName?.[0]
    ? `${user.profile.firstName[0]}${user.profile.lastName[0]}`.toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?';

  const link = 'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100';
  const activeLink = 'flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white';

  async function onLogout() {
    await logout();
    navigate('/login');
  }

  const sidebar = (
    <aside className="flex h-full w-64 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-base font-bold text-white">D</div>
        <div>
          <p className="text-sm font-bold text-slate-900">Dayflow</p>
          <p className="text-xs text-slate-400">{user?.role === 'HR' ? 'HR / Admin' : 'Employee'} portal</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}
            className={({ isActive }) => (isActive ? activeLink : link)}>
            <span>{item.icon}</span>{item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-100 p-3">
        <button onClick={onLogout} className={link}>
          <span>🚪</span>Log out
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex">{sidebar}</div>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:px-8">
          <button className="lg:hidden" onClick={() => setDrawer(true)} aria-label="Menu">{'☰'}</button>
          <div className="text-sm text-slate-500">{user?.profile?.firstName} Dashboard</div>
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/notifications')} className="relative text-lg" aria-label="Notifications">
              🔔
              {Number(data?.count) > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {data?.count}
                </span>
              )}
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">{initials}</div>
              <span className="hidden text-sm text-slate-600 sm:block">{user?.email}</span>
            </div>
          </div>
        </header>
        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
      {drawer && (
        <div className="fixed inset-0 z-20 flex lg:hidden">
          <div className="fixed inset-0 bg-black/30" onClick={() => setDrawer(false)} />
          <div className="relative z-10">{sidebar}</div>
        </div>
      )}
    </div>
  );
}
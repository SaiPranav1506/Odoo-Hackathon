import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { dashboardApi } from '../../api/endpoints';
import { Card, EmptyState, Spinner, StatTile } from '../../components/ui';
import { useAuth } from '../../auth/AuthContext';

export function EmployeeDashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ['dash-me'], queryFn: dashboardApi.me });

  const cards = [
    { to: '/attendance', label: 'Attendance', icon: '🕐' },
    { to: '/leave', label: 'Leave Requests', icon: '🏖️' },
    { to: '/payroll', label: 'Payroll', icon: '💰' },
    { to: '/notifications', label: 'Notifications', icon: '🔔' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome, {user?.profile?.firstName ?? 'there'} 👋</h1>
        <p className="text-sm text-slate-500">Here&apos;s what&apos;s happening today.</p>
      </div>

      {isLoading && <Spinner />}

      {data?.today && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatTile label="Today" value={data.today.status === 'none' ? 'Not checked in' : data.today.status} tone={data.today.checkedIn ? 'emerald' : 'amber'} />
          <StatTile label="Check-in" value={data.today.checkInTime ? new Date(data.today.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'} tone="indigo" />
          <StatTile label="Checked out" value={data.today.checkedOut ? 'Yes' : data.today.checkedIn ? 'No' : '—'} tone="slate" />
          <StatTile label="Paid leave left" value={data.leaveBalance ? `${data.leaveBalance.paidAvailable}d` : '—'} tone="emerald" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.to} to={c.to}
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow">
            <div className="text-2xl">{c.icon}</div>
            <p className="mt-3 text-sm font-semibold text-slate-800 group-hover:text-indigo-600">{c.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Recent activity">
          {(!data || !data.activity.length) ? <EmptyState message="No recent activity yet." /> : (
            <ul className="space-y-3">
              {data.activity.map((a: { type: string; title: string; time: string }, i: number) => (
                <li key={i} className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-slate-700">{a.type === 'leave' ? '🏖️' : '🕐'} {a.title}</span>
                  <span className="shrink-0 text-xs text-slate-400">{new Date(a.time).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="space-y-6">
          <Card title="Pending leave" className={''}>
            {data && data.pendingLeave > 0 ? (
              <p className="text-sm text-amber-700">{data.pendingLeave} pending leave request{data.pendingLeave > 1 ? 's' : ''}.{' '}
                <Link to="/leave" className="font-medium text-indigo-600 hover:underline">View</Link>
              </p>
            ) : (
              <EmptyState message="No pending requests." />
            )}
          </Card>
          <Card title={`Unread notifications`}>
            {data && data.unreadNotifications > 0 ? (
              <p className="text-sm text-slate-600">{data.unreadNotifications} unread. <Link to="/notifications" className="font-medium text-indigo-600 hover:underline">View</Link></p>
            ) : (
              <EmptyState message="You're all caught up." />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
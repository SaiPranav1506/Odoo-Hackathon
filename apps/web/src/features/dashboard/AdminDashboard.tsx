import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { dashboardApi, leaveApi } from '../../api/endpoints';
import { Card, EmptyState, Spinner, StatTile, StatusBadge } from '../../components/ui';

export function AdminDashboard() {
  const { data, isLoading } = useQuery({ queryKey: ['dash-admin'], queryFn: dashboardApi.admin });
  const { data: pending } = useQuery({ queryKey: ['admin-leave-pending'], queryFn: () => leaveApi.adminList({ status: 'PENDING', pageSize: 8 }), enabled: !!data });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">HR Dashboard</h1>
        <p className="text-sm text-slate-500">Company-wide overview.</p>
      </div>

      {isLoading && <Spinner />}

      {data?.counts && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile label="Active employees" value={data.counts.activeEmployees} tone="indigo" />
          <StatTile label="Inactive" value={data.counts.inactiveEmployees} tone="slate" />
          <StatTile label="Today present" value={data.attendanceToday?.PRESENT ?? 0} tone="emerald" />
          <StatTile label="Pending approvals" value={data.counts.pendingLeaveApprovals} tone="amber" />
          <StatTile label="Unverified accounts" value={data.counts.unverifiedAccounts} tone="red" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Attendance today">
          {data?.attendanceToday ? (
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.attendanceToday).map(([k, v]) => (
                <span key={k} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-700"><StatusBadge value={k} /> <b>{String(v)}</b></span>
              ))}
            </div>
          ) : <EmptyState message="No attendance yet today." />}
        </Card>

        <Card title="Pending leave approvals" actions={<Link to="/admin/leave" className="text-sm font-medium text-indigo-600 hover:underline">View all →</Link>}>
          {!pending?.data?.length ? <EmptyState message="No pending leave requests." /> : (
            <ul className="divide-y divide-slate-100">
              {pending.data.map((r: { id: number; employee?: { firstName?: string; lastName?: string } | null; leaveType: string; startDate: string; endDate: string; days: number; status: string }) => (
                <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{r.employee?.firstName} {r.employee?.lastName}</p>
                    <p className="text-xs text-slate-500">{r.leaveType} · {r.startDate.slice(0, 10)} → {r.endDate.slice(0, 10)} · {r.days}d</p>
                  </div>
                  <StatusBadge value={r.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Quick actions">
        <div className="flex flex-wrap gap-3">
          <Link to="/admin/employees" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Manage employees</Link>
          <Link to="/admin/attendance" className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300">Attendance overview</Link>
          <Link to="/admin/reports" className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300">Reports & exports</Link>
        </div>
      </Card>
    </div>
  );
}
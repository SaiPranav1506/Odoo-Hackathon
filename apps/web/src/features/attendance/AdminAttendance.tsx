import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { attendanceApi, employeesApi } from '../../api/endpoints';
import { Card, EmptyState, Pagination, Spinner, StatusBadge, Field, inputClass } from '../../components/ui';

export function AdminAttendance() {
  const [employeeId, setEmployeeId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const employees = useQuery({ queryKey: ['emp-active'], queryFn: employeesApi.active });

  const params: Record<string, unknown> = { page, pageSize: 20 };
  if (employeeId) params.employeeId = employeeId;
  if (from) params.from = from;
  if (to) params.to = to;
  if (status) params.status = status;

  const list = useQuery({ queryKey: ['att-admin', params], queryFn: () => attendanceApi.adminList(params) });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Attendance overview</h1>

      <Card>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <div className="col-span-2">
            <Field label="Employee">
              <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={inputClass}>
                <option value="">All employees</option>
                {employees.data?.data?.map((e: { userId: number; employeeId: string; firstName: string; lastName: string }) => (
                  <option key={e.userId} value={e.userId}>{e.employeeId} — {e.firstName} {e.lastName}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="From"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} /></Field>
          <Field label="To"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} /></Field>
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
              <option value="">All</option><option>PRESENT</option><option>ABSENT</option><option>HALF_DAY</option><option>LEAVE</option>
            </select>
          </Field>
        </div>
      </Card>

      <Card title={`Records (${list.data?.meta?.total ?? 0})`}>
        {list.isLoading ? <Spinner /> : (
          <>
            {!list.data?.data?.length ? <EmptyState message="No records match your filters." /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="py-2 pr-4">Date</th><th className="py-2 pr-4">Employee</th><th className="py-2 pr-4">Dept</th>
                    <th className="py-2 pr-4">Status</th><th className="py-2 pr-4">Check-in</th><th className="py-2">Check-out</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.data.map((r: { id: string; date: string; employee: { employeeId: string; firstName: string; lastName: string; department?: string | null }; status: string; checkInTime?: string | null; checkOutTime?: string | null }) => (
                    <tr key={r.id} className="border-b border-slate-50">
                      <td className="py-2 pr-4">{r.date.slice(0, 10)}</td>
                      <td className="py-2 pr-4">{r.employee.firstName} {r.employee.lastName} <span className="text-slate-400">({r.employee.employeeId})</span></td>
                      <td className="py-2 pr-4">{r.employee.department ?? '—'}</td>
                      <td className="py-2 pr-4"><StatusBadge value={r.status} /></td>
                      <td className="py-2 pr-4">{r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                      <td className="py-2">{r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
            <Pagination page={page} totalPages={list.data?.meta?.totalPages ?? 1} onChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
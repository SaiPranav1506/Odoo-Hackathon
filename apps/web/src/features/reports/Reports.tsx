import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi, employeesApi } from '../../api/endpoints';
import { Card, EmptyState, Spinner, StatusBadge, Field, inputClass, ghostBtn } from '../../components/ui';

export function Reports() {
  const [tab, setTab] = useState<'attendance' | 'leave' | 'payroll'>('attendance');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));

  const employees = useQuery({ queryKey: ['emp-active'], queryFn: employeesApi.active });

  const attParams: Record<string, unknown> = { from, to };
  if (employeeId) attParams.employeeId = employeeId;
  const attendance = useQuery({ queryKey: ['rep-att', from, to, employeeId], queryFn: () => reportsApi.attendance(attParams), enabled: tab === 'attendance' });
  const leave = useQuery({ queryKey: ['rep-leave', from, to], queryFn: () => reportsApi.leave({ from, to }), enabled: tab === 'leave' });
  const payroll = useQuery({ queryKey: ['rep-payroll', period], queryFn: () => reportsApi.payroll({ period }), enabled: tab === 'payroll' });

  const tabs = [['attendance', 'Attendance'], ['leave', 'Leave'], ['payroll', 'Payroll']] as const;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Reports</h1>

      <div className="flex flex-wrap gap-2">
        {tabs.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === key ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>{label}</button>
        ))}
      </div>

      <Card className={''}>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Field label="From"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} /></Field>
          <Field label="To"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} /></Field>
          {tab === 'attendance' && (
            <>
              <div className="col-span-2">
                <Field label="Employee"><select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={inputClass}><option value="">All</option>{employees.data?.data?.map((e: { userId: number; employeeId: string; firstName: string; lastName: string }) => <option key={e.userId} value={e.userId}>{e.employeeId} — {e.firstName} {e.lastName}</option>)}</select></Field>
              </div>
              <button className="self-end rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300" onClick={() => reportsApi.attendanceCsv()}>Export CSV</button>
            </>
          )}
          {tab === 'leave' && <button className="self-end rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300" onClick={() => reportsApi.leaveCsv()}>Export CSV</button>}
          {tab === 'payroll' && (
            <>
              <Field label="Period"><input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className={inputClass} /></Field>
              <button className="self-end rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300" onClick={() => reportsApi.payrollCsv()}>Export CSV</button>
            </>
          )}
        </div>
        <p className="mt-4 text-xs text-slate-400">Exports use the current filter selections above.</p>
      </Card>

      {tab === 'attendance' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Summary counts">
            {attendance.isLoading ? <Spinner /> : attendance.data?.counts ? (
              <div className="flex flex-wrap gap-2">
                {Object.entries(attendance.data.counts).map(([k, v]) => <span key={k} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-700"><StatusBadge value={k} /> <b>{String(v)}</b></span>)}
              </div>
            ) : <EmptyState message="No data in range." />}
          </Card>
          <Card title="Daily detail">
            {attendance.isLoading ? <Spinner /> : (
              <>
                {!attendance.data?.detail?.length ? <EmptyState message="No records." /> : (
                  <ul className="max-h-80 space-y-2 overflow-auto text-sm">
                    {attendance.data.detail.slice(0, 60).map((r: { id: number; date: string; employee: { employeeId: string; firstName: string; lastName: string }; status: string }) => (
                      <li key={r.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-1.5">
                        <span className="text-slate-700">{r.employee.firstName} {r.employee.lastName}</span>
                        <span className="flex items-center gap-2 text-xs text-slate-500">{r.date.slice(0, 10)} <StatusBadge value={r.status} /></span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </Card>
        </div>
      )}

      {tab === 'leave' && (
        <Card title="Leave statistics">
          {leave.isLoading ? <Spinner /> : leave.data ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-700">By type</p>
                <ul className="space-y-1 text-sm">{leave.data.byType.map((r: { leaveType: string; _count: { _all: number } }) => <li key={r.leaveType} className="flex justify-between"><span>{r.leaveType}</span><b>{r._count._all}</b></li>)}</ul>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-700">By status</p>
                <ul className="space-y-1 text-sm">{leave.data.byStatus.map((r: { status: string; _count: { _all: number } }) => <li key={r.status} className="flex justify-between"><span>{r.status}</span><b>{r._count._all}</b></li>)}</ul>
              </div>
            </div>
          ) : <EmptyState message="No data." />}
        </Card>
      )}

      {tab === 'payroll' && (
        <Card title={`Payslips · ${period}`}>
          {payroll.isLoading ? <Spinner /> : payroll.data ? (
            <>
              <div className="mb-4 flex gap-4 text-sm">
                <span className="rounded-lg bg-slate-100 px-3 py-1.5">Slips: <b>{payroll.data.payslipCount}</b></span>
                <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-emerald-700">Total gross: <b>{Number(payroll.data.totalGross).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</b></span>
                <span className="rounded-lg bg-indigo-50 px-3 py-1.5 text-indigo-700">Total net: <b>{Number(payroll.data.totalNet).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</b></span>
              </div>
              {!payroll.data.slips?.length ? <EmptyState message="No payslips for this period." /> : (
                <ul className="space-y-2 text-sm">
                  {payroll.data.slips.slice(0, 50).map((s: { id: number; period: string; gross: string; net: string; employee: { firstName: string; lastName: string; employeeId: string } }) => (
                    <li key={s.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                      <span>{s.employee.firstName} {s.employee.lastName} <span className="text-xs text-slate-400">({s.employee.employeeId})</span></span>
                      <span className="text-slate-500">{Number(s.gross).toLocaleString()} gross · <b className="text-emerald-600">{Number(s.net).toLocaleString()} net</b></span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : <EmptyState message="No data." />}
        </Card>
      )}
    </div>
  );
}
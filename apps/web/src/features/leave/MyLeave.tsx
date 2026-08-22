import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { leaveApi } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import { Card, EmptyState, Pagination, Spinner, StatusBadge, Field, inputClass, primaryBtn } from '../../components/ui';

export function MyLeave() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ leaveType: 'PAID', startDate: '', endDate: '', reason: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [showApply, setShowApply] = useState(false);

  const list = useQuery({ queryKey: ['leave-my', page], queryFn: () => leaveApi.my({ page, pageSize: 20 }) });
  const balance = useQuery({ queryKey: ['leave-balance'], queryFn: leaveApi.balance });

  const apply = useMutation({
    mutationFn: leaveApi.apply,
    onSuccess: () => {
      setMsg('Leave request submitted.');
      setErr(''); setShowApply(false);
      setForm({ leaveType: 'PAID', startDate: '', endDate: '', reason: '' });
      qc.invalidateQueries({ queryKey: ['leave-my'] });
      qc.invalidateQueries({ queryKey: ['leave-balance'] });
    },
    onError: (e) => setErr(errorMessage(e)),
  });

  function onSubmit(e: FormEvent) { e.preventDefault(); apply.mutate(form); }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">My Leave</h1>
        <button className={primaryBtn} onClick={() => setShowApply((s) => !s)}>{showApply ? 'Cancel' : 'Request leave'}</button>
      </div>

      {balance.data && (
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-emerald-700">Paid available: {balance.data.available?.paid ?? 0}d</span>
          <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-slate-600">Used paid: {balance.data.entitled?.paidDaysUsed ?? 0}</span>
          <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-slate-600">Used sick: {balance.data.entitled?.sickDaysUsed ?? 0}</span>
          <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-slate-600">Used unpaid: {balance.data.entitled?.unpaidDaysUsed ?? 0}</span>
        </div>
      )}

      {showApply && (
        <Card title="Request leave">
          <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Leave type">
              <select value={form.leaveType} onChange={(e) => setForm({ ...form, leaveType: e.target.value })} className={inputClass}>
                <option value="PAID">Paid</option><option value="SICK">Sick</option><option value="UNPAID">Unpaid</option>
              </select>
            </Field>
            <div/>
            <Field label="Start date"><input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={inputClass} required /></Field>
            <Field label="End date"><input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={inputClass} required /></Field>
            <div className="sm:col-span-2">
              <Field label="Reason / remarks">
                <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={3} className={inputClass} minLength={3} required />
              </Field>
            </div>
            {err && <div className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
            <button type="submit" className={`${primaryBtn} sm:col-span-1`} disabled={apply.isPending}>Submit request</button>
          </form>
        </Card>
      )}
      {msg && <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{msg}</div>}

      <Card title="My requests">
        {list.isLoading ? <Spinner /> : (
          <>
            {!list.data?.data?.length ? <EmptyState message="No leave requests yet." /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-slate-500">
                      <th className="py-2 pr-4">Dates</th><th className="py-2 pr-4">Type</th><th className="py-2 pr-4">Days</th>
                      <th className="py-2 pr-4">Reason</th><th className="py-2 pr-4">Status</th><th className="py-2">Comment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.data.data.map((r) => (
                      <tr key={r.id} className="border-b border-slate-50">
                        <td className="py-2 pr-4">{r.startDate.slice(0, 10)} → {r.endDate.slice(0, 10)}</td>
                        <td className="py-2 pr-4">{r.leaveType}</td>
                        <td className="py-2 pr-4">{r.days}</td>
                        <td className="py-2 pr-4 max-w-xs truncate">{r.reason}</td>
                        <td className="py-2 pr-4"><StatusBadge value={r.status} /></td>
                        <td className="py-2 text-slate-500">{r.adminComment ?? '—'}</td>
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
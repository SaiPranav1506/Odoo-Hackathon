import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { leaveApi } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import { Card, EmptyState, Pagination, Spinner, StatusBadge, inputClass, primaryBtn, ghostBtn } from '../../components/ui';

export function AdminLeave() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('PENDING');
  const [page, setPage] = useState(1);
  const [err, setErr] = useState('');

  const list = useQuery({ queryKey: ['leave-admin', status, page], queryFn: () => leaveApi.adminList({ status, page, pageSize: 20 }) });

  const decide = useMutation({
    mutationFn: (args: { id: number; status: 'APPROVED' | 'REJECTED'; comment?: string }) => leaveApi.decide(args.id, args.status, args.comment),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-admin'] }); qc.invalidateQueries({ queryKey: ['dash-admin'] }); setErr(''); },
    onError: (e) => setErr(errorMessage(e)),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Leave approvals</h1>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={inputClass + ' w-44'}>
          <option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option>
        </select>
      </div>
      {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

      <Card title={`${status.toLowerCase()} requests`}>
        {list.isLoading ? <Spinner /> : (
          <>
            {!list.data?.data?.length ? <EmptyState message="Nothing here." /> : (
              <div className="space-y-3">
                {list.data.data.map((r: { id: number; employee?: { firstName?: string; lastName?: string; employeeId?: string; department?: string | null }; leaveType: string; startDate: string; endDate: string; days: number; reason: string; status: string; adminComment?: string | null }) => (
                  <div key={r.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-800">{r.employee?.firstName} {r.employee?.lastName} <span className="text-sm font-normal text-slate-400">({r.employee?.employeeId})</span></p>
                        <p className="text-xs text-slate-500">{r.leaveType} · {r.startDate.slice(0, 10)} → {r.endDate.slice(0, 10)} · {r.days}d</p>
                        <p className="mt-1 text-sm text-slate-600">{r.reason}</p>
                        {r.adminComment && <p className="mt-1 text-xs text-slate-500">Comment: {r.adminComment}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge value={r.status} />
                        {r.status === 'PENDING' && (
                          <div className="flex gap-2">
                            <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                              onClick={() => decide.mutate({ id: r.id, status: 'APPROVED' })}>Approve</button>
                            <button className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                              onClick={() => {
                                const comment = window.prompt('Optional comment for the employee:');
                                decide.mutate({ id: r.id, status: 'REJECTED', comment: comment ?? undefined });
                              }}>Reject</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Pagination page={page} totalPages={list.data?.meta?.totalPages ?? 1} onChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { payrollApi } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import { Card, EmptyState, Pagination, Spinner, primaryBtn, inputClass, StatusBadge } from '../../components/ui';

export function AdminPayroll() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [err, setErr] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [edit, setEdit] = useState<Record<string, string>>({});

  const list = useQuery({ queryKey: ['payroll-admin', page], queryFn: () => payrollApi.adminList({ page, pageSize: 20 }) });

  const save = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) => payrollApi.updateStructure(id, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payroll-admin'] }); setErr(''); setExpanded(null); },
    onError: (e) => setErr(errorMessage(e)),
  });

  const payslip = useMutation({
    mutationFn: (id: number) => payrollApi.generatePayslip(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payroll-admin'] }); alert('Payslip generated.'); },
    onError: (e) => setErr(errorMessage(e)),
  });

  function openEdit(row: { employee?: { userId?: number }; id: number; basicPay: string }) {
    setExpanded(row.employee?.userId ?? null);
    setEdit({ basicPay: row.basicPay });
  }

  function submitEdit(employeeUserId: number) {
    const payload: Record<string, unknown> = { basicPay: Number(edit.basicPay) };
    save.mutate({ id: employeeUserId, payload });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Payroll</h1>
      {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

      <Card title={`Salary structures (${list.data?.meta?.total ?? 0})`}>
        {list.isLoading ? <Spinner /> : (
          <>
            {!list.data?.data?.length ? <EmptyState message="No salary structures yet." /> : (
              <div className="space-y-3">
                {list.data.data.map((row: { id: number; employee?: { userId?: number; employeeId?: string; firstName?: string; lastName?: string; department?: string | null }; basicPay: string; taxPercent?: string | null }) => {
                  const uid = row.employee?.userId ?? row.id;
                  return (
                    <div key={row.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-800">{row.employee?.firstName} {row.employee?.lastName} <span className="text-sm font-normal text-slate-400">({row.employee?.employeeId})</span></p>
                          <p className="text-xs text-slate-500">{row.employee?.department ?? '—'}</p>
                        </div>
                        <div className="flex items-center gap-4 text-right text-sm">
                          <div>
                            <p className="text-xs text-slate-400">Basic</p>
                            <p className="font-semibold text-slate-800">{Number(row.basicPay).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">Tax %</p>
                            <p className="font-semibold text-slate-800">{row.taxPercent ?? '—'}</p>
                          </div>
                          <button className={primaryBtn} onClick={() => openEdit(row)}>Edit</button>
                          <button className="rounded-lg bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-300" onClick={() => payslip.mutate(uid)}>Gen payslip</button>
                        </div>
                      </div>
                      {expanded === uid && (
                        <div className="mt-4 flex items-end gap-3 border-t border-slate-100 pt-3">
                          <label className="block text-sm"><span className="mb-1 block text-slate-500">Basic pay</span>
                            <input type="number" value={edit.basicPay} onChange={(e) => setEdit({ basicPay: e.target.value })} className={inputClass + ' w-40'} />
                          </label>
                          <button className={primaryBtn} onClick={() => submitEdit(uid)}>Save</button>
                          <button className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100" onClick={() => setExpanded(null)}>Cancel</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <Pagination page={page} totalPages={list.data?.meta?.totalPages ?? 1} onChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
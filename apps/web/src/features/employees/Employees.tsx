import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { employeesApi } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import { Card, EmptyState, Pagination, Spinner, StatusBadge, Field, inputClass, primaryBtn } from '../../components/ui';

export function Employees() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [err, setErr] = useState('');
  const [genPass, setGenPass] = useState('');
  const [form, setForm] = useState({ employeeId: '', firstName: '', lastName: '', email: '', role: 'EMPLOYEE', department: '', jobTitle: '' });

  const list = useQuery({ queryKey: ['employees', search, page], queryFn: () => employeesApi.list({ search, page, pageSize: 20 }) });

  const create = useMutation({
    mutationFn: employeesApi.create,
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      setShowCreate(false);
      setForm({ employeeId: '', firstName: '', lastName: '', email: '', role: 'EMPLOYEE', department: '', jobTitle: '' });
      if (d.generatedPassword) setGenPass(d.generatedPassword);
      setErr('');
    },
    onError: (e) => setErr(errorMessage(e)),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate(form);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Employees</h1>
        <div className="flex gap-3">
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name / ID…" className={inputClass + ' w-56'} />
          <button className={primaryBtn} onClick={() => setShowCreate((s) => !s)}>{showCreate ? 'Cancel' : '+ Add employee'}</button>
        </div>
      </div>

      {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
      {genPass && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Employee created. Temporary password (share it once): <b>{genPass}</b>. It can be changed later.
          <button className="ml-2 font-medium underline" onClick={() => setGenPass('')}>Dismiss</button>
        </div>
      )}

      {showCreate && (
        <Card title="Add employee">
          <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Employee ID"><input value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className={inputClass} required /></Field>
            <Field label="Role"><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inputClass}><option>EMPLOYEE</option><option>HR</option></select></Field>
            <Field label="First name"><input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={inputClass} required /></Field>
            <Field label="Last name"><input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className={inputClass} required /></Field>
            <Field label="Email"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} required /></Field>
            <Field label="Department"><input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className={inputClass} /></Field>
            <div className="sm:col-span-2"><Field label="Job title"><input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} className={inputClass} /></Field></div>
            {err && <div className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
            <div className="sm:col-span-2"><button type="submit" className={primaryBtn} disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create employee'}</button></div>
          </form>
        </Card>
      )}

      <Card title={`Employee directory (${list.data?.meta?.total ?? 0})`}>
        {list.isLoading ? <Spinner /> : (
          <>
            {!list.data?.data?.length ? <EmptyState message="No employees found." /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-slate-500">
                      <th className="py-2 pr-4">ID</th><th className="py-2 pr-4">Name</th><th className="py-2 pr-4">Dept</th>
                      <th className="py-2 pr-4">Email</th><th className="py-2 pr-4">Role</th><th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.data.data.map((e: { userId?: number; employeeId: string; firstName: string; lastName: string; department?: string | null; user?: { email?: string; role?: string }; status: string }) => (
                      <tr key={e.userId} className="cursor-pointer border-b border-slate-50 hover:bg-slate-50">
                        <td className="py-2 pr-4"><Link to={`/admin/employees/${e.userId}`} className="font-medium text-indigo-600 hover:underline">{e.employeeId}</Link></td>
                        <td className="py-2 pr-4"><Link to={`/admin/employees/${e.userId}`} className="hover:underline">{e.firstName} {e.lastName}</Link></td>
                        <td className="py-2 pr-4">{e.department ?? '—'}</td>
                        <td className="py-2 pr-4">{e.user?.email}</td>
                        <td className="py-2 pr-4"><StatusBadge value={e.user?.role ?? ''} /></td>
                        <td className="py-2"><StatusBadge value={e.status} /></td>
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
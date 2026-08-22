import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { employeesApi } from '../../api/endpoints';
import { useAuth } from '../../auth/AuthContext';
import { errorMessage } from '../../api/client';
import type { EmployeeProfile } from '../../api/types';
import { Card, EmptyState, Spinner, StatusBadge, Field, inputClass, primaryBtn, ghostBtn } from '../../components/ui';

const SELF_EDITABLE = ['phone', 'address'];

export function EmployeeDetail() {
  const { id } = useParams();
  const userId = Number(id);
  const { user } = useAuth();
  const isSelf = user?.id === userId;
  const isHr = user?.role === 'HR';
  const qc = useQueryClient();
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [form, setForm] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);

  const { data, isLoading } = useQuery<EmployeeProfile>({
    queryKey: ['emp-detail', userId],
    queryFn: () => employeesApi.get(userId),
  });

  useEffect(() => {
    if (data) {
      const editable = isHr ? ['phone', 'address', 'firstName', 'lastName', 'department', 'jobTitle', 'employmentType', 'gender'] : SELF_EDITABLE;
      const f: Record<string, string> = {};
      for (const k of editable) f[k] = String((data as unknown as Record<string, unknown>)[k] ?? '');
      setForm(f);
    }
  }, [data, isHr]);

  const save = useMutation({
    mutationFn: (payload: Record<string, unknown>) => employeesApi.update(userId, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['emp-detail', userId] }); setMsg('Profile updated.'); setErr(''); setEditing(false); },
    onError: (e) => setErr(errorMessage(e)),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate(form);
  }

  if (isLoading) return <Spinner />;
  if (!data) return <EmptyState message="Not found." />;

  const picture = data.profilePictureUrl || '';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Employee profile</h1>
      {msg && <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{msg}</div>}
      {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

      <Card>
        <div className="flex flex-wrap items-center gap-4">
          {picture
            ? <img src={picture} alt="avatar" className="h-20 w-20 rounded-full object-cover" />
            : <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-100 text-2xl font-bold text-indigo-700">{data.firstName?.[0]}{data.lastName?.[0]}</div>}
          <div>
            <p className="text-lg font-bold text-slate-900">{data.firstName} {data.lastName}</p>
            <p className="text-sm text-slate-500">{data.employeeId} · {data.department ?? '—'} · {data.jobTitle ?? '—'}</p>
            <div className="mt-1"><StatusBadge value={data.status} /></div>
          </div>
          {(isSelf || isHr) && (
            <div className="ml-auto">
              {!editing
                ? <button className={ghostBtn} onClick={() => setEditing(true)}>Edit profile</button>
                : <button className={ghostBtn} onClick={() => setEditing(false)}>Cancel</button>}
            </div>
          )}
        </div>
      </Card>

      {editing ? (
        <Card title={isHr ? 'Edit profile (admin)' : 'Edit profile (limited)'}>
          <p className="mb-3 text-xs text-slate-500">{isHr ? 'As HR you can edit all fields; each change is audited.' : 'Employees may only update their phone and address. Contact HR to change other details.'}</p>
          <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {isHr && <Field label="First name"><input value={form.firstName ?? ''} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={inputClass} /></Field>}
            {isHr && <Field label="Last name"><input value={form.lastName ?? ''} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className={inputClass} /></Field>}
            <Field label="Phone"><input value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} /></Field>
            <Field label="Address"><input value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputClass} /></Field>
            {isHr && <Field label="Department"><input value={form.department ?? ''} onChange={(e) => setForm({ ...form, department: e.target.value })} className={inputClass} /></Field>}
            {isHr && <Field label="Job title"><input value={form.jobTitle ?? ''} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} className={inputClass} /></Field>}
            {isHr && <Field label="Employment type"><input value={form.employmentType ?? ''} onChange={(e) => setForm({ ...form, employmentType: e.target.value })} className={inputClass} /></Field>}
            {isHr && <Field label="Gender"><input value={form.gender ?? ''} onChange={(e) => setForm({ ...form, gender: e.target.value })} className={inputClass} /></Field>}
            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" className={primaryBtn} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save changes'}</button>
            </div>
          </form>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Personal details">
            <dl className="divide-y divide-slate-100 text-sm">
              {[['Employee ID', data.employeeId], ['Email', data.user?.email], ['Phone', data.phone ?? '—'], ['Address', data.address ?? '—'], ['Gender', data.gender ?? '—'], ['Date of birth', data.dateOfBirth ? String(data.dateOfBirth).slice(0, 10) : '—']]
                .map(([k, v]) => (<div key={String(k)} className="flex justify-between py-2"><dt className="text-slate-500">{k}</dt><dd className="font-medium text-slate-800">{v}</dd></div>))}
            </dl>
          </Card>
          <Card title="Job details">
            <dl className="divide-y divide-slate-100 text-sm">
              {[['Department', data.department ?? '—'], ['Job title', data.jobTitle ?? '—'], ['Employment type', data.employmentType ?? '—'], ['Hire date', data.hireDate ? String(data.hireDate).slice(0, 10) : '—'], ['Status', <StatusBadge value={data.status} key="s" />]]
                .map(([k, v]) => (<div key={String(k)} className="flex justify-between py-2"><dt className="text-slate-500">{k}</dt><dd className="font-medium text-slate-800">{v}</dd></div>))}
            </dl>
          </Card>
        </div>
      )}

      {isHr && data.recentAudits && data.recentAudits.length > 0 && (
        <Card title="Recent audit trail">
          <ul className="divide-y divide-slate-100 text-sm">
            {data.recentAudits.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 py-2">
                <div>
                  <p className="text-slate-800">
                    {a.action.replaceAll('_', ' ')} — <b>{a.field}</b>
                    {typeof a.newValue === 'string' && a.newValue && ` → ${a.newValue}`}
                  </p>
                  <p className="text-xs text-slate-400">by {a.actor?.email ?? 'system'} · {new Date(a.createdAt).toLocaleString()}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
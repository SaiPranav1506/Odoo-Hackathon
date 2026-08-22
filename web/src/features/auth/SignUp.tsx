import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/endpoints';
import { errorMessage } from '../../api/client';

export function SignUp() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    employeeId: '', firstName: '', lastName: '', email: '', password: '', confirm: '', role: 'EMPLOYEE' as 'EMPLOYEE' | 'HR',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    setBusy(true);
    try {
      const res = await authApi.signup(form);
      setSuccess(res.message ?? 'Account created. Check your email to verify.');
      setTimeout(() => navigate('/login'), 1600);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-slate-100 px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-xl font-bold text-white">D</div>
          <h1 className="text-2xl font-bold text-slate-900">Create your Dayflow account</h1>
          <p className="text-sm text-slate-500">You must verify your email before you can start</p>
        </div>
        <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          {success && <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{success}</div>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Employee ID</label>
              <input value={form.employeeId} onChange={(e) => set('employeeId', e.target.value)} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Role</label>
              <select value={form.role} onChange={(e) => set('role', e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="EMPLOYEE">Employee</option>
                <option value="HR">HR / Admin</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">First name</label>
              <input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Last name</label>
              <input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Work email</label>
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
              <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} required minLength={8}
                placeholder="8+ chars, upper/lower/number/symbol"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Confirm password</label>
              <input type="password" value={form.confirm} onChange={(e) => set('confirm', e.target.value)} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">Password must be at least 8 characters and include an uppercase letter, lowercase letter, number, and symbol.</p>
          <button type="submit" disabled={busy}
            className="mt-5 w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50">
            {busy ? 'Creating…' : 'Create account'}
          </button>
          <p className="mt-4 text-center text-sm text-slate-500">
            Already registered? <Link to="/login" className="font-medium text-indigo-600 hover:underline">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
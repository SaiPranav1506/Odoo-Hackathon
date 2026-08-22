import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import { inputClass, primaryBtn } from '../../components/ui';

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setBusy(true);
    try {
      await authApi.resetPassword(token, password);
      navigate('/login', { replace: true, state: { resetDone: true } });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-slate-100 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-xl font-bold text-white">D</div>
          <h1 className="text-2xl font-bold text-slate-900">Choose a new password</h1>
        </div>
        <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {!token && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">This link is missing its reset token. Please use the link from your email.</div>}
          {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <label className="mb-1 block text-sm font-medium text-slate-700">New password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoFocus
            placeholder="8+ chars, upper/lower/number/symbol"
            className={`${inputClass} mb-4`} />
          <label className="mb-1 block text-sm font-medium text-slate-700">Confirm new password</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8}
            className={`${inputClass} mb-5`} />
          <button type="submit" disabled={busy || !token} className={`${primaryBtn} w-full`}>
            {busy ? 'Resetting…' : 'Reset password'}
          </button>
          <p className="mt-4 text-center text-sm text-slate-500">
            <Link to="/login" className="font-medium text-indigo-600 hover:underline">Back to sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
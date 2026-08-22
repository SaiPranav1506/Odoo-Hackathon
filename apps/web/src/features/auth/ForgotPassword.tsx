import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import { inputClass, primaryBtn } from '../../components/ui';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [resetLink, setResetLink] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(''); setMessage(''); setResetLink(''); setBusy(true);
    try {
      const res = await authApi.forgotPassword(email);
      setMessage(res.message);
      setResetLink(res.resetLink ?? '');
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
          <h1 className="text-2xl font-bold text-slate-900">Reset your password</h1>
          <p className="text-sm text-slate-500">Enter your email and we&apos;ll send you a reset link.</p>
        </div>
        <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          {message && (
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              <p>{message}</p>
              {resetLink && (
                <a href={resetLink} target="_blank" rel="noreferrer"
                  className="mt-1 block break-all font-medium text-indigo-700 underline hover:text-indigo-900">Open the reset link (development) →</a>
              )}
            </div>
          )}
          <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus
            className={`${inputClass} mb-5`} />
          <button type="submit" disabled={busy} className={`${primaryBtn} w-full`}>
            {busy ? 'Sending…' : 'Send reset link'}
          </button>
          <p className="mt-4 text-center text-sm text-slate-500">
            Remembered your password? <Link to="/login" className="font-medium text-indigo-600 hover:underline">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
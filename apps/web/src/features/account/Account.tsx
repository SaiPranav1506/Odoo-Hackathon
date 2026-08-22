import { useState, type FormEvent } from 'react';
import { authApi } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Card, Field, inputClass, primaryBtn } from '../../components/ui';

export function Account() {
  const { user } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(''); setError('');
    if (next !== confirm) { setError('New passwords do not match'); return; }
    setBusy(true);
    try {
      const res = await authApi.changePassword(current, next);
      setMessage(res.message);
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Account settings</h1>

      <Card title="Change password">
        <p className="mb-4 text-sm text-slate-500">
          Signed in as <b>{user?.email}</b>. Changing your password will sign you out of your other devices.
        </p>
        {message && <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</div>}
        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Current password">
            <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required className={inputClass} />
          </Field>
          <Field label="New password">
            <input type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8}
              placeholder="8+ chars, upper/lower/number/symbol" className={inputClass} />
          </Field>
          <Field label="Confirm new password">
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} className={inputClass} />
          </Field>
          <button type="submit" disabled={busy} className={primaryBtn}>{busy ? 'Saving…' : 'Update password'}</button>
        </form>
      </Card>
    </div>
  );
}
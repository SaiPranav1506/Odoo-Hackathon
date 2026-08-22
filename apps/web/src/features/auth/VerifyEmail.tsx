import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '../../api/endpoints';
import { errorMessage } from '../../api/client';

export function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) { setError('No verification token provided.'); return; }
    authApi.verifyEmail(token).then((r) => setMessage(r.message)).catch((e) => setError(errorMessage(e))).finally(() => {});
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-xl">✉️</div>
        <h1 className="text-xl font-bold text-slate-900">Email verification</h1>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {message && <p className="mt-3 text-sm text-green-700">{message}</p>}
        <Link to="/login" className="mt-6 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
          Go to sign in
        </Link>
      </div>
    </div>
  );
}

export function VerifyEmailNotice() {
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState('');
  const [error, setError] = useState('');

  async function resend() {
    setError('');
    try {
      const res = await authApi.resendVerification();
      setSent(true);
      setDevLink(res.verificationLink ?? '');
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Verify your email</h1>
        <p className="mt-3 text-sm text-slate-600">We sent an activation link to your inbox. You won&apos;t be able to use HR features until your account is verified.</p>
        {sent && (
          <div className="mt-3 text-sm text-green-700">
            <p>Verification email resent.</p>
            {devLink && (
              <a href={devLink} target="_blank" rel="noreferrer"
                className="mt-1 block break-all font-medium text-indigo-700 underline hover:text-indigo-900">Activate your account (development link) →</a>
            )}
          </div>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <button onClick={resend} className="mt-6 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
          Resend verification email
        </button>
        <Link to="/login" className="mt-3 block text-sm text-slate-500 hover:underline">Back to sign in</Link>
      </div>
    </div>
  );
}
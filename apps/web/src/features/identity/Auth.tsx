import { useState, type FormEvent } from 'react';
import { api, setCsrf, type User } from '../../app/api';

type Mode = 'login' | 'register' | 'forgot' | 'reset';
export function Auth({ onSignedIn }: { onSignedIn: (user: User) => void }) {
  const resetToken = new URLSearchParams(location.hash.slice(1)).get('reset');
  const [mode, setMode] = useState<Mode>(resetToken ? 'reset' : 'login');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    const data = new FormData(event.currentTarget);
    try {
      if (mode === 'forgot') {
        await api('/auth/forgot-password', { method: 'POST', body: { email: data.get('email') } });
        setNotice(
          'If this address has an account, recovery instructions are in the development email sink.',
        );
      } else if (mode === 'reset') {
        await api('/auth/reset-password', {
          method: 'POST',
          body: { token: resetToken, password: data.get('password') },
        });
        history.replaceState(null, '', location.pathname);
        setMode('login');
        setNotice('Password updated. Sign in with your new password.');
      } else {
        const result = await api<{ user: User; csrfToken: string }>(`/auth/${mode}`, {
          method: 'POST',
          body:
            mode === 'register'
              ? {
                  email: data.get('email'),
                  password: data.get('password'),
                  displayName: data.get('displayName'),
                }
              : { email: data.get('email'), password: data.get('password') },
        });
        setCsrf(result.csrfToken);
        onSignedIn(result.user);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-layout">
      <section className="auth-story" aria-label="Kampanya introduction">
        <div className="brand-wordmark">
          Kampanya<span className="brand-dot">.</span>
        </div>
        <div className="auth-story-inner">
          <p className="eyebrow light">A clearer way to create</p>
          <h1>
            Your campaigns,
            <br />
            <em>made smarter.</em>
          </h1>
          <p>
            Bring your business voice, ideas, reviews, and campaign plans into one thoughtful
            workspace.
          </p>
        </div>
        <p className="auth-foot">Made for the work behind every small business campaign.</p>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <p className="eyebrow">WELCOME TO KAMPANYA</p>
          <h2>
            {mode === 'register'
              ? 'Create your account'
              : mode === 'forgot'
                ? 'Recover your account'
                : mode === 'reset'
                  ? 'Choose a new password'
                  : 'Sign in to your workspace'}
          </h2>
          <p className="subtle">
            {mode === 'forgot'
              ? 'We will prepare a single-use recovery link.'
              : mode === 'register'
                ? 'Start with your account. Add a business next.'
                : 'Keep your campaigns moving with your team.'}
          </p>
          <form onSubmit={submit} className="form-stack">
            {mode === 'register' && (
              <label>
                Full name
                <input name="displayName" autoComplete="name" required maxLength={100} />
              </label>
            )}
            {mode !== 'reset' && (
              <label>
                Email address
                <input name="email" type="email" autoComplete="email" required />
              </label>
            )}
            {mode !== 'forgot' && (
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={mode === 'login' ? undefined : 12}
                  required
                />
                <span className="field-hint">
                  {mode === 'login' ? '' : 'At least 12 characters.'}
                </span>
              </label>
            )}
            {error && (
              <p className="alert error" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="alert success" role="status">
                {notice}
              </p>
            )}
            <button className="button primary" disabled={busy}>
              {busy
                ? 'Please wait…'
                : mode === 'register'
                  ? 'Create account'
                  : mode === 'forgot'
                    ? 'Prepare recovery link'
                    : mode === 'reset'
                      ? 'Update password'
                      : 'Sign in'}
            </button>
          </form>
          <div className="auth-links">
            {mode !== 'login' && (
              <button
                className="text-button"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
              >
                Back to sign in
              </button>
            )}
            {mode === 'login' && (
              <>
                <button className="text-button" onClick={() => setMode('register')}>
                  Create an account
                </button>
                <button className="text-button" onClick={() => setMode('forgot')}>
                  Forgot password?
                </button>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

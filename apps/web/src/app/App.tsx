import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, setCsrf, type Business, type User } from './api';
import { Auth } from '../features/identity/Auth';
import { Workspace } from '../features/workspace/Workspace';

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const invitation = new URLSearchParams(location.hash.slice(1)).get('invite');
  const loadBusinesses = useCallback(async () => {
    const result = await api<{ businesses: Business[] }>('/businesses');
    setBusinesses(result.businesses);
    setSelectedId((previous) =>
      result.businesses.some((item) => item.id === previous)
        ? previous
        : (result.businesses[0]?.id ?? ''),
    );
  }, []);
  useEffect(() => {
    api<{ user: User; csrfToken: string }>('/auth/me')
      .then(async (result) => {
        setCsrf(result.csrfToken);
        setUser(result.user);
        await loadBusinesses();
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [loadBusinesses]);
  async function signedIn(next: User) {
    setUser(next);
    try {
      await loadBusinesses();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load businesses');
    }
  }
  async function createBusiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      const result = await api<{ business: Business }>('/businesses', {
        method: 'POST',
        body: {
          name: data.get('name'),
          description: data.get('description') || null,
          industry: data.get('industry') || null,
          timezone: 'Asia/Manila',
        },
      });
      await loadBusinesses();
      setSelectedId(result.business.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create business');
    } finally {
      setBusy(false);
    }
  }
  async function acceptInvitation() {
    if (!invitation) return;
    setBusy(true);
    setError('');
    try {
      await api('/auth/invitations/accept', { method: 'POST', body: { token: invitation } });
      history.replaceState(null, '', location.pathname);
      await loadBusinesses();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not accept invitation');
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      await api('/auth/logout', { method: 'POST' });
      setCsrf('');
      setUser(null);
      setBusinesses([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign out');
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <main className="loading-page" role="status">
        Opening Kampanya…
      </main>
    );
  if (!user) return <Auth onSignedIn={signedIn} />;
  const selected = businesses.find((item) => item.id === selectedId);
  return (
    <div className="app-root">
      {invitation && (
        <div className="invite-banner">
          <span>You have a business invitation for this account.</span>
          <button className="button small" disabled={busy} onClick={acceptInvitation}>
            Accept invitation
          </button>
        </div>
      )}
      {error && (
        <div className="global-error" role="alert">
          {error}
          <button className="text-button" onClick={() => setError('')}>
            Dismiss
          </button>
        </div>
      )}
      {selected ? (
        <Workspace
          key={selected.id}
          business={selected}
          businesses={businesses}
          user={user}
          onBusinessChange={setSelectedId}
          onBusinessRefresh={loadBusinesses}
          onLogout={logout}
        />
      ) : (
        <main className="onboarding">
          <div className="onboarding-card">
            <p className="eyebrow">FIRST STEP</p>
            <h1>Tell us about your business.</h1>
            <p className="subtle">
              Create a workspace for the people, voice, and plans behind your campaigns.
            </p>
            <form onSubmit={createBusiness} className="form-stack">
              <label>
                Business name
                <input name="name" required maxLength={120} />
              </label>
              <label>
                Industry <span className="optional">optional</span>
                <input name="industry" maxLength={100} />
              </label>
              <label>
                Short description <span className="optional">optional</span>
                <textarea name="description" rows={3} maxLength={2000} />
              </label>
              <button className="button primary" disabled={busy}>
                {busy ? 'Creating…' : 'Create business workspace'}
              </button>
            </form>
            <button className="text-button" onClick={logout}>
              Sign out
            </button>
          </div>
        </main>
      )}
    </div>
  );
}

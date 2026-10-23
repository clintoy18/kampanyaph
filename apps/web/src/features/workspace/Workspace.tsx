import { useState, type FormEvent } from 'react';
import { api, businessPath, type Business, type User } from '../../app/api';
import { BusinessPage } from './BusinessPage';
import { CampaignsPage } from './CampaignsPage';
import { ContentPage } from './ContentPage';
import { ReviewsPage } from './ReviewsPage';
import { StrategyPage } from './StrategyPage';
import { Feedback, useAction } from './common';

type Page = 'business' | 'strategy' | 'content' | 'reviews' | 'campaigns';
const navigation: { id: Page; label: string; number: string }[] = [
  { id: 'business', label: 'Business context', number: '01' },
  { id: 'strategy', label: 'Strategy', number: '02' },
  { id: 'content', label: 'Content studio', number: '03' },
  { id: 'reviews', label: 'Reviews', number: '04' },
  { id: 'campaigns', label: 'Campaigns & calendar', number: '05' },
];
export function Workspace({
  business,
  businesses,
  user,
  onBusinessChange,
  onBusinessRefresh,
  onLogout,
}: {
  business: Business;
  businesses: Business[];
  user: User;
  onBusinessChange: (id: string) => void;
  onBusinessRefresh: () => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  const [page, setPage] = useState<Page>('business');
  const [menuOpen, setMenuOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const action = useAction(onBusinessRefresh);
  const base = businessPath(business.id);
  function go(next: Page) {
    setPage(next);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function createBusiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = await action.run(
      () =>
        api<{ business: Business }>('/businesses', {
          method: 'POST',
          body: {
            name: data.get('name'),
            industry: data.get('industry') || null,
            description: null,
            timezone: 'Asia/Manila',
          },
        }),
      'Business workspace created',
    );
    if (result) {
      setCreating(false);
      onBusinessChange(result.business.id);
    }
  }
  return (
    <div className="workspace-shell">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`} aria-label="Workspace navigation">
        <div className="sidebar-top">
          <div className="brand-wordmark">
            Kampanya<span className="brand-dot">.</span>
          </div>
          <p>Your campaigns, made smarter.</p>
        </div>
        <div className="business-switch">
          <label htmlFor="business-switcher">CURRENT BUSINESS</label>
          <select
            id="business-switcher"
            value={business.id}
            onChange={(event) => {
              onBusinessChange(event.target.value);
              setMenuOpen(false);
            }}
          >
            {businesses.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <button
            className="sidebar-add"
            onClick={() => {
              setCreating(true);
              setMenuOpen(false);
            }}
          >
            + Add business
          </button>
        </div>
        <nav aria-label="Primary">
          <p className="sidebar-label">WORKSPACE</p>
          {navigation.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${page === item.id ? 'active' : ''}`}
              onClick={() => go(item.id)}
              aria-current={page === item.id ? 'page' : undefined}
            >
              <span>{item.label}</span>
              <small>{item.number}</small>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="user-mark" aria-hidden="true">
            {user.displayName.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <strong>{user.displayName}</strong>
            <span>
              {business.role.toLowerCase()} · {user.email}
            </span>
          </div>
          <button className="sidebar-signout" onClick={() => void onLogout()}>
            Sign out
          </button>
        </div>
      </aside>
      <div className="main-column">
        <header className="mobile-header">
          <button
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
          <div className="brand-wordmark">
            Kampanya<span className="brand-dot">.</span>
          </div>
          <span>{business.name}</span>
        </header>
        <main className="workspace-main" id="main-content">
          {creating && (
            <section className="panel new-business-panel">
              <div className="panel-heading">
                <h2>Add another business</h2>
                <button className="text-button" onClick={() => setCreating(false)}>
                  Cancel
                </button>
              </div>
              <Feedback error={action.error} notice={action.notice} />
              <form className="form-columns" onSubmit={(event) => void createBusiness(event)}>
                <label>
                  Business name
                  <input name="name" required maxLength={120} />
                </label>
                <label>
                  Industry <span className="optional">optional</span>
                  <input name="industry" maxLength={100} />
                </label>
                <button className="button primary" disabled={action.busy}>
                  Create workspace
                </button>
              </form>
            </section>
          )}
          {page === 'business' && (
            <BusinessPage business={business} base={base} onBusinessRefresh={onBusinessRefresh} />
          )}
          {page === 'strategy' && (
            <StrategyPage business={business} base={base} onOpenContent={() => go('content')} />
          )}
          {page === 'content' && <ContentPage business={business} base={base} />}
          {page === 'reviews' && <ReviewsPage business={business} base={base} user={user} />}
          {page === 'campaigns' && <CampaignsPage business={business} base={base} />}
        </main>
        <footer className="workspace-footer">
          Kampanya · Thoughtful campaigns for growing businesses
        </footer>
      </div>
    </div>
  );
}

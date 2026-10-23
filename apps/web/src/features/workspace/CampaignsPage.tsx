import { useState, type FormEvent } from 'react';
import { api, type Business, type BusinessPath, type Campaign, type Content } from '../../app/api';
import { Empty, Feedback, Loading, SectionTitle, Status, useAction, useResource } from './common';
import { businessTimeToIso } from './time';

function dayKey(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function monthRange(month: string) {
  const [year, index] = month.split('-').map(Number);
  const last = new Date(Date.UTC(year, index, 0)).getUTCDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(last).padStart(2, '0')}`,
    days: last,
    offset: new Date(Date.UTC(year, index - 1, 1)).getUTCDay(),
  };
}

export function CampaignsPage({ business, base }: { business: Business; base: BusinessPath }) {
  const campaigns = useResource<{ campaigns: Campaign[] }>(`${base}/campaigns`);
  const [month, setMonth] = useState(
    dayKey(new Date().toISOString(), business.timezone).slice(0, 7),
  );
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [editingId, setEditingId] = useState('');
  const range = monthRange(month);
  const calendar = useResource<{ content: Content[] }>(
    `${base}/calendar?from=${range.from}&to=${range.to}`,
  );
  const action = useAction(async () => {
    await Promise.all([campaigns.refresh(), calendar.refresh()]);
  });
  const canEdit = business.role !== 'REVIEWER';
  const items = calendar.data?.content ?? [];
  const byDay = new Map<string, Content[]>();
  for (const item of items)
    if (item.plannedAt) {
      const key = dayKey(item.plannedAt, business.timezone);
      byDay.set(key, [...(byDay.get(key) ?? []), item]);
    }
  const monthLabel = new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-PH', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  function shift(delta: number) {
    const date = new Date(`${month}-01T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + delta);
    setMonth(date.toISOString().slice(0, 7));
  }
  if (campaigns.loading || calendar.loading) return <Loading />;
  return (
    <>
      <SectionTitle
        eyebrow="CAMPAIGN PLANNING"
        title="See the whole story."
        description={`Organize content by campaign and planned date. Times follow ${business.timezone}; publishing remains a manual action.`}
      />
      <Feedback error={action.error || campaigns.error || calendar.error} notice={action.notice} />
      <div className="workspace-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">ACTIVE PLANS</p>
              <h2>Campaigns</h2>
            </div>
          </div>
          {campaigns.data?.campaigns.length ? (
            <ul className="stack-list">
              {campaigns.data.campaigns.map((item) => (
                <li key={item.id}>
                  <strong>{item.title}</strong>
                  <p>{item.objective}</p>
                  <span className="field-hint">{item._count?.contentItems ?? 0} content items</span>
                  {canEdit && (
                    <details
                      open={editingId === item.id}
                      onToggle={(event) => setEditingId(event.currentTarget.open ? item.id : '')}
                    >
                      <summary>Edit campaign</summary>
                      <form
                        className="inline-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const data = new FormData(event.currentTarget);
                          void action.run(
                            () =>
                              api(`${base}/campaigns/${item.id}`, {
                                method: 'PATCH',
                                body: {
                                  title: data.get('title'),
                                  objective: data.get('objective'),
                                  startsAt: data.get('startsAt')
                                    ? businessTimeToIso(
                                        `${data.get('startsAt')}T00:00`,
                                        business.timezone,
                                      )
                                    : null,
                                  endsAt: data.get('endsAt')
                                    ? businessTimeToIso(
                                        `${data.get('endsAt')}T00:00`,
                                        business.timezone,
                                      )
                                    : null,
                                },
                              }),
                            'Campaign updated',
                          );
                        }}
                      >
                        <label>
                          Title
                          <input name="title" defaultValue={item.title} required />
                        </label>
                        <label>
                          Objective
                          <textarea name="objective" defaultValue={item.objective} required />
                        </label>
                        <label>
                          Start <span className="optional">optional</span>
                          <input
                            name="startsAt"
                            type="date"
                            defaultValue={
                              item.startsAt ? dayKey(item.startsAt, business.timezone) : ''
                            }
                          />
                        </label>
                        <label>
                          End <span className="optional">optional</span>
                          <input
                            name="endsAt"
                            type="date"
                            defaultValue={item.endsAt ? dayKey(item.endsAt, business.timezone) : ''}
                          />
                        </label>
                        <button className="button small" disabled={action.busy}>
                          Save
                        </button>
                      </form>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="No campaigns yet">
              Create a campaign to gather related content around one objective.
            </Empty>
          )}
        </section>
        {canEdit && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">NEW CAMPAIGN</p>
                <h2>Plan the next chapter</h2>
              </div>
            </div>
            <form
              className="form-stack"
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                const form = event.currentTarget;
                const data = new FormData(form);
                void action
                  .run(
                    () =>
                      api(`${base}/campaigns`, {
                        method: 'POST',
                        body: {
                          title: data.get('title'),
                          objective: data.get('objective'),
                          startsAt: data.get('startsAt')
                            ? businessTimeToIso(`${data.get('startsAt')}T00:00`, business.timezone)
                            : null,
                          endsAt: data.get('endsAt')
                            ? businessTimeToIso(`${data.get('endsAt')}T00:00`, business.timezone)
                            : null,
                        },
                      }),
                    'Campaign created',
                  )
                  .then((result) => {
                    if (result) form.reset();
                  });
              }}
            >
              <label>
                Campaign title
                <input name="title" required maxLength={160} />
              </label>
              <label>
                Objective
                <textarea
                  name="objective"
                  required
                  rows={3}
                  maxLength={2000}
                  placeholder="What should this campaign accomplish?"
                />
              </label>
              <div className="form-columns">
                <label>
                  Start date <span className="optional">optional</span>
                  <input name="startsAt" type="date" />
                </label>
                <label>
                  End date <span className="optional">optional</span>
                  <input name="endsAt" type="date" />
                </label>
              </div>
              <button className="button primary" disabled={action.busy}>
                Create campaign
              </button>
            </form>
          </section>
        )}
      </div>
      <section className="panel calendar-panel">
        <div className="panel-heading calendar-heading">
          <div>
            <p className="eyebrow">CONTENT CALENDAR</p>
            <h2>{monthLabel}</h2>
          </div>
          <div className="calendar-controls">
            <button
              className="button small secondary"
              onClick={() => shift(-1)}
              aria-label="Previous month"
            >
              ←
            </button>
            <button
              className="button small secondary"
              onClick={() => shift(1)}
              aria-label="Next month"
            >
              →
            </button>
            <div className="segmented" role="group" aria-label="Calendar view">
              <button
                className={view === 'calendar' ? 'active' : ''}
                onClick={() => setView('calendar')}
              >
                Grid
              </button>
              <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>
                List
              </button>
            </div>
          </div>
        </div>
        {view === 'calendar' ? (
          <div className="calendar-grid" role="group" aria-label={`${monthLabel} planned content`}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div className="calendar-weekday" key={day}>
                {day}
              </div>
            ))}
            {Array.from({ length: range.offset }, (_, index) => (
              <div className="calendar-day muted-day" key={`pad-${index}`} aria-hidden="true" />
            ))}
            {Array.from({ length: range.days }, (_, index) => {
              const key = `${month}-${String(index + 1).padStart(2, '0')}`;
              const dayItems = byDay.get(key) ?? [];
              return (
                <div className="calendar-day" key={key}>
                  <time dateTime={key}>{index + 1}</time>
                  {dayItems.map((item) => (
                    <div className="calendar-event" key={item.id} title={item.title}>
                      <span>{item.title}</span>
                      <Status value={item.status} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="calendar-list">
            {[...byDay.entries()]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([day, dayItems]) => (
                <div className="calendar-list-day" key={day}>
                  <h3>
                    <time dateTime={day}>
                      {new Date(`${day}T00:00:00Z`).toLocaleDateString('en-PH', {
                        dateStyle: 'full',
                        timeZone: 'UTC',
                      })}
                    </time>
                  </h3>
                  {dayItems.map((item) => (
                    <div key={item.id}>
                      <strong>{item.title}</strong>
                      <span>
                        {item.campaign?.title || 'No campaign'} · {item.platform}
                      </span>
                      <Status value={item.status} />
                    </div>
                  ))}
                </div>
              ))}
            {!items.length && (
              <Empty title="Nothing planned this month">
                Add a planned date to content in the Content studio to see it here.
              </Empty>
            )}
          </div>
        )}
        {items.length > 1 && [...byDay.values()].some((group) => group.length > 1) && (
          <p className="field-hint">
            Several pieces share a date. Check timing in the content editor to avoid overlap.
          </p>
        )}
      </section>
    </>
  );
}

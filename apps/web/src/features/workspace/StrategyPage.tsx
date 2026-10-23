import { useState } from 'react';
import {
  api,
  type Audience,
  type Brief,
  type Business,
  type BusinessPath,
  type Evidence,
} from '../../app/api';
import { Empty, Feedback, Loading, SectionTitle, useAction, useResource } from './common';

export function StrategyPage({
  business,
  base,
  onOpenContent,
}: {
  business: Business;
  base: BusinessPath;
  onOpenContent: () => void;
}) {
  const briefs = useResource<{ briefs: Brief[] }>(`${base}/briefs`);
  const audiences = useResource<{ audiences: Audience[] }>(`${base}/audiences`);
  const evidence = useResource<{ evidence: Evidence[] }>(`${base}/evidence`);
  const [selectedId, setSelectedId] = useState('');
  const action = useAction(briefs.refresh);
  const canEdit = business.role !== 'REVIEWER';
  const selected =
    briefs.data?.briefs.find((item) => item.id === selectedId) ?? briefs.data?.briefs[0];
  if (briefs.loading || audiences.loading || evidence.loading) return <Loading />;
  return (
    <>
      <SectionTitle
        eyebrow="STRATEGY WORKBENCH"
        title="Start with intent."
        description="Shape a useful direction before drafting copy. AI suggestions remain editable and grounded in your business context."
      />
      <Feedback
        error={action.error || briefs.error || audiences.error || evidence.error}
        notice={action.notice}
      />
      {canEdit && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">NEW BRIEF</p>
              <h2>Define the campaign idea</h2>
            </div>
          </div>
          {audiences.data?.audiences.length ? (
            <form
              className="form-columns"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                void action
                  .run(
                    () =>
                      api<{ brief: Brief }>(`${base}/briefs`, {
                        method: 'POST',
                        body: {
                          audienceId: data.get('audienceId'),
                          objective: data.get('objective'),
                          platform: data.get('platform'),
                          campaignTheme: data.get('campaignTheme') || null,
                          hook: data.get('hook') || null,
                          valueProposition: data.get('valueProposition') || null,
                          trustEvidenceId: data.get('trustEvidenceId') || null,
                          callToAction: data.get('callToAction') || null,
                        },
                      }),
                    'Brief created',
                  )
                  .then((result) => {
                    if (result) setSelectedId(result.brief.id);
                  });
              }}
            >
              <label>
                Target audience
                <select name="audienceId" required>
                  {audiences.data.audiences.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Platform
                <input
                  name="platform"
                  required
                  maxLength={60}
                  placeholder="Facebook, Instagram, print…"
                />
              </label>
              <label className="full">
                Marketing objective
                <input
                  name="objective"
                  required
                  minLength={3}
                  maxLength={500}
                  placeholder="Invite nearby families to try our weekday lunch"
                />
              </label>
              <label>
                Campaign theme <span className="optional">optional</span>
                <input name="campaignTheme" maxLength={200} />
              </label>
              <label>
                Hook <span className="optional">optional</span>
                <input name="hook" maxLength={300} />
              </label>
              <label>
                Value proposition <span className="optional">optional</span>
                <input name="valueProposition" maxLength={500} />
              </label>
              <label>
                Call to action <span className="optional">optional</span>
                <input name="callToAction" maxLength={300} />
              </label>
              <label>
                Confirmed trust evidence <span className="optional">optional</span>
                <select name="trustEvidenceId">
                  <option value="">No trust claim</option>
                  {evidence.data?.evidence
                    .filter((item) => item.confirmedAt)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                </select>
              </label>
              <div className="full">
                <button className="button primary" disabled={action.busy}>
                  Create brief
                </button>
              </div>
            </form>
          ) : (
            <Empty title="Add an audience first">
              Strategy starts with a clear understanding of who you want to reach. Add one in
              Business context.
            </Empty>
          )}
        </section>
      )}
      <div className="two-column">
        <aside className="panel list-panel">
          <p className="eyebrow">SAVED BRIEFS</p>
          {briefs.data?.briefs.length ? (
            <ul className="select-list">
              {briefs.data.briefs.map((item) => (
                <li key={item.id}>
                  <button
                    className={selected?.id === item.id ? 'selected' : ''}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <strong>{item.objective}</strong>
                    <span>
                      {item.audience.name} · {item.platform}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="No briefs yet">Create a brief to guide your first draft.</Empty>
          )}
        </aside>
        <section className="panel detail-panel">
          {selected ? (
            <>
              <p className="eyebrow">BRIEF / {selected.platform.toUpperCase()}</p>
              <h2>{selected.objective}</h2>
              <dl className="detail-list">
                <div>
                  <dt>Audience insight</dt>
                  <dd>{selected.audience.needs}</dd>
                </div>
                <div>
                  <dt>Hook</dt>
                  <dd>{selected.hook || 'Let AI suggest an angle'}</dd>
                </div>
                <div>
                  <dt>Value</dt>
                  <dd>{selected.valueProposition || 'Use the saved brand proposition'}</dd>
                </div>
                <div>
                  <dt>Trust element</dt>
                  <dd>{selected.trustEvidence?.claim || 'No confirmed evidence linked'}</dd>
                </div>
                <div>
                  <dt>Call to action</dt>
                  <dd>{selected.callToAction || 'Keep it specific and useful'}</dd>
                </div>
              </dl>
              {selected.pillars?.length ? (
                <div className="strategy-output">
                  <h3>Content pillars</h3>
                  <ul>
                    {selected.pillars.map((pillar, index) => (
                      <li key={`${index}-${pillar}`}>{pillar}</li>
                    ))}
                  </ul>
                  <h3>Suggested angles</h3>
                  <ul>
                    {selected.angles?.map((angle, index) => (
                      <li key={`${index}-${angle}`}>{angle}</li>
                    ))}
                  </ul>
                  <p>{selected.rationale}</p>
                </div>
              ) : null}
              {canEdit && (
                <div className="action-row">
                  <button
                    className="button secondary"
                    disabled={action.busy}
                    onClick={() =>
                      void action.run(
                        () => api(`${base}/briefs/${selected.id}/suggest`, { method: 'POST' }),
                        'Strategy suggestions ready',
                      )
                    }
                  >
                    Suggest strategy
                  </button>
                  <button
                    className="button primary"
                    disabled={action.busy}
                    onClick={() =>
                      void action
                        .run(
                          () => api(`${base}/briefs/${selected.id}/generate`, { method: 'POST' }),
                          'Editable draft created',
                        )
                        .then((result) => {
                          if (result) onOpenContent();
                        })
                    }
                  >
                    Generate content draft
                  </button>
                </div>
              )}
              <p className="field-hint">
                AI drafts need fact checks, editing, and approval before use. No content is
                published automatically.
              </p>
            </>
          ) : (
            <Empty title="Select a brief">Choose a saved brief to review its direction.</Empty>
          )}
        </section>
      </div>
    </>
  );
}

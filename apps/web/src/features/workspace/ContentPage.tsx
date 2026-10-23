import { useEffect, useState, type FormEvent } from 'react';
import { api, type Business, type BusinessPath, type Campaign, type Content } from '../../app/api';
import { Empty, Feedback, Loading, SectionTitle, Status, useAction, useResource } from './common';
import { businessDateTime, businessTimeToIso } from './time';

export function ContentPage({ business, base }: { business: Business; base: BusinessPath }) {
  const list = useResource<{ content: Content[] }>(`${base}/content`);
  const campaigns = useResource<{ campaigns: Campaign[] }>(`${base}/campaigns`);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<Content | null>(null);
  const [body, setBody] = useState('');
  const [detailError, setDetailError] = useState('');
  const canEdit = business.role !== 'REVIEWER';
  const activeId = selectedId || list.data?.content[0]?.id;
  async function refresh() {
    await list.refresh();
    if (activeId) {
      const result = await api<{ content: Content }>(`${base}/content/${activeId}`);
      setDetail(result.content);
      setBody(result.content.revisions[0]?.body ?? '');
    }
  }
  const action = useAction(refresh);
  useEffect(() => {
    if (!activeId) {
      setDetail(null);
      return;
    }
    api<{ content: Content }>(`${base}/content/${activeId}`)
      .then((result) => {
        setDetail(result.content);
        setBody(result.content.revisions[0]?.body ?? '');
        setDetailError('');
      })
      .catch((cause) =>
        setDetailError(cause instanceof Error ? cause.message : 'Could not load draft'),
      );
  }, [activeId, base]);
  if (list.loading || campaigns.loading) return <Loading />;
  return (
    <>
      <SectionTitle
        eyebrow="CONTENT STUDIO"
        title="Make every word yours."
        description="Generated copy is a starting point. Edit, check facts, and submit a revision for another team member to review."
      />
      <Feedback
        error={action.error || list.error || campaigns.error || detailError}
        notice={action.notice}
      />
      <div className="two-column">
        <aside className="panel list-panel">
          <p className="eyebrow">DRAFTS & CONTENT</p>
          {list.data?.content.length ? (
            <ul className="select-list">
              {list.data.content.map((item) => (
                <li key={item.id}>
                  <button
                    className={activeId === item.id ? 'selected' : ''}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <strong>{item.title}</strong>
                    <span>
                      {item.platform} · {item.status.replaceAll('_', ' ').toLowerCase()}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="No content yet">
              Create a strategy brief, then generate an editable draft.
            </Empty>
          )}
        </aside>
        <section className="panel detail-panel">
          {detail && detail.id === activeId ? (
            <>
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">CONTENT / {detail.platform.toUpperCase()}</p>
                  <h2>{detail.title}</h2>
                </div>
                <Status value={detail.status} />
              </div>
              <div className="editor-meta">
                <span>Revision {detail.revisions[0]?.version ?? '—'}</span>
                <span>{detail.campaign?.title || 'No campaign'}</span>
              </div>
              {canEdit && detail.status !== 'IN_REVIEW' ? (
                <form
                  className="form-stack"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void action.run(
                      () =>
                        api(`${base}/content/${detail.id}/revisions`, {
                          method: 'POST',
                          body: { body, expectedVersion: detail.revisions[0]?.version },
                        }),
                      'New revision saved',
                    );
                  }}
                >
                  <label className="editor-label">
                    Draft copy
                    <textarea
                      className="content-editor"
                      value={body}
                      onChange={(event) => setBody(event.target.value)}
                      maxLength={4000}
                      required
                      rows={12}
                    />
                  </label>
                  <div className="editor-toolbar">
                    <span>{body.length} / 4,000 characters</span>
                    <button
                      className="button secondary"
                      disabled={action.busy || body === detail.revisions[0]?.body}
                    >
                      Save revision
                    </button>
                  </div>
                </form>
              ) : (
                <div className="read-copy">
                  <p className="eyebrow">CURRENT COPY</p>
                  <p>{detail.revisions[0]?.body}</p>
                </div>
              )}
              {canEdit && detail.status !== 'IN_REVIEW' && (
                <form
                  className="inline-form form-columns metadata-form"
                  key={detail.id + detail.status}
                  onSubmit={(event: FormEvent<HTMLFormElement>) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    const raw = String(data.get('plannedAt') ?? '');
                    void action.run(
                      () =>
                        api(`${base}/content/${detail.id}`, {
                          method: 'PATCH',
                          body: {
                            title: data.get('title'),
                            platform: data.get('platform'),
                            campaignId: data.get('campaignId') || null,
                            plannedAt: raw ? businessTimeToIso(raw, business.timezone) : null,
                          },
                        }),
                      'Content details saved',
                    );
                  }}
                >
                  <h3 className="full">Planning details</h3>
                  <label>
                    Title
                    <input name="title" defaultValue={detail.title} required />
                  </label>
                  <label>
                    Platform
                    <input name="platform" defaultValue={detail.platform} required />
                  </label>
                  <label>
                    Campaign
                    <select name="campaignId" defaultValue={detail.campaignId ?? ''}>
                      <option value="">Unassigned</option>
                      {campaigns.data?.campaigns.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Planned time ({business.timezone}) <span className="optional">optional</span>
                    <input
                      name="plannedAt"
                      type="datetime-local"
                      defaultValue={businessDateTime(detail.plannedAt, business.timezone)}
                    />
                  </label>
                  <button className="button secondary" disabled={action.busy}>
                    Save planning details
                  </button>
                </form>
              )}
              {canEdit && (
                <div className="action-row workflow-actions">
                  {detail.status === 'DRAFT' && (
                    <button
                      className="button primary"
                      disabled={action.busy || body !== detail.revisions[0]?.body}
                      onClick={() =>
                        void action.run(
                          () => api(`${base}/content/${detail.id}/submit`, { method: 'POST' }),
                          'Draft submitted for review',
                        )
                      }
                    >
                      Submit for review
                    </button>
                  )}
                  {detail.status === 'APPROVED' && (
                    <button
                      className="button primary"
                      disabled={action.busy}
                      onClick={() =>
                        void action.run(
                          () => api(`${base}/content/${detail.id}/publish`, { method: 'POST' }),
                          'Marked published manually',
                        )
                      }
                    >
                      Mark as published
                    </button>
                  )}
                </div>
              )}
              {detail.status === 'IN_REVIEW' && (
                <p className="alert info">
                  This revision is waiting for a reviewer. Edits reopen after a change request.
                </p>
              )}
              <div className="revision-history">
                <h3>Revision and decision history</h3>
                {detail.revisions.map((item) => (
                  <details key={item.id}>
                    <summary>
                      Revision {item.version} · {new Date(item.createdAt).toLocaleDateString()}
                    </summary>
                    <p>{item.body}</p>
                  </details>
                ))}
                {detail.reviewDecisions?.map((item) => (
                  <p key={item.id}>
                    <Status value={item.outcome} /> {item.note || 'No feedback note'} ·{' '}
                    {new Date(item.createdAt).toLocaleDateString()}
                  </p>
                ))}
              </div>
            </>
          ) : (
            <Empty title="Select a draft">
              Choose content from the list to edit or review its history.
            </Empty>
          )}
        </section>
      </div>
    </>
  );
}

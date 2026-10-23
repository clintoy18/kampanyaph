import { useState } from 'react';
import { api, type Business, type BusinessPath, type Content, type User } from '../../app/api';
import { Empty, Feedback, Loading, SectionTitle, Status, useAction, useResource } from './common';

export function ReviewsPage({
  business,
  base,
  user,
}: {
  business: Business;
  base: BusinessPath;
  user: User;
}) {
  const list = useResource<{ content: Content[] }>(`${base}/content`);
  const [selectedId, setSelectedId] = useState('');
  const [note, setNote] = useState('');
  const [factsChecked, setFactsChecked] = useState(false);
  const [brandChecked, setBrandChecked] = useState(false);
  const [ctaChecked, setCtaChecked] = useState(false);
  const action = useAction(list.refresh);
  const queue = list.data?.content.filter((item) => item.status === 'IN_REVIEW') ?? [];
  const selected = queue.find((item) => item.id === selectedId) ?? queue[0];
  const canDecide =
    business.role !== 'EDITOR' &&
    selected &&
    selected.createdById !== user.id &&
    selected.revisions[0]?.authorId !== user.id;
  async function decide(outcome: 'APPROVED' | 'CHANGES_REQUESTED') {
    if (!selected) return;
    const result = await action.run(
      () =>
        api(`${base}/content/${selected.id}/decisions`, {
          method: 'POST',
          body: {
            outcome,
            note: note || null,
            checklist: { factsChecked, brandChecked, ctaChecked },
          },
        }),
      outcome === 'APPROVED' ? 'Content approved' : 'Changes requested',
    );
    if (result) {
      setNote('');
      setFactsChecked(false);
      setBrandChecked(false);
      setCtaChecked(false);
    }
  }
  if (list.loading) return <Loading />;
  return (
    <>
      <SectionTitle
        eyebrow="REVIEW DESK"
        title="A second pair of eyes."
        description="Check the latest copy for factual accuracy, brand fit, and a clear next step before approval."
      />
      <Feedback error={action.error || list.error} notice={action.notice} />
      {queue.length ? (
        <div className="two-column">
          <aside className="panel list-panel">
            <p className="eyebrow">AWAITING REVIEW / {queue.length}</p>
            <ul className="select-list">
              {queue.map((item) => (
                <li key={item.id}>
                  <button
                    className={selected?.id === item.id ? 'selected' : ''}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <strong>{item.title}</strong>
                    <span>
                      {item.platform} · revision {item.revisions[0]?.version}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
          <section className="panel detail-panel">
            {selected && (
              <>
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">REVIEW / {selected.platform.toUpperCase()}</p>
                    <h2>{selected.title}</h2>
                  </div>
                  <Status value={selected.status} />
                </div>
                <div className="read-copy review-copy">
                  <p>{selected.revisions[0]?.body}</p>
                </div>
                {canDecide ? (
                  <div className="review-checklist">
                    <h3>Review checklist</h3>
                    <label>
                      <input
                        type="checkbox"
                        checked={factsChecked}
                        onChange={(event) => setFactsChecked(event.target.checked)}
                      />{' '}
                      Claims are supported by business evidence
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={brandChecked}
                        onChange={(event) => setBrandChecked(event.target.checked)}
                      />{' '}
                      Voice fits the business and audience
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={ctaChecked}
                        onChange={(event) => setCtaChecked(event.target.checked)}
                      />{' '}
                      Call to action is clear and appropriate
                    </label>
                    <label>
                      Feedback for the author
                      <textarea
                        rows={3}
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        placeholder="Explain any changes requested"
                      />
                    </label>
                    <div className="action-row">
                      <button
                        className="button secondary"
                        disabled={action.busy || !note.trim()}
                        onClick={() => void decide('CHANGES_REQUESTED')}
                      >
                        Request changes
                      </button>
                      <button
                        className="button primary"
                        disabled={action.busy || !factsChecked || !brandChecked || !ctaChecked}
                        onClick={() => void decide('APPROVED')}
                      >
                        Approve revision
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="alert info">
                    {business.role === 'EDITOR'
                      ? 'Editors may view this queue; an Owner or Reviewer makes decisions.'
                      : 'You cannot review content that you created or last revised.'}
                  </p>
                )}
              </>
            )}
          </section>
        </div>
      ) : (
        <Empty title="The review queue is clear">
          Submitted drafts will appear here for an Owner or Reviewer.
        </Empty>
      )}
    </>
  );
}

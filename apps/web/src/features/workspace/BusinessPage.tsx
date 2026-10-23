import { useState, type FormEvent } from 'react';
import {
  api,
  type Audience,
  type Brand,
  type Business,
  type BusinessPath,
  type Evidence,
  type Invitation,
  type Member,
  type Offering,
} from '../../app/api';
import { Empty, Feedback, Loading, SectionTitle, useAction, useResource } from './common';

export function BusinessPage({
  business,
  base,
  onBusinessRefresh,
}: {
  business: Business;
  base: BusinessPath;
  onBusinessRefresh: () => Promise<void>;
}) {
  const brand = useResource<{ brand: Brand }>(`${base}/brand`);
  const audiences = useResource<{ audiences: Audience[] }>(`${base}/audiences`);
  const offerings = useResource<{ offerings: Offering[] }>(`${base}/offerings`);
  const evidence = useResource<{ evidence: Evidence[] }>(`${base}/evidence`);
  const members = useResource<{ members: Member[] }>(
    business.role === 'OWNER' ? `${base}/members` : null,
  );
  const invitations = useResource<{ invitations: Invitation[] }>(
    business.role === 'OWNER' ? `${base}/invitations` : null,
  );
  const [editingCore, setEditingCore] = useState(false);
  const canEdit = business.role !== 'REVIEWER';
  const action = useAction(async () => {
    await Promise.all([
      brand.refresh(),
      audiences.refresh(),
      offerings.refresh(),
      evidence.refresh(),
      onBusinessRefresh(),
      ...(business.role === 'OWNER' ? [members.refresh(), invitations.refresh()] : []),
    ]);
  });
  function formData(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    return new FormData(event.currentTarget);
  }
  if (brand.loading || audiences.loading || offerings.loading || evidence.loading)
    return <Loading />;
  return (
    <>
      <SectionTitle
        eyebrow="BUSINESS CONTEXT"
        title={business.name}
        description="Give every campaign the same clear picture of who you are and who you serve."
      />
      <Feedback
        error={action.error || brand.error || audiences.error || evidence.error || offerings.error}
        notice={action.notice}
      />
      <div className="workspace-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">01 / BUSINESS</p>
              <h2>Business details</h2>
            </div>
            {business.role === 'OWNER' && (
              <button className="text-button" onClick={() => setEditingCore(!editingCore)}>
                {editingCore ? 'Cancel' : 'Edit'}
              </button>
            )}
          </div>
          {editingCore ? (
            <form
              className="form-stack"
              onSubmit={(event) => {
                const data = formData(event);
                void action
                  .run(
                    () =>
                      api(`${base}`, {
                        method: 'PATCH',
                        body: {
                          name: data.get('name'),
                          description: data.get('description') || null,
                          industry: data.get('industry') || null,
                          timezone: data.get('timezone'),
                        },
                      }),
                    'Business details saved',
                  )
                  .then((result) => {
                    if (result) setEditingCore(false);
                  });
              }}
            >
              <label>
                Business name
                <input name="name" defaultValue={business.name} required />
              </label>
              <label>
                Industry
                <input name="industry" defaultValue={business.industry ?? ''} />
              </label>
              <label>
                Description
                <textarea name="description" defaultValue={business.description ?? ''} />
              </label>
              <label>
                Timezone
                <input name="timezone" defaultValue={business.timezone} required />
              </label>
              <button className="button primary" disabled={action.busy}>
                Save details
              </button>
            </form>
          ) : (
            <dl className="detail-list">
              <div>
                <dt>Industry</dt>
                <dd>{business.industry || 'Add an industry'}</dd>
              </div>
              <div>
                <dt>Description</dt>
                <dd>{business.description || 'Add a short description'}</dd>
              </div>
              <div>
                <dt>Timezone</dt>
                <dd>{business.timezone}</dd>
              </div>
            </dl>
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">02 / VOICE</p>
              <h2>Brand voice</h2>
            </div>
          </div>
          {canEdit ? (
            <form
              className="form-stack"
              key={brand.data?.brand?.voice ?? 'new'}
              onSubmit={(event) => {
                const data = formData(event);
                void action.run(
                  () =>
                    api(`${base}/brand`, {
                      method: 'PUT',
                      body: {
                        voice: data.get('voice'),
                        valueProposition: data.get('valueProposition') || null,
                        boundaries: data.get('boundaries') || null,
                      },
                    }),
                  'Brand voice saved',
                );
              }}
            >
              <label>
                Voice and tone
                <textarea
                  name="voice"
                  rows={3}
                  defaultValue={brand.data?.brand?.voice ?? ''}
                  required
                  placeholder="Warm, direct, and helpful"
                />
              </label>
              <label>
                Value proposition
                <textarea
                  name="valueProposition"
                  rows={2}
                  defaultValue={brand.data?.brand?.valueProposition ?? ''}
                  placeholder="What makes your offer useful?"
                />
              </label>
              <label>
                Claims or language to avoid
                <textarea
                  name="boundaries"
                  rows={2}
                  defaultValue={brand.data?.brand?.boundaries ?? ''}
                />
              </label>
              <button className="button secondary" disabled={action.busy}>
                Save brand voice
              </button>
            </form>
          ) : (
            <dl className="detail-list">
              <div>
                <dt>Voice</dt>
                <dd>{brand.data?.brand?.voice || 'No voice defined yet'}</dd>
              </div>
              <div>
                <dt>Value proposition</dt>
                <dd>{brand.data?.brand?.valueProposition || 'None yet'}</dd>
              </div>
            </dl>
          )}
        </section>
      </div>
      <div className="workspace-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">03 / PEOPLE</p>
              <h2>Target audiences</h2>
            </div>
          </div>
          {audiences.data?.audiences.length ? (
            <ul className="stack-list">
              {audiences.data.audiences.map((item) => (
                <li key={item.id}>
                  <strong>{item.name}</strong>
                  <p>{item.needs}</p>
                  {canEdit && (
                    <details>
                      <summary>Edit audience</summary>
                      <form
                        className="inline-form"
                        onSubmit={(event) => {
                          const data = formData(event);
                          void action.run(
                            () =>
                              api(`${base}/audiences/${item.id}`, {
                                method: 'PATCH',
                                body: { name: data.get('name'), needs: data.get('needs') },
                              }),
                            'Audience updated',
                          );
                        }}
                      >
                        <label>
                          Name
                          <input name="name" defaultValue={item.name} required />
                        </label>
                        <label>
                          Needs
                          <textarea name="needs" defaultValue={item.needs} required />
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
            <Empty title="No audiences yet">
              Add the people you want to reach before writing a strategy.
            </Empty>
          )}
          {canEdit && (
            <form
              className="inline-form"
              onSubmit={(event) => {
                const form = event.currentTarget;
                const data = formData(event);
                void action
                  .run(
                    () =>
                      api(`${base}/audiences`, {
                        method: 'POST',
                        body: { name: data.get('name'), needs: data.get('needs') },
                      }),
                    'Audience added',
                  )
                  .then((result) => {
                    if (result) form.reset();
                  });
              }}
            >
              <h3>Add an audience</h3>
              <label>
                Audience name
                <input name="name" required placeholder="Neighborhood customers" />
              </label>
              <label>
                Needs and motivations
                <textarea name="needs" rows={2} required placeholder="What matters to them?" />
              </label>
              <button className="button secondary" disabled={action.busy}>
                Add audience
              </button>
            </form>
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">04 / OFFER</p>
              <h2>Products and services</h2>
            </div>
          </div>
          {offerings.data?.offerings.length ? (
            <ul className="stack-list">
              {offerings.data.offerings.map((item) => (
                <li key={item.id}>
                  <strong>{item.name}</strong>
                  <p>{item.description}</p>
                  {canEdit && (
                    <details>
                      <summary>Edit offer</summary>
                      <form
                        className="inline-form"
                        onSubmit={(event) => {
                          const data = formData(event);
                          void action.run(
                            () =>
                              api(`${base}/offerings/${item.id}`, {
                                method: 'PATCH',
                                body: {
                                  name: data.get('name'),
                                  description: data.get('description'),
                                },
                              }),
                            'Offer updated',
                          );
                        }}
                      >
                        <label>
                          Name
                          <input name="name" defaultValue={item.name} required />
                        </label>
                        <label>
                          Description
                          <textarea name="description" defaultValue={item.description} required />
                        </label>
                        <button className="button small" disabled={action.busy}>
                          Save offer
                        </button>
                      </form>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="No offers recorded">
              Describe what customers can actually buy or book.
            </Empty>
          )}
          {canEdit && (
            <form
              className="inline-form"
              onSubmit={(event) => {
                const form = event.currentTarget;
                const data = formData(event);
                void action
                  .run(
                    () =>
                      api(`${base}/offerings`, {
                        method: 'POST',
                        body: { name: data.get('name'), description: data.get('description') },
                      }),
                    'Offer added',
                  )
                  .then((result) => {
                    if (result) form.reset();
                  });
              }}
            >
              <h3>Add an offer</h3>
              <label>
                Name
                <input name="name" required />
              </label>
              <label>
                Description
                <textarea name="description" rows={2} required />
              </label>
              <button className="button secondary" disabled={action.busy}>
                Add offer
              </button>
            </form>
          )}
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">05 / PROOF</p>
            <h2>Marketing evidence</h2>
          </div>
        </div>
        <p className="subtle">
          Only Owner-confirmed evidence may support AI trust claims. Keep the source clear and
          current.
        </p>
        {evidence.data?.evidence.length ? (
          <ul className="stack-list evidence-list">
            {evidence.data.evidence.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.claim}</p>
                  {item.sourceUrl && (
                    <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                      View source
                    </a>
                  )}
                  {canEdit && (
                    <details>
                      <summary>Edit evidence</summary>
                      <form
                        className="inline-form"
                        onSubmit={(event) => {
                          const data = formData(event);
                          void action.run(
                            () =>
                              api(`${base}/evidence/${item.id}`, {
                                method: 'PATCH',
                                body: {
                                  label: data.get('label'),
                                  claim: data.get('claim'),
                                  sourceUrl: data.get('sourceUrl') || null,
                                },
                              }),
                            'Evidence updated; Owner confirmation is required again',
                          );
                        }}
                      >
                        <label>
                          Label
                          <input name="label" defaultValue={item.label} required />
                        </label>
                        <label>
                          Specific claim
                          <textarea name="claim" defaultValue={item.claim} required />
                        </label>
                        <label>
                          Source URL
                          <input name="sourceUrl" type="url" defaultValue={item.sourceUrl ?? ''} />
                        </label>
                        <button className="button small" disabled={action.busy}>
                          Save evidence
                        </button>
                      </form>
                    </details>
                  )}
                </div>
                <div>
                  {item.confirmedAt ? (
                    <span className="status status-approved">confirmed</span>
                  ) : business.role === 'OWNER' ? (
                    <button
                      className="button small"
                      disabled={action.busy}
                      onClick={() =>
                        void action.run(
                          () => api(`${base}/evidence/${item.id}/confirm`, { method: 'POST' }),
                          'Evidence confirmed',
                        )
                      }
                    >
                      Confirm
                    </button>
                  ) : (
                    <span className="status">unconfirmed</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="No evidence recorded">
            Record verifiable facts before adding a trust element to generated copy.
          </Empty>
        )}
        {canEdit && (
          <form
            className="inline-form form-columns"
            onSubmit={(event) => {
              const form = event.currentTarget;
              const data = formData(event);
              void action
                .run(
                  () =>
                    api(`${base}/evidence`, {
                      method: 'POST',
                      body: {
                        label: data.get('label'),
                        claim: data.get('claim'),
                        sourceUrl: data.get('sourceUrl') || null,
                      },
                    }),
                  'Evidence added for Owner confirmation',
                )
                .then((result) => {
                  if (result) form.reset();
                });
            }}
          >
            <label>
              Evidence label
              <input name="label" required />
            </label>
            <label>
              Source URL <span className="optional">optional</span>
              <input name="sourceUrl" type="url" />
            </label>
            <label className="full">
              Specific claim
              <textarea name="claim" required rows={2} />
            </label>
            <button className="button secondary" disabled={action.busy}>
              Add evidence
            </button>
          </form>
        )}
      </section>
      {business.role === 'OWNER' && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">06 / TEAM</p>
              <h2>Members and invitations</h2>
            </div>
          </div>
          {members.data && (
            <ul className="stack-list">
              {members.data.members.map((member) => (
                <li className="member-row" key={member.id}>
                  <div>
                    <strong>{member.displayName}</strong>
                    <p>{member.email}</p>
                  </div>
                  <div className="member-actions">
                    <label className="sr-only" htmlFor={`role-${member.id}`}>
                      Role for {member.displayName}
                    </label>
                    <select
                      id={`role-${member.id}`}
                      defaultValue={member.role}
                      onChange={(event) =>
                        void action.run(
                          () =>
                            api(`${base}/members/${member.id}`, {
                              method: 'PATCH',
                              body: { role: event.target.value },
                            }),
                          'Member role updated',
                        )
                      }
                    >
                      <option value="OWNER">Owner</option>
                      <option value="EDITOR">Editor</option>
                      <option value="REVIEWER">Reviewer</option>
                    </select>
                    <button
                      className="text-button danger"
                      disabled={action.busy}
                      onClick={() => {
                        if (confirm(`Remove ${member.displayName} from ${business.name}?`))
                          void action.run(
                            () => api(`${base}/members/${member.id}`, { method: 'DELETE' }),
                            'Member removed',
                          );
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {invitations.data?.invitations.length ? (
            <div className="pending-list">
              <h3>Pending invitations</h3>
              {invitations.data.invitations.map((item) => (
                <p key={item.id}>
                  {item.email} · {item.role.toLowerCase()} · expires{' '}
                  {new Date(item.expiresAt).toLocaleDateString()}
                </p>
              ))}
            </div>
          ) : null}
          <form
            className="inline-form form-columns"
            onSubmit={(event) => {
              const form = event.currentTarget;
              const data = formData(event);
              void action
                .run(
                  () =>
                    api(`${base}/invitations`, {
                      method: 'POST',
                      body: { email: data.get('email'), role: data.get('role') },
                    }),
                  'Invitation prepared in the development email sink',
                )
                .then((result) => {
                  if (result) form.reset();
                });
            }}
          >
            <h3 className="full">Invite a teammate</h3>
            <label>
              Email
              <input name="email" type="email" required />
            </label>
            <label>
              Role
              <select name="role">
                <option value="EDITOR">Editor</option>
                <option value="REVIEWER">Reviewer</option>
                <option value="OWNER">Owner</option>
              </select>
            </label>
            <button className="button secondary" disabled={action.busy}>
              Prepare invitation
            </button>
          </form>
        </section>
      )}
    </>
  );
}

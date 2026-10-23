import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.ts';
import { csrfToken, tokenHash } from '../src/common/security.ts';
import type { Database } from '../src/infrastructure/database.ts';
import type { MembershipRole } from '../src/generated/prisma/enums.ts';

const businessId = '79de4977-2683-445e-b36e-cf4adcd2e51e';
const otherBusinessId = '79de4977-2683-445e-b36e-cf4adcd2e51f';
const contentId = 'b8ac259d-8fdf-4bec-a141-04756448a769';
const userId = 'b26dc0d4-88ab-4555-86aa-090f7cb9f388';
const creatorId = 'd8171034-2b1f-4d74-af30-f6193b3c85ce';
const rawSession = 'workflow-test-session';
const secret = 'workflow-test-secret-32-characters-minimum';
const origin = 'http://localhost:5173';
let role: MembershipRole = 'OWNER';
let currentCreator = creatorId;
let status = 'IN_REVIEW';
let server: Server;
let baseUrl: string;

const item = () => ({
  id: contentId,
  businessId,
  createdById: currentCreator,
  status,
  revisions: [{ id: 'revision-id', authorId: currentCreator, version: 1 }],
});
const db = {
  session: {
    findUnique: async ({ where }: { where: { tokenHash: string } }) =>
      where.tokenHash === tokenHash(rawSession)
        ? {
            id: 'session',
            userId,
            revokedAt: null,
            expiresAt: new Date(Date.now() + 60000),
            user: { email: 'reviewer@example.test', displayName: 'Reviewer' },
          }
        : null,
  },
  membership: {
    findUnique: async ({
      where,
    }: {
      where: { businessId_userId: { businessId: string; userId: string } };
    }) => (where.businessId_userId.businessId === businessId ? { businessId, userId, role } : null),
  },
  contentItem: {
    findUnique: async ({
      where,
    }: {
      where: { businessId_id: { businessId: string; id: string } };
    }) =>
      where.businessId_id.businessId === businessId && where.businessId_id.id === contentId
        ? item()
        : null,
    updateMany: async ({
      where,
      data,
    }: {
      where: { businessId: string; id: string; status: string };
      data: { status: string };
    }) => {
      if (where.businessId !== businessId || where.id !== contentId || where.status !== status)
        return { count: 0 };
      status = data.status;
      return { count: 1 };
    },
  },
  reviewDecision: {
    create: async ({ data }: { data: object }) => ({ id: 'decision-id', ...data }),
  },
  $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(db),
} as unknown as Database;

before(async () => {
  await new Promise<void>((resolve, reject) => {
    server = createApp({
      allowedOrigins: [origin],
      runtime: {
        db,
        csrfSecret: secret,
        production: false,
        webOrigin: origin,
        mail: { sendInvitation: async () => {}, sendPasswordReset: async () => {} },
      },
    }).listen(0, '127.0.0.1', (error?: Error) => (error ? reject(error) : resolve()));
  });
  const address = server.address();
  assert(address && typeof address !== 'string');
  baseUrl = `http://127.0.0.1:${address.port}`;
});
after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function decide(
  business = businessId,
  outcome: 'APPROVED' | 'CHANGES_REQUESTED' = 'APPROVED',
  checklist = { factsChecked: true, brandChecked: true, ctaChecked: true },
  note?: string,
) {
  return fetch(`${baseUrl}/api/v1/businesses/${business}/content/${contentId}/decisions`, {
    method: 'POST',
    headers: {
      Cookie: `kampanya_session=${rawSession}`,
      Origin: origin,
      'Content-Type': 'application/json',
      'X-Kampanya-Request': '1',
      'X-CSRF-Token': csrfToken(rawSession, secret),
    },
    body: JSON.stringify({
      outcome,
      checklist,
      note,
    }),
  });
}

test('Owner and Reviewer may approve another author; Editor cannot', async () => {
  currentCreator = creatorId;
  for (const next of ['OWNER', 'REVIEWER', 'EDITOR'] as const) {
    status = 'IN_REVIEW';
    role = next;
    const result = await decide();
    assert.equal(result.status, next === 'EDITOR' ? 403 : 201);
  }
});
test('every role is barred from self approval', async () => {
  currentCreator = userId;
  for (const next of ['OWNER', 'REVIEWER'] as const) {
    status = 'IN_REVIEW';
    role = next;
    const result = await decide();
    assert.equal(result.status, 403);
    assert.equal((await result.json()).error.code, 'SELF_REVIEW');
  }
});
test('cross-business review is hidden', async () => {
  currentCreator = creatorId;
  status = 'IN_REVIEW';
  role = 'OWNER';
  const result = await decide(otherBusinessId);
  assert.equal(result.status, 404);
});
test('approval requires all checks; a change request records failed checks and feedback', async () => {
  currentCreator = creatorId;
  status = 'IN_REVIEW';
  role = 'REVIEWER';
  const checks = { factsChecked: false, brandChecked: true, ctaChecked: true };
  const invalid = await decide(businessId, 'APPROVED', checks);
  assert.equal(invalid.status, 400);
  assert.equal(status, 'IN_REVIEW');
  const rejection = await decide(
    businessId,
    'CHANGES_REQUESTED',
    checks,
    'The factual claim needs evidence.',
  );
  assert.equal(rejection.status, 201);
  assert.equal(status, 'DRAFT');
});

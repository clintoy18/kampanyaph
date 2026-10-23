import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.ts';
import { csrfToken, tokenHash } from '../src/common/security.ts';
import type { AiService } from '../src/infrastructure/ai.ts';
import type { Database } from '../src/infrastructure/database.ts';
import type { MembershipRole } from '../src/generated/prisma/enums.ts';

const businessId = '79de4977-2683-445e-b36e-cf4adcd2e51e';
const briefId = '217020c2-f78d-4a82-805b-4417610bc426';
const otherBusinessId = '79de4977-2683-445e-b36e-cf4adcd2e51f';
const userId = 'b26dc0d4-88ab-4555-86aa-090f7cb9f388';
const rawSession = 'marketing-session';
const secret = 'marketing-csrf-secret-32-characters';
const origin = 'http://localhost:5173';
let role: MembershipRole = 'EDITOR';
let dailyCount = 0;
let calls = 0;
let strategyCalls = 0;
let savedRevision = '';
let server: Server;
let baseUrl: string;

const ai: AiService = {
  strategy: async () => {
    strategyCalls += 1;
    return {
      value: { pillars: ['Useful idea'], angles: ['Local angle'], rationale: 'Audience fit' },
      model: 'test-model',
      inputTokens: 10,
      outputTokens: 10,
    };
  },
  content: async () => {
    calls += 1;
    return {
      value: { title: 'Fresh ideas', body: 'Visit us this week.' },
      model: 'test-model',
      inputTokens: 42,
      outputTokens: 18,
    };
  },
};
const db = {
  session: {
    findUnique: async ({ where }: { where: { tokenHash: string } }) =>
      where.tokenHash === tokenHash(rawSession)
        ? {
            id: 'session-id',
            userId,
            revokedAt: null,
            expiresAt: new Date(Date.now() + 60000),
            user: { email: 'member@example.test', displayName: 'Member' },
          }
        : null,
  },
  membership: {
    findUnique: async ({ where }: { where: { businessId_userId: { businessId: string } } }) =>
      where.businessId_userId.businessId === businessId ? { businessId, userId, role } : null,
  },
  strategyBrief: {
    update: async ({ data }: { data: object }) => ({ id: briefId, ...data }),
    findUnique: async ({
      where,
    }: {
      where: { businessId_id: { businessId: string; id: string } };
    }) =>
      where.businessId_id.businessId === businessId && where.businessId_id.id === briefId
        ? {
            id: briefId,
            businessId,
            audience: { name: 'Local families', needs: 'Easy snacks' },
            objective: 'Invite a visit',
            platform: 'Facebook',
            hook: 'Afternoon break',
            valueProposition: 'Fresh bakes',
            trustEvidence: null,
            callToAction: 'Visit us',
            pillars: null,
            angles: null,
          }
        : null,
  },
  generationRun: {
    count: async () => dailyCount,
    create: async ({ data }: { data: { model: string; inputTokens: number } }) => ({
      id: 'run-id',
      ...data,
    }),
  },
  brandContext: {
    findUnique: async () => ({ voice: 'Warm and direct', valueProposition: 'Fresh bakes' }),
  },
  offering: { findMany: async () => [{ name: 'Bread', description: 'Fresh bread' }] },
  business: { findUniqueOrThrow: async () => ({ name: 'Sample shop', industry: 'Food' }) },
  contentItem: {
    create: async ({ data }: { data: object }) => ({ id: 'content-id', status: 'DRAFT', ...data }),
  },
  contentRevision: {
    create: async ({ data }: { data: { body: string } }) => {
      savedRevision = data.body;
      return data;
    },
  },
  $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(db),
} as unknown as Database;

before(async () => {
  await new Promise<void>((resolve, reject) => {
    server = createApp({
      allowedOrigins: [origin],
      runtime: {
        db,
        ai,
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

async function generate(business = businessId) {
  return fetch(`${baseUrl}/api/v1/businesses/${business}/briefs/${briefId}/generate`, {
    method: 'POST',
    headers: {
      Cookie: `kampanya_session=${rawSession}`,
      Origin: origin,
      'X-Kampanya-Request': '1',
      'X-CSRF-Token': csrfToken(rawSession, secret),
    },
  });
}
async function suggest() {
  return fetch(`${baseUrl}/api/v1/businesses/${businessId}/briefs/${briefId}/suggest`, {
    method: 'POST',
    headers: {
      Cookie: `kampanya_session=${rawSession}`,
      Origin: origin,
      'X-Kampanya-Request': '1',
      'X-CSRF-Token': csrfToken(rawSession, secret),
    },
  });
}

test('Editor generates an editable draft through a mocked AI provider', async () => {
  role = 'EDITOR';
  dailyCount = 0;
  calls = 0;
  const result = await generate();
  assert.equal(result.status, 201);
  assert.equal((await result.json()).content.status, 'DRAFT');
  assert.equal(savedRevision, 'Visit us this week.');
  assert.equal(calls, 1);
});
test('Reviewer and cross-business requests cannot generate', async () => {
  role = 'REVIEWER';
  dailyCount = 0;
  calls = 0;
  assert.equal((await generate()).status, 403);
  role = 'OWNER';
  assert.equal((await generate(otherBusinessId)).status, 404);
  assert.equal(calls, 0);
});
test('daily limit rejects generation before a provider call', async () => {
  role = 'OWNER';
  dailyCount = 20;
  calls = 0;
  const result = await generate();
  assert.equal(result.status, 429);
  assert.equal(calls, 0);
});
test('strategy suggestions are recorded and share the daily AI limit', async () => {
  role = 'EDITOR';
  dailyCount = 0;
  strategyCalls = 0;
  const result = await suggest();
  assert.equal(result.status, 200);
  assert.deepEqual((await result.json()).brief.pillars, ['Useful idea']);
  assert.equal(strategyCalls, 1);
  dailyCount = 20;
  assert.equal((await suggest()).status, 429);
  assert.equal(strategyCalls, 1);
});

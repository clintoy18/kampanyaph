import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.ts';
import { csrfToken, tokenHash } from '../src/common/security.ts';
import type { Database } from '../src/infrastructure/database.ts';
import type { MembershipRole } from '../src/generated/prisma/enums.ts';

const businessId = '79de4977-2683-445e-b36e-cf4adcd2e51e';
const otherBusinessId = '79de4977-2683-445e-b36e-cf4adcd2e51f';
const userId = 'b26dc0d4-88ab-4555-86aa-090f7cb9f388';
const rawSession = 'local-test-session';
const secret = 'local-test-csrf-secret-with-enough-characters';
const origin = 'http://localhost:5173';
let role: MembershipRole = 'OWNER';
let server: Server;
let baseUrl: string;

const db = {
  session: {
    findUnique: async ({ where }: { where: { tokenHash: string } }) =>
      where.tokenHash === tokenHash(rawSession)
        ? {
            id: 'session-id',
            userId,
            revokedAt: null,
            expiresAt: new Date(Date.now() + 60_000),
            user: { id: userId, email: 'member@example.test', displayName: 'Member' },
          }
        : null,
  },
  membership: {
    findUnique: async ({
      where,
    }: {
      where: { businessId_userId: { businessId: string; userId: string } };
    }) =>
      where.businessId_userId.businessId === businessId && where.businessId_userId.userId === userId
        ? { businessId, userId, role }
        : null,
  },
  brandContext: {
    findUnique: async () => ({ businessId, voice: 'Helpful and direct' }),
    upsert: async ({ create }: { create: { businessId: string; voice: string } }) => create,
  },
  business: {
    update: async ({ data }: { data: { name?: string } }) => ({ id: businessId, ...data }),
  },
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
    }).listen(0, '127.0.0.1', (error?: Error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  const address = server.address();
  assert(address && typeof address !== 'string');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function headers(write = false) {
  return {
    Cookie: `kampanya_session=${rawSession}`,
    Origin: origin,
    ...(write
      ? {
          'Content-Type': 'application/json',
          'X-Kampanya-Request': '1',
          'X-CSRF-Token': csrfToken(rawSession, secret),
        }
      : {}),
  };
}

test('Owner and Editor can edit brand; Reviewer can only read it', async () => {
  for (const nextRole of ['OWNER', 'EDITOR', 'REVIEWER'] as const) {
    role = nextRole;
    const read = await fetch(`${baseUrl}/api/v1/businesses/${businessId}/brand`, {
      headers: headers(),
    });
    assert.equal(read.status, 200);
    const write = await fetch(`${baseUrl}/api/v1/businesses/${businessId}/brand`, {
      method: 'PUT',
      headers: headers(true),
      body: JSON.stringify({ voice: 'Clear and warm' }),
    });
    assert.equal(write.status, nextRole === 'REVIEWER' ? 403 : 200);
  }
});

test('only an Owner can change core business details', async () => {
  for (const nextRole of ['OWNER', 'EDITOR', 'REVIEWER'] as const) {
    role = nextRole;
    const response = await fetch(`${baseUrl}/api/v1/businesses/${businessId}`, {
      method: 'PATCH',
      headers: headers(true),
      body: JSON.stringify({ name: 'Updated business' }),
    });
    assert.equal(response.status, nextRole === 'OWNER' ? 200 : 403);
  }
});

test('a member cannot read another business', async () => {
  role = 'OWNER';
  const response = await fetch(`${baseUrl}/api/v1/businesses/${otherBusinessId}/brand`, {
    headers: headers(),
  });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, 'BUSINESS_NOT_FOUND');
});

test('cookie-authenticated writes require a CSRF token', async () => {
  role = 'OWNER';
  const response = await fetch(`${baseUrl}/api/v1/businesses/${businessId}/brand`, {
    method: 'PUT',
    headers: {
      Cookie: `kampanya_session=${rawSession}`,
      Origin: origin,
      'X-Kampanya-Request': '1',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ voice: 'Clear and warm' }),
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, 'INVALID_CSRF');
});

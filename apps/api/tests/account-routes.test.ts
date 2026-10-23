import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.ts';
import { csrfToken, randomToken, tokenHash, verifyPassword } from '../src/common/security.ts';
import type { Database } from '../src/infrastructure/database.ts';

const origin = 'http://localhost:5173';
const userId = 'b26dc0d4-88ab-4555-86aa-090f7cb9f388';
const businessId = '79de4977-2683-445e-b36e-cf4adcd2e51e';
const rawSession = 'account-test-session';
const secret = 'account-test-csrf-secret-32-characters';
let server: Server;
let baseUrl: string;
let recoveryLink = '';
let reset: {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
} | null = null;
let invitation: {
  id: string;
  businessId: string;
  email: string;
  role: 'EDITOR';
  tokenHash: string;
  expiresAt: Date;
  acceptedAt: Date | null;
} | null = null;
let changedHash = '';
let grantedRole = '';

const db = {
  user: {
    findUnique: async () => ({ id: userId, email: 'member@example.test', displayName: 'Member' }),
    update: async ({ data }: { data: { passwordHash: string } }) => {
      changedHash = data.passwordHash;
      return {};
    },
  },
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
    updateMany: async () => ({ count: 1 }),
  },
  passwordReset: {
    create: async ({ data }: { data: { tokenHash: string; expiresAt: Date } }) => {
      reset = { id: 'reset-id', userId, ...data, consumedAt: null };
      return reset;
    },
    findUnique: async ({ where }: { where: { tokenHash: string } }) =>
      reset?.tokenHash === where.tokenHash ? reset : null,
    updateMany: async () => {
      if (!reset || reset.consumedAt) return { count: 0 };
      reset.consumedAt = new Date();
      return { count: 1 };
    },
  },
  invitation: {
    findUnique: async ({ where }: { where: { tokenHash: string } }) =>
      invitation?.tokenHash === where.tokenHash ? invitation : null,
    updateMany: async () => {
      if (!invitation || invitation.acceptedAt) return { count: 0 };
      invitation.acceptedAt = new Date();
      return { count: 1 };
    },
  },
  membership: {
    upsert: async ({ create }: { create: { role: string } }) => {
      grantedRole = create.role;
      return create;
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
        csrfSecret: secret,
        production: false,
        webOrigin: origin,
        mail: {
          sendInvitation: async () => {},
          sendPasswordReset: async (_email, link) => {
            recoveryLink = link;
          },
        },
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

function headers(authenticated = false) {
  return {
    Origin: origin,
    'Content-Type': 'application/json',
    'X-Kampanya-Request': '1',
    ...(authenticated
      ? { Cookie: `kampanya_session=${rawSession}`, 'X-CSRF-Token': csrfToken(rawSession, secret) }
      : {}),
  };
}

test('recovery token is single-use and resets the password', async () => {
  const forgot = await fetch(`${baseUrl}/api/v1/auth/forgot-password`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ email: 'member@example.test' }),
  });
  assert.equal(forgot.status, 202);
  const raw = new URL(recoveryLink).hash.slice('#reset='.length);
  assert.equal(reset?.tokenHash, tokenHash(raw));
  const request = () =>
    fetch(`${baseUrl}/api/v1/auth/reset-password`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ token: raw, password: 'a different secure password' }),
    });
  assert.equal((await request()).status, 204);
  assert(await verifyPassword('a different secure password', changedHash));
  assert.equal((await request()).status, 400);
});

test('invitation acceptance grants the invited role once to the matching account', async () => {
  const raw = randomToken();
  invitation = {
    id: 'invitation-id',
    businessId,
    email: 'member@example.test',
    role: 'EDITOR',
    tokenHash: tokenHash(raw),
    expiresAt: new Date(Date.now() + 60000),
    acceptedAt: null,
  };
  const request = () =>
    fetch(`${baseUrl}/api/v1/auth/invitations/accept`, {
      method: 'POST',
      headers: headers(true),
      body: JSON.stringify({ token: raw }),
    });
  assert.equal((await request()).status, 204);
  assert.equal(grantedRole, 'EDITOR');
  assert.equal((await request()).status, 400);
});

import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.ts';
import { hashPassword, tokenHash } from '../src/common/security.ts';
import type { Database } from '../src/infrastructure/database.ts';

const origin = 'http://localhost:5173';
const userId = 'b26dc0d4-88ab-4555-86aa-090f7cb9f388';
let server: Server;
let baseUrl: string;
let passwordHash: string;
let activeTokenHash = '';
let revoked = false;

const db = {
  user: {
    findUnique: async () => ({
      id: userId,
      email: 'member@example.test',
      displayName: 'Member',
      passwordHash,
    }),
  },
  session: {
    create: async ({ data }: { data: { tokenHash: string } }) => {
      activeTokenHash = data.tokenHash;
      revoked = false;
      return { id: 'session-id' };
    },
    findUnique: async ({ where }: { where: { tokenHash: string } }) =>
      where.tokenHash === activeTokenHash
        ? {
            id: 'session-id',
            userId,
            revokedAt: revoked ? new Date() : null,
            expiresAt: new Date(Date.now() + 60000),
            user: { id: userId, email: 'member@example.test', displayName: 'Member', passwordHash },
          }
        : null,
    update: async () => {
      revoked = true;
      return { id: 'session-id' };
    },
  },
} as unknown as Database;

before(async () => {
  passwordHash = await hashPassword('correct horse battery');
  await new Promise<void>((resolve, reject) => {
    server = createApp({
      allowedOrigins: [origin],
      runtime: {
        db,
        csrfSecret: 'a-valid-csrf-secret-with-32-characters',
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

test('login returns no credential hash, creates an HttpOnly cookie, and logout revokes it', async () => {
  const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', 'X-Kampanya-Request': '1' },
    body: JSON.stringify({ email: 'member@example.test', password: 'correct horse battery' }),
  });
  assert.equal(login.status, 200);
  const payload = await login.json();
  assert.equal(payload.user.email, 'member@example.test');
  assert.equal(JSON.stringify(payload).includes('passwordHash'), false);
  const cookie = login.headers.get('set-cookie');
  assert(cookie && cookie.includes('HttpOnly'));
  assert(cookie.includes('SameSite=Lax'));
  const session = cookie.split(';')[0]!;
  assert.equal(tokenHash(session.split('=')[1]!), activeTokenHash);
  const me = await fetch(`${baseUrl}/api/v1/auth/me`, {
    headers: { Cookie: session, Origin: origin },
  });
  assert.equal(me.status, 200);
  const logout = await fetch(`${baseUrl}/api/v1/auth/logout`, {
    method: 'POST',
    headers: {
      Cookie: session,
      Origin: origin,
      'X-Kampanya-Request': '1',
      'X-CSRF-Token': payload.csrfToken,
    },
  });
  assert.equal(logout.status, 204);
  const afterLogout = await fetch(`${baseUrl}/api/v1/auth/me`, {
    headers: { Cookie: session, Origin: origin },
  });
  assert.equal(afterLogout.status, 401);
});

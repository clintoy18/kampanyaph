import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.ts';

let server: Server;
let baseUrl: string;

before(async () => {
  await new Promise<void>((resolve, reject) => {
    server = createApp({ allowedOrigins: ['http://localhost:5173'] }).listen(
      0,
      '127.0.0.1',
      (error?: Error) => {
        if (error) reject(error);
        else resolve();
      },
    );
  });
  const address = server.address();
  assert(address && typeof address !== 'string');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test('health endpoint responds without exposing server details', async () => {
  const response = await fetch(`${baseUrl}/healthz`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
  assert.equal(response.headers.get('x-powered-by'), null);
  assert.match(response.headers.get('x-request-id') ?? '', /^[0-9a-f-]{36}$/);
});

test('CORS permits only the configured web origin', async () => {
  const allowed = await fetch(`${baseUrl}/api/v1`, {
    headers: { Origin: 'http://localhost:5173' },
  });
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  assert.deepEqual(await allowed.json(), { name: 'Kampanya API', version: 'v1' });

  const denied = await fetch(`${baseUrl}/api/v1`, {
    headers: { Origin: 'https://untrusted.example' },
  });
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
});

test('unknown routes return a stable error and request ID', async () => {
  const response = await fetch(`${baseUrl}/api/v1/missing`);
  assert.equal(response.status, 404);
  const body = (await response.json()) as { error: { code: string }; requestId: string };
  assert.equal(body.error.code, 'NOT_FOUND');
  assert.equal(body.requestId, response.headers.get('x-request-id'));
});

test('malformed JSON returns a safe validation error', async () => {
  const response = await fetch(`${baseUrl}/api/v1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  });
  assert.equal(response.status, 400);
  const body = (await response.json()) as { error: { code: string }; requestId: string };
  assert.equal(body.error.code, 'INVALID_JSON');
  assert.equal(body.requestId, response.headers.get('x-request-id'));
});

test('oversized JSON returns a bounded request error', async () => {
  const response = await fetch(`${baseUrl}/api/v1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: 'x'.repeat(66_000) }),
  });
  assert.equal(response.status, 413);
  const body = (await response.json()) as { error: { code: string }; requestId: string };
  assert.equal(body.error.code, 'BODY_TOO_LARGE');
  assert.equal(body.requestId, response.headers.get('x-request-id'));
});

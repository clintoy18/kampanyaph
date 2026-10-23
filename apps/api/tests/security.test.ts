import assert from 'node:assert/strict';
import { test } from 'node:test';
import { csrfToken, hashPassword, randomToken, verifyPassword } from '../src/common/security.ts';

test('passwords use salted hashes and wrong passwords fail', async () => {
  const password = 'A long local test password';
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword('incorrect password', first), false);
});

test('session and CSRF tokens are unpredictable and bound together', () => {
  const first = randomToken();
  const second = randomToken();
  assert.notEqual(first, second);
  assert.notEqual(
    csrfToken(first, 'a development-only csrf secret'),
    csrfToken(second, 'a development-only csrf secret'),
  );
});

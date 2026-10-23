import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertDifferentReviewer,
  authorizeMembership,
  type Permission,
} from '../src/common/permissions.ts';
import { HttpError } from '../src/common/errors.ts';
import type { MembershipRole } from '../src/generated/prisma/enums.ts';

const businessId = 'a-business';
const userId = 'a-user';
const grants: Record<MembershipRole, Permission[]> = {
  OWNER: [
    'business:read',
    'business:update',
    'members:manage',
    'marketing:write',
    'content:write',
    'review:decide',
  ],
  EDITOR: ['business:read', 'marketing:write', 'content:write'],
  REVIEWER: ['business:read', 'review:decide'],
};
const actions: Permission[] = [
  'business:read',
  'business:update',
  'members:manage',
  'marketing:write',
  'content:write',
  'review:decide',
];

for (const role of ['OWNER', 'EDITOR', 'REVIEWER'] as const) {
  test(`${role} is granted exactly the approved actions`, () => {
    const membership = { businessId, userId, role };
    for (const action of actions) {
      if (grants[role].includes(action)) {
        assert.equal(authorizeMembership(membership, businessId, userId, action), role);
      } else {
        assert.throws(
          () => authorizeMembership(membership, businessId, userId, action),
          (error) => error instanceof HttpError && error.status === 403,
        );
      }
    }
  });
}

test('membership in another business never authorizes access', () => {
  const membership = { businessId: 'other-business', userId, role: 'OWNER' as const };
  assert.throws(
    () => authorizeMembership(membership, businessId, userId, 'business:read'),
    (error) => error instanceof HttpError && error.status === 404,
  );
  assert.throws(
    () => authorizeMembership(null, businessId, userId, 'business:read'),
    (error) => error instanceof HttpError && error.status === 404,
  );
});

test('membership for another user never authorizes access', () => {
  const membership = { businessId, userId: 'other-user', role: 'OWNER' as const };
  assert.throws(
    () => authorizeMembership(membership, businessId, userId, 'business:read'),
    (error) => error instanceof HttpError && error.status === 404,
  );
});

test('every review-capable role is still barred from self-review', () => {
  assert.throws(
    () => assertDifferentReviewer(userId, userId, 'other-author'),
    (error) => error instanceof HttpError && error.code === 'SELF_REVIEW',
  );
  assert.throws(
    () => assertDifferentReviewer(userId, 'other-creator', userId),
    (error) => error instanceof HttpError && error.code === 'SELF_REVIEW',
  );
  assert.doesNotThrow(() => assertDifferentReviewer(userId, 'other-creator', 'other-author'));
});

import type { MembershipRole } from '../generated/prisma/enums.ts';
import type { Database } from '../infrastructure/database.ts';
import { HttpError } from './errors.ts';

export type Permission =
  | 'business:read'
  | 'business:update'
  | 'members:manage'
  | 'marketing:write'
  | 'content:write'
  | 'review:decide';

const grants: Record<MembershipRole, ReadonlySet<Permission>> = {
  OWNER: new Set([
    'business:read',
    'business:update',
    'members:manage',
    'marketing:write',
    'content:write',
    'review:decide',
  ]),
  EDITOR: new Set(['business:read', 'marketing:write', 'content:write']),
  REVIEWER: new Set(['business:read', 'review:decide']),
};

export function authorizeMembership(
  membership: { businessId: string; userId: string; role: MembershipRole } | null,
  businessId: string,
  userId: string,
  permission: Permission,
): MembershipRole {
  if (!membership || membership.businessId !== businessId || membership.userId !== userId) {
    throw new HttpError(404, 'BUSINESS_NOT_FOUND', 'Business not found');
  }
  if (!grants[membership.role].has(permission)) {
    throw new HttpError(403, 'FORBIDDEN', 'You cannot perform this action');
  }
  return membership.role;
}

export function assertDifferentReviewer(
  reviewerId: string,
  creatorId: string,
  revisionAuthorId: string,
) {
  if (reviewerId === creatorId || reviewerId === revisionAuthorId) {
    throw new HttpError(403, 'SELF_REVIEW', 'You cannot review your own content');
  }
}

export async function authorizeBusiness(
  db: Database,
  businessId: string,
  userId: string,
  permission: Permission,
) {
  const membership = await db.membership.findUnique({
    where: { businessId_userId: { businessId, userId } },
  });
  return authorizeMembership(membership, businessId, userId, permission);
}

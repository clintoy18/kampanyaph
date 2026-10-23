import { Router } from 'express';
import { z } from 'zod';
import { HttpError, parseBody, uuidParam } from '../../common/errors.ts';
import { authorizeBusiness } from '../../common/permissions.ts';
import { randomToken, tokenHash } from '../../common/security.ts';
import type { EmailService } from '../../infrastructure/email.ts';
import { principal, requireCsrf, requireSession, type AuthRuntime } from '../identity/session.ts';

export interface BusinessesRuntime extends AuthRuntime {
  mail: EmailService;
  webOrigin: string;
}

const timezone = z
  .string()
  .max(100)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, 'Use a valid IANA timezone');
const businessFields = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000).nullable().optional(),
    industry: z.string().trim().max(100).nullable().optional(),
    timezone: timezone.default('Asia/Manila'),
  })
  .strict();
const brandFields = z
  .object({
    voice: z.string().trim().min(1).max(4000),
    valueProposition: z.string().trim().max(2000).nullable().optional(),
    boundaries: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();
const audienceFields = z
  .object({ name: z.string().trim().min(1).max(120), needs: z.string().trim().min(1).max(4000) })
  .strict();
const offeringFields = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(4000),
  })
  .strict();
const evidenceFields = z
  .object({
    label: z.string().trim().min(1).max(120),
    claim: z.string().trim().min(1).max(2000),
    sourceUrl: z.url().max(2000).nullable().optional(),
  })
  .strict();

export function createBusinessesRouter(runtime: BusinessesRuntime) {
  const router = Router();
  router.use(requireSession(runtime));
  router.use((request, response, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return next();
    return requireCsrf(runtime)(request, response, next);
  });

  router.get('/', async (request, response) => {
    const memberships = await runtime.db.membership.findMany({
      where: { userId: principal(request).userId },
      include: { business: true },
      orderBy: { createdAt: 'asc' },
    });
    response.json({ businesses: memberships.map(({ business, role }) => ({ ...business, role })) });
  });

  router.post('/', async (request, response) => {
    const input = parseBody(businessFields, request.body);
    const business = await runtime.db.$transaction(async (tx) => {
      const created = await tx.business.create({ data: input });
      await tx.membership.create({
        data: { businessId: created.id, userId: principal(request).userId, role: 'OWNER' },
      });
      return created;
    });
    response.status(201).json({ business: { ...business, role: 'OWNER' } });
  });

  router.get('/:businessId', async (request, response) => {
    const businessId = uuidParam(request.params.businessId);
    const role = await authorizeBusiness(
      runtime.db,
      businessId,
      principal(request).userId,
      'business:read',
    );
    const business = await runtime.db.business.findUniqueOrThrow({ where: { id: businessId } });
    response.json({ business: { ...business, role } });
  });

  router.patch('/:businessId', async (request, response) => {
    const businessId = uuidParam(request.params.businessId);
    await authorizeBusiness(runtime.db, businessId, principal(request).userId, 'business:update');
    const input = parseBody(businessFields.partial(), request.body);
    const business = await runtime.db.business.update({ where: { id: businessId }, data: input });
    response.json({ business });
  });

  router.get('/:businessId/members', async (request, response) => {
    const businessId = uuidParam(request.params.businessId);
    await authorizeBusiness(runtime.db, businessId, principal(request).userId, 'members:manage');
    const members = await runtime.db.membership.findMany({
      where: { businessId },
      include: { user: { select: { id: true, email: true, displayName: true } } },
      orderBy: { createdAt: 'asc' },
    });
    response.json({ members: members.map(({ user, role }) => ({ ...user, role })) });
  });

  router.post('/:businessId/invitations', async (request, response) => {
    const businessId = uuidParam(request.params.businessId);
    await authorizeBusiness(runtime.db, businessId, principal(request).userId, 'members:manage');
    const input = parseBody(
      z
        .object({
          email: z.string().trim().toLowerCase().email().max(254),
          role: z.enum(['OWNER', 'EDITOR', 'REVIEWER']),
        })
        .strict(),
      request.body,
    );
    const registered = await runtime.db.user.findUnique({ where: { email: input.email } });
    if (registered) {
      const member = await runtime.db.membership.findUnique({
        where: { businessId_userId: { businessId, userId: registered.id } },
      });
      if (member) throw new HttpError(409, 'ALREADY_MEMBER', 'This person is already a member');
    }
    const raw = randomToken();
    await runtime.db.$transaction(async (tx) => {
      await tx.invitation.updateMany({
        where: { businessId, email: input.email, acceptedAt: null },
        data: { expiresAt: new Date() },
      });
      await tx.invitation.create({
        data: {
          businessId,
          email: input.email,
          role: input.role,
          tokenHash: tokenHash(raw),
          invitedById: principal(request).userId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    });
    const url = new URL(runtime.webOrigin);
    url.hash = `invite=${encodeURIComponent(raw)}`;
    await runtime.mail.sendInvitation(input.email, url.toString());
    response.status(202).json({ message: 'Invitation prepared' });
  });

  router.get('/:businessId/invitations', async (request, response) => {
    const businessId = uuidParam(request.params.businessId);
    await authorizeBusiness(runtime.db, businessId, principal(request).userId, 'members:manage');
    const invitations = await runtime.db.invitation.findMany({
      where: { businessId, acceptedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    response.json({ invitations });
  });

  router.patch('/:businessId/members/:userId', async (request, response) => {
    const businessId = uuidParam(request.params.businessId);
    const userId = uuidParam(request.params.userId);
    await authorizeBusiness(runtime.db, businessId, principal(request).userId, 'members:manage');
    const input = parseBody(
      z.object({ role: z.enum(['OWNER', 'EDITOR', 'REVIEWER']) }).strict(),
      request.body,
    );
    const member = await runtime.db.$transaction(
      async (tx) => {
        const existing = await tx.membership.findUnique({
          where: { businessId_userId: { businessId, userId } },
        });
        if (!existing) throw new HttpError(404, 'MEMBER_NOT_FOUND', 'Member not found');
        if (existing.role === 'OWNER' && input.role !== 'OWNER') {
          const owners = await tx.membership.count({ where: { businessId, role: 'OWNER' } });
          if (owners <= 1)
            throw new HttpError(409, 'LAST_OWNER', 'A business must retain an Owner');
        }
        return tx.membership.update({
          where: { businessId_userId: { businessId, userId } },
          data: { role: input.role },
        });
      },
      { isolationLevel: 'Serializable' },
    );
    response.json({
      member: { userId: member.userId, businessId: member.businessId, role: member.role },
    });
  });

  router.delete('/:businessId/members/:userId', async (request, response) => {
    const businessId = uuidParam(request.params.businessId);
    const userId = uuidParam(request.params.userId);
    await authorizeBusiness(runtime.db, businessId, principal(request).userId, 'members:manage');
    await runtime.db.$transaction(
      async (tx) => {
        const member = await tx.membership.findUnique({
          where: { businessId_userId: { businessId, userId } },
        });
        if (!member) throw new HttpError(404, 'MEMBER_NOT_FOUND', 'Member not found');
        if (member.role === 'OWNER') {
          const owners = await tx.membership.count({ where: { businessId, role: 'OWNER' } });
          if (owners <= 1)
            throw new HttpError(409, 'LAST_OWNER', 'A business must retain an Owner');
        }
        await tx.membership.delete({ where: { businessId_userId: { businessId, userId } } });
      },
      { isolationLevel: 'Serializable' },
    );
    response.status(204).end();
  });

  router.get('/:businessId/brand', async (request, response) => {
    const businessId = uuidParam(request.params.businessId);
    await authorizeBusiness(runtime.db, businessId, principal(request).userId, 'business:read');
    response.json({ brand: await runtime.db.brandContext.findUnique({ where: { businessId } }) });
  });
  router.put('/:businessId/brand', async (request, response) => {
    const businessId = uuidParam(request.params.businessId);
    await authorizeBusiness(runtime.db, businessId, principal(request).userId, 'marketing:write');
    const input = parseBody(brandFields, request.body);
    const brand = await runtime.db.brandContext.upsert({
      where: { businessId },
      create: { businessId, ...input },
      update: input,
    });
    response.json({ brand });
  });

  router.get('/:businessId/audiences', async (request, response) => {
    const businessId = uuidParam(request.params.businessId);
    await authorizeBusiness(runtime.db, businessId, principal(request).userId, 'business:read');
    response.json({
      audiences: await runtime.db.audience.findMany({
        where: { businessId },
        orderBy: { name: 'asc' },
      }),
    });
  });
  router.post('/:businessId/audiences', async (request, response) => {
    const businessId = uuidParam(request.params.businessId);
    await authorizeBusiness(runtime.db, businessId, principal(request).userId, 'marketing:write');
    const audience = await runtime.db.audience.create({
      data: { businessId, ...parseBody(audienceFields, request.body) },
    });
    response.status(201).json({ audience });
  });
  router.patch('/:businessId/audiences/:audienceId', async (request, response) => {
    const businessId = uuidParam(request.params.businessId);
    const id = uuidParam(request.params.audienceId);
    await authorizeBusiness(runtime.db, businessId, principal(request).userId, 'marketing:write');
    const result = await runtime.db.audience.updateMany({
      where: { id, businessId },
      data: parseBody(audienceFields.partial(), request.body),
    });
    if (!result.count) throw new HttpError(404, 'AUDIENCE_NOT_FOUND', 'Audience not found');
    response.json({ audience: await runtime.db.audience.findUniqueOrThrow({ where: { id } }) });
  });

  router.delete('/:businessId/audiences/:audienceId', async (request, response) => {
    const businessId = uuidParam(request.params.businessId);
    const id = uuidParam(request.params.audienceId);
    await authorizeBusiness(runtime.db, businessId, principal(request).userId, 'marketing:write');
    const result = await runtime.db.audience.deleteMany({ where: { id, businessId } });
    if (!result.count) throw new HttpError(404, 'AUDIENCE_NOT_FOUND', 'Audience not found');
    response.status(204).end();
  });

  router.get('/:businessId/offerings', async (request, response) => {
    const businessId = uuidParam(request.params.businessId);
    await authorizeBusiness(runtime.db, businessId, principal(request).userId, 'business:read');
    response.json({
      offerings: await runtime.db.offering.findMany({
        where: { businessId },
        orderBy: { name: 'asc' },
      }),
    });
  });
  router.post('/:businessId/offerings', async (request, response) => {
    const businessId = uuidParam(request.params.businessId);
    await authorizeBusiness(runtime.db, businessId, principal(request).userId, 'marketing:write');
    const offering = await runtime.db.offering.create({
      data: { businessId, ...parseBody(offeringFields, request.body) },
    });
    response.status(201).json({ offering });
  });

  router.patch('/:businessId/offerings/:offeringId', async (request, response) => {
    const businessId = uuidParam(request.params.businessId);
    const id = uuidParam(request.params.offeringId);
    await authorizeBusiness(runtime.db, businessId, principal(request).userId, 'marketing:write');
    const result = await runtime.db.offering.updateMany({
      where: { id, businessId },
      data: parseBody(offeringFields.partial(), request.body),
    });
    if (!result.count) throw new HttpError(404, 'OFFERING_NOT_FOUND', 'Offering not found');
    response.json({ offering: await runtime.db.offering.findUniqueOrThrow({ where: { id } }) });
  });
  router.delete('/:businessId/offerings/:offeringId', async (request, response) => {
    const businessId = uuidParam(request.params.businessId);
    const id = uuidParam(request.params.offeringId);
    await authorizeBusiness(runtime.db, businessId, principal(request).userId, 'marketing:write');
    const result = await runtime.db.offering.deleteMany({ where: { id, businessId } });
    if (!result.count) throw new HttpError(404, 'OFFERING_NOT_FOUND', 'Offering not found');
    response.status(204).end();
  });

  router.get('/:businessId/evidence', async (request, response) => {
    const businessId = uuidParam(request.params.businessId);
    await authorizeBusiness(runtime.db, businessId, principal(request).userId, 'business:read');
    response.json({
      evidence: await runtime.db.evidenceSource.findMany({
        where: { businessId },
        orderBy: { label: 'asc' },
      }),
    });
  });
  router.post('/:businessId/evidence', async (request, response) => {
    const businessId = uuidParam(request.params.businessId);
    await authorizeBusiness(runtime.db, businessId, principal(request).userId, 'marketing:write');
    const evidence = await runtime.db.evidenceSource.create({
      data: { businessId, ...parseBody(evidenceFields, request.body) },
    });
    response.status(201).json({ evidence });
  });
  router.patch('/:businessId/evidence/:evidenceId', async (request, response) => {
    const businessId = uuidParam(request.params.businessId);
    const id = uuidParam(request.params.evidenceId);
    await authorizeBusiness(runtime.db, businessId, principal(request).userId, 'marketing:write');
    const result = await runtime.db.evidenceSource.updateMany({
      where: { id, businessId },
      data: {
        ...parseBody(evidenceFields.partial(), request.body),
        confirmedAt: null,
        confirmedById: null,
      },
    });
    if (!result.count) throw new HttpError(404, 'EVIDENCE_NOT_FOUND', 'Evidence not found');
    response.json({
      evidence: await runtime.db.evidenceSource.findUniqueOrThrow({ where: { id } }),
    });
  });
  router.post('/:businessId/evidence/:evidenceId/confirm', async (request, response) => {
    const businessId = uuidParam(request.params.businessId);
    const id = uuidParam(request.params.evidenceId);
    await authorizeBusiness(runtime.db, businessId, principal(request).userId, 'business:update');
    const result = await runtime.db.evidenceSource.updateMany({
      where: { id, businessId },
      data: { confirmedAt: new Date(), confirmedById: principal(request).userId },
    });
    if (!result.count) throw new HttpError(404, 'EVIDENCE_NOT_FOUND', 'Evidence not found');
    response.json({
      evidence: await runtime.db.evidenceSource.findUniqueOrThrow({ where: { id } }),
    });
  });

  router.delete('/:businessId/evidence/:evidenceId', async (request, response) => {
    const businessId = uuidParam(request.params.businessId);
    const id = uuidParam(request.params.evidenceId);
    await authorizeBusiness(runtime.db, businessId, principal(request).userId, 'marketing:write');
    const result = await runtime.db.evidenceSource.deleteMany({ where: { id, businessId } });
    if (!result.count) throw new HttpError(404, 'EVIDENCE_NOT_FOUND', 'Evidence not found');
    response.status(204).end();
  });

  return router;
}

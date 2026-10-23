import { Router } from 'express';
import { z } from 'zod';
import { HttpError, parseBody, uuidParam } from '../../common/errors.ts';
import { zonedDayStart } from '../../common/dates.ts';
import { assertDifferentReviewer, authorizeBusiness } from '../../common/permissions.ts';
import { principal, requireCsrf, requireSession, type AuthRuntime } from '../identity/session.ts';

const optionalDate = z.iso.datetime({ offset: true }).nullable().optional();
const contentFields = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    platform: z.string().trim().min(2).max(60).optional(),
    plannedAt: optionalDate,
    campaignId: z.uuid().nullable().optional(),
  })
  .strict();
const decisionFields = z
  .object({
    outcome: z.enum(['APPROVED', 'CHANGES_REQUESTED']),
    note: z.string().trim().max(2000).nullable().optional(),
    checklist: z
      .object({
        factsChecked: z.boolean(),
        brandChecked: z.boolean(),
        ctaChecked: z.boolean(),
      })
      .strict(),
  })
  .strict();
const campaignFields = z
  .object({
    title: z.string().trim().min(1).max(160),
    objective: z.string().trim().min(3).max(2000),
    startsAt: optionalDate,
    endsAt: optionalDate,
  })
  .strict();

export function assertCampaignDates(
  startsAt: Date | null | undefined,
  endsAt: Date | null | undefined,
) {
  if (startsAt && endsAt && startsAt > endsAt)
    throw new HttpError(400, 'INVALID_DATES', 'Campaign end must follow its start');
}

export function createContentRouter(runtime: AuthRuntime) {
  const router = Router({ mergeParams: true });
  router.use(requireSession(runtime));
  router.use((request, response, next) =>
    ['GET', 'HEAD', 'OPTIONS'].includes(request.method)
      ? next()
      : requireCsrf(runtime)(request, response, next),
  );
  const businessIdOf = (request: { params: Record<string, string | string[] | undefined> }) =>
    uuidParam(request.params.businessId);
  const itemIdOf = (request: { params: Record<string, string | string[] | undefined> }) =>
    uuidParam(request.params.contentId);

  router.get('/content', async (request, response) => {
    const businessId = businessIdOf(request);
    await authorizeBusiness(runtime.db, businessId, principal(request).userId, 'business:read');
    response.json({
      content: await runtime.db.contentItem.findMany({
        where: { businessId },
        include: {
          revisions: { orderBy: { version: 'desc' }, take: 1 },
          campaign: { select: { id: true, title: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      }),
    });
  });
  router.get('/content/:contentId', async (request, response) => {
    const businessId = businessIdOf(request),
      id = itemIdOf(request);
    await authorizeBusiness(runtime.db, businessId, principal(request).userId, 'business:read');
    const content = await runtime.db.contentItem.findUnique({
      where: { businessId_id: { businessId, id } },
      include: {
        revisions: { orderBy: { version: 'desc' } },
        reviewDecisions: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!content) throw new HttpError(404, 'CONTENT_NOT_FOUND', 'Content not found');
    response.json({ content });
  });
  router.patch('/content/:contentId', async (request, response) => {
    const businessId = businessIdOf(request),
      id = itemIdOf(request);
    await authorizeBusiness(runtime.db, businessId, principal(request).userId, 'content:write');
    const input = parseBody(contentFields, request.body);
    const existing = await runtime.db.contentItem.findUnique({
      where: { businessId_id: { businessId, id } },
    });
    if (!existing) throw new HttpError(404, 'CONTENT_NOT_FOUND', 'Content not found');
    if (existing.status === 'IN_REVIEW')
      throw new HttpError(
        409,
        'REVIEW_IN_PROGRESS',
        'Request changes before editing content in review',
      );
    if (input.campaignId) {
      const campaign = await runtime.db.campaign.findUnique({
        where: { businessId_id: { businessId, id: input.campaignId } },
      });
      if (!campaign) throw new HttpError(404, 'CAMPAIGN_NOT_FOUND', 'Campaign not found');
    }
    const { plannedAt, ...rest } = input;
    const changed = await runtime.db.contentItem.updateMany({
      where: { businessId, id, status: existing.status },
      data: {
        ...rest,
        ...(plannedAt !== undefined ? { plannedAt: plannedAt ? new Date(plannedAt) : null } : {}),
        status:
          existing.status === 'APPROVED' || existing.status === 'PUBLISHED'
            ? 'DRAFT'
            : existing.status,
        manuallyPublishedAt: existing.status === 'PUBLISHED' ? null : existing.manuallyPublishedAt,
      },
    });
    if (!changed.count)
      throw new HttpError(409, 'STALE_CONTENT', 'Content changed. Refresh and try again');
    const content = await runtime.db.contentItem.findUniqueOrThrow({
      where: { businessId_id: { businessId, id } },
    });
    response.json({ content });
  });
  router.post('/content/:contentId/revisions', async (request, response) => {
    const businessId = businessIdOf(request),
      id = itemIdOf(request),
      userId = principal(request).userId;
    await authorizeBusiness(runtime.db, businessId, userId, 'content:write');
    const input = parseBody(
      z
        .object({
          body: z.string().trim().min(1).max(4000),
          expectedVersion: z.number().int().min(1),
        })
        .strict(),
      request.body,
    );
    const revision = await runtime.db.$transaction(
      async (tx) => {
        const item = await tx.contentItem.findUnique({
          where: { businessId_id: { businessId, id } },
          include: { revisions: { orderBy: { version: 'desc' }, take: 1 } },
        });
        if (!item) throw new HttpError(404, 'CONTENT_NOT_FOUND', 'Content not found');
        if (item.status === 'IN_REVIEW')
          throw new HttpError(
            409,
            'REVIEW_IN_PROGRESS',
            'Request changes before editing content in review',
          );
        if (item.revisions[0]?.version !== input.expectedVersion)
          throw new HttpError(409, 'STALE_REVISION', 'Refresh before saving this draft');
        const created = await tx.contentRevision.create({
          data: {
            businessId,
            contentItemId: id,
            version: input.expectedVersion + 1,
            body: input.body,
            authorId: userId,
          },
        });
        await tx.contentItem.update({
          where: { businessId_id: { businessId, id } },
          data: { status: 'DRAFT', manuallyPublishedAt: null },
        });
        return created;
      },
      { isolationLevel: 'Serializable' },
    );
    response.status(201).json({ revision });
  });
  router.post('/content/:contentId/submit', async (request, response) => {
    const businessId = businessIdOf(request),
      id = itemIdOf(request);
    await authorizeBusiness(runtime.db, businessId, principal(request).userId, 'content:write');
    const result = await runtime.db.contentItem.updateMany({
      where: { businessId, id, status: 'DRAFT' },
      data: { status: 'IN_REVIEW' },
    });
    if (!result.count)
      throw new HttpError(409, 'INVALID_TRANSITION', 'Only a draft can be submitted');
    response.json({ status: 'IN_REVIEW' });
  });
  router.post('/content/:contentId/decisions', async (request, response) => {
    const businessId = businessIdOf(request),
      id = itemIdOf(request),
      userId = principal(request).userId;
    await authorizeBusiness(runtime.db, businessId, userId, 'review:decide');
    const input = parseBody(decisionFields, request.body);
    if (input.outcome === 'CHANGES_REQUESTED' && !input.note)
      throw new HttpError(400, 'FEEDBACK_REQUIRED', 'Explain the requested changes');
    if (input.outcome === 'APPROVED' && !Object.values(input.checklist).every(Boolean))
      throw new HttpError(
        400,
        'CHECKLIST_INCOMPLETE',
        'Complete every review check before approval',
      );
    const decision = await runtime.db.$transaction(
      async (tx) => {
        const item = await tx.contentItem.findUnique({
          where: { businessId_id: { businessId, id } },
          include: { revisions: { orderBy: { version: 'desc' }, take: 1 } },
        });
        if (!item || item.status !== 'IN_REVIEW' || !item.revisions[0])
          throw new HttpError(409, 'INVALID_TRANSITION', 'Content is not ready for review');
        assertDifferentReviewer(userId, item.createdById, item.revisions[0].authorId);
        const changed = await tx.contentItem.updateMany({
          where: { businessId, id, status: 'IN_REVIEW' },
          data: { status: input.outcome === 'APPROVED' ? 'APPROVED' : 'DRAFT' },
        });
        if (!changed.count)
          throw new HttpError(409, 'INVALID_TRANSITION', 'Content was already reviewed');
        return tx.reviewDecision.create({
          data: {
            businessId,
            contentItemId: id,
            revisionId: item.revisions[0].id,
            reviewerId: userId,
            ...input,
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );
    response.status(201).json({ decision });
  });
  router.post('/content/:contentId/publish', async (request, response) => {
    const businessId = businessIdOf(request),
      id = itemIdOf(request);
    await authorizeBusiness(runtime.db, businessId, principal(request).userId, 'content:write');
    const result = await runtime.db.contentItem.updateMany({
      where: { businessId, id, status: 'APPROVED' },
      data: { status: 'PUBLISHED', manuallyPublishedAt: new Date() },
    });
    if (!result.count)
      throw new HttpError(
        409,
        'INVALID_TRANSITION',
        'Only approved content can be marked published',
      );
    response.json({ status: 'PUBLISHED' });
  });
  router.get('/campaigns', async (request, response) => {
    const businessId = businessIdOf(request);
    await authorizeBusiness(runtime.db, businessId, principal(request).userId, 'business:read');
    response.json({
      campaigns: await runtime.db.campaign.findMany({
        where: { businessId },
        include: { _count: { select: { contentItems: true } } },
        orderBy: { updatedAt: 'desc' },
      }),
    });
  });
  router.post('/campaigns', async (request, response) => {
    const businessId = businessIdOf(request);
    await authorizeBusiness(runtime.db, businessId, principal(request).userId, 'content:write');
    const input = parseBody(campaignFields, request.body);
    const startsAt = input.startsAt ? new Date(input.startsAt) : null,
      endsAt = input.endsAt ? new Date(input.endsAt) : null;
    assertCampaignDates(startsAt, endsAt);
    const campaign = await runtime.db.campaign.create({
      data: { businessId, title: input.title, objective: input.objective, startsAt, endsAt },
    });
    response.status(201).json({ campaign });
  });
  router.patch('/campaigns/:campaignId', async (request, response) => {
    const businessId = businessIdOf(request),
      id = uuidParam(request.params.campaignId);
    await authorizeBusiness(runtime.db, businessId, principal(request).userId, 'content:write');
    const input = parseBody(campaignFields.partial(), request.body);
    const campaign = await runtime.db.$transaction(
      async (tx) => {
        const existing = await tx.campaign.findUnique({
          where: { businessId_id: { businessId, id } },
        });
        if (!existing) throw new HttpError(404, 'CAMPAIGN_NOT_FOUND', 'Campaign not found');
        const startsAt =
          input.startsAt === undefined
            ? existing.startsAt
            : input.startsAt
              ? new Date(input.startsAt)
              : null;
        const endsAt =
          input.endsAt === undefined
            ? existing.endsAt
            : input.endsAt
              ? new Date(input.endsAt)
              : null;
        assertCampaignDates(startsAt, endsAt);
        return tx.campaign.update({
          where: { businessId_id: { businessId, id } },
          data: { ...input, startsAt, endsAt },
        });
      },
      { isolationLevel: 'Serializable' },
    );
    response.json({ campaign });
  });
  router.get('/calendar', async (request, response) => {
    const businessId = businessIdOf(request);
    await authorizeBusiness(runtime.db, businessId, principal(request).userId, 'business:read');
    const query = z.object({ from: z.iso.date(), to: z.iso.date() }).safeParse(request.query);
    if (!query.success) throw new HttpError(400, 'INVALID_RANGE', 'Use from and to dates');
    const fromDay = new Date(`${query.data.from}T00:00:00Z`),
      toDay = new Date(`${query.data.to}T00:00:00Z`);
    if (toDay < fromDay || toDay.getTime() - fromDay.getTime() > 90 * 86400000)
      throw new HttpError(400, 'INVALID_RANGE', 'Calendar range must be 0 to 90 days');
    const business = await runtime.db.business.findUniqueOrThrow({ where: { id: businessId } });
    const from = zonedDayStart(query.data.from, business.timezone);
    const endExclusive = zonedDayStart(
      new Date(toDay.getTime() + 86400000).toISOString().slice(0, 10),
      business.timezone,
    );
    response.json({
      content: await runtime.db.contentItem.findMany({
        where: { businessId, plannedAt: { gte: from, lt: endExclusive } },
        include: { campaign: { select: { id: true, title: true } } },
        orderBy: { plannedAt: 'asc' },
      }),
    });
  });
  return router;
}

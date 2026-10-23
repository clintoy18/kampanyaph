import { createHash } from 'node:crypto';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { HttpError, parseBody, uuidParam } from '../../common/errors.ts';
import { authorizeBusiness } from '../../common/permissions.ts';
import type { AiService } from '../../infrastructure/ai.ts';
import { principal, requireCsrf, requireSession, type AuthRuntime } from '../identity/session.ts';

export interface MarketingRuntime extends AuthRuntime {
  ai: AiService;
}
const briefFields = z
  .object({
    audienceId: z.uuid(),
    objective: z.string().trim().min(3).max(500),
    platform: z.string().trim().min(2).max(60),
    campaignTheme: z.string().trim().max(200).nullable().optional(),
    hook: z.string().trim().max(300).nullable().optional(),
    valueProposition: z.string().trim().max(500).nullable().optional(),
    trustEvidenceId: z.uuid().nullable().optional(),
    callToAction: z.string().trim().max(300).nullable().optional(),
  })
  .strict();

export function createMarketingRouter(runtime: MarketingRuntime) {
  const router = Router({ mergeParams: true });
  const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });
  router.use(requireSession(runtime));
  router.use((request, response, next) =>
    ['GET', 'HEAD', 'OPTIONS'].includes(request.method)
      ? next()
      : requireCsrf(runtime)(request, response, next),
  );
  const businessIdOf = (request: { params: Record<string, string | string[] | undefined> }) =>
    uuidParam(request.params.businessId);

  router.get('/briefs', async (request, response) => {
    const businessId = businessIdOf(request);
    await authorizeBusiness(runtime.db, businessId, principal(request).userId, 'business:read');
    response.json({
      briefs: await runtime.db.strategyBrief.findMany({
        where: { businessId },
        include: { audience: true, trustEvidence: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    });
  });
  router.post('/briefs', async (request, response) => {
    const businessId = businessIdOf(request);
    await authorizeBusiness(runtime.db, businessId, principal(request).userId, 'content:write');
    const input = parseBody(briefFields, request.body);
    const audience = await runtime.db.audience.findUnique({
      where: { businessId_id: { businessId, id: input.audienceId } },
    });
    if (!audience) throw new HttpError(404, 'AUDIENCE_NOT_FOUND', 'Audience not found');
    if (input.trustEvidenceId) {
      const evidence = await runtime.db.evidenceSource.findUnique({
        where: { businessId_id: { businessId, id: input.trustEvidenceId } },
      });
      if (!evidence || !evidence.confirmedAt)
        throw new HttpError(
          400,
          'UNCONFIRMED_EVIDENCE',
          'Trust evidence must be confirmed by an Owner',
        );
    }
    const brief = await runtime.db.strategyBrief.create({
      data: { businessId, createdById: principal(request).userId, ...input },
    });
    response.status(201).json({ brief });
  });
  router.post('/briefs/:briefId/suggest', aiLimiter, async (request, response) => {
    const businessId = businessIdOf(request),
      id = uuidParam(request.params.briefId),
      userId = principal(request).userId;
    await authorizeBusiness(runtime.db, businessId, userId, 'content:write');
    const brief = await runtime.db.strategyBrief.findUnique({
      where: { businessId_id: { businessId, id } },
      include: { audience: true, trustEvidence: true },
    });
    if (!brief) throw new HttpError(404, 'BRIEF_NOT_FOUND', 'Brief not found');
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const daily = await runtime.db.generationRun.count({
      where: { businessId, createdById: userId, createdAt: { gte: since } },
    });
    if (daily >= 20) throw new HttpError(429, 'GENERATION_LIMIT', 'Daily AI limit reached');
    const [brand, business, offerings] = await Promise.all([
      runtime.db.brandContext.findUnique({ where: { businessId } }),
      runtime.db.business.findUniqueOrThrow({ where: { id: businessId } }),
      runtime.db.offering.findMany({
        where: { businessId },
        select: { name: true, description: true },
        take: 20,
      }),
    ]);
    const input = {
      business: {
        name: business.name,
        industry: business.industry,
        description: business.description,
      },
      brand: brand && {
        voice: brand.voice,
        valueProposition: brand.valueProposition,
        boundaries: brand.boundaries,
      },
      offerings,
      audience: { name: brief.audience.name, needs: brief.audience.needs },
      objective: brief.objective,
      platform: brief.platform,
      theme: brief.campaignTheme,
      evidence: brief.trustEvidence?.confirmedAt ? brief.trustEvidence.claim : null,
    };
    const suggestion = await runtime.ai.strategy(input);
    const updated = await runtime.db.$transaction(async (tx) => {
      const saved = await tx.strategyBrief.update({
        where: { businessId_id: { businessId, id } },
        data: suggestion.value,
      });
      await tx.generationRun.create({
        data: {
          businessId,
          strategyBriefId: id,
          createdById: userId,
          method: 'FORMULA_GUIDED',
          model: suggestion.model,
          templateVersion: suggestion.model === 'local-demo' ? 'demo-v1' : 'strategy-v1',
          inputSnapshotHash: createHash('sha256').update(JSON.stringify(input)).digest('hex'),
          inputTokens: suggestion.inputTokens,
          outputTokens: suggestion.outputTokens,
        },
      });
      return saved;
    });
    response.json({ brief: updated });
  });
  router.get('/generations', async (request, response) => {
    const businessId = businessIdOf(request);
    await authorizeBusiness(runtime.db, businessId, principal(request).userId, 'business:read');
    response.json({
      generations: await runtime.db.generationRun.findMany({
        where: { businessId },
        select: {
          id: true,
          strategyBriefId: true,
          createdById: true,
          model: true,
          templateVersion: true,
          inputTokens: true,
          outputTokens: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    });
  });
  router.post('/briefs/:briefId/generate', aiLimiter, async (request, response) => {
    const businessId = businessIdOf(request),
      id = uuidParam(request.params.briefId),
      userId = principal(request).userId;
    await authorizeBusiness(runtime.db, businessId, userId, 'content:write');
    const brief = await runtime.db.strategyBrief.findUnique({
      where: { businessId_id: { businessId, id } },
      include: { audience: true, trustEvidence: true },
    });
    if (!brief) throw new HttpError(404, 'BRIEF_NOT_FOUND', 'Brief not found');
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const daily = await runtime.db.generationRun.count({
      where: { businessId, createdById: userId, createdAt: { gte: since } },
    });
    if (daily >= 20) throw new HttpError(429, 'GENERATION_LIMIT', 'Daily generation limit reached');
    const [brand, business, offerings] = await Promise.all([
      runtime.db.brandContext.findUnique({ where: { businessId } }),
      runtime.db.business.findUniqueOrThrow({ where: { id: businessId } }),
      runtime.db.offering.findMany({
        where: { businessId },
        select: { name: true, description: true },
        take: 20,
      }),
    ]);
    const input = {
      business: {
        name: business.name,
        industry: business.industry,
        description: business.description,
      },
      brand: brand && {
        voice: brand.voice,
        valueProposition: brand.valueProposition,
        boundaries: brand.boundaries,
      },
      offerings,
      audienceInsight: brief.audience.needs,
      marketingObjective: brief.objective,
      hook: brief.hook,
      valueProposition: brief.valueProposition ?? brand?.valueProposition,
      trustElement: brief.trustEvidence?.confirmedAt ? brief.trustEvidence.claim : null,
      callToAction: brief.callToAction,
      platformOptimization: brief.platform,
      strategy: { pillars: brief.pillars, angles: brief.angles },
    };
    const generated = await runtime.ai.content(input);
    const created = await runtime.db.$transaction(async (tx) => {
      const run = await tx.generationRun.create({
        data: {
          businessId,
          strategyBriefId: id,
          createdById: userId,
          method: 'FORMULA_GUIDED',
          model: generated.model,
          templateVersion: generated.model === 'local-demo' ? 'demo-v1' : 'mvp-v1',
          inputSnapshotHash: createHash('sha256').update(JSON.stringify(input)).digest('hex'),
          inputTokens: generated.inputTokens,
          outputTokens: generated.outputTokens,
        },
      });
      const item = await tx.contentItem.create({
        data: {
          businessId,
          strategyBriefId: id,
          createdById: userId,
          generationRunId: run.id,
          title: generated.value.title,
          platform: brief.platform,
        },
      });
      await tx.contentRevision.create({
        data: {
          businessId,
          contentItemId: item.id,
          version: 1,
          body: generated.value.body,
          authorId: userId,
        },
      });
      return item;
    });
    response.status(201).json({ content: created });
  });
  return router;
}

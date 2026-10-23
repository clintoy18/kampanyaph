import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { HttpError, parseBody } from '../../common/errors.ts';
import {
  hashPassword,
  randomToken,
  tokenHash,
  verifyPassword,
  csrfToken,
} from '../../common/security.ts';
import type { EmailService } from '../../infrastructure/email.ts';
import {
  endSession,
  principal,
  requireCsrf,
  requireSession,
  startSession,
  type AuthRuntime,
} from './session.ts';

export interface IdentityRuntime extends AuthRuntime {
  mail: EmailService;
  webOrigin: string;
}

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(12).max(128);
const registerSchema = z
  .object({ email, password, displayName: z.string().trim().min(1).max(100) })
  .strict();
const loginSchema = z.object({ email, password: z.string() }).strict();
const tokenSchema = z.object({ token: z.string().min(32).max(200) }).strict();

function link(origin: string, kind: 'invite' | 'reset', token: string): string {
  const url = new URL(origin);
  url.hash = `${kind}=${encodeURIComponent(token)}`;
  return url.toString();
}

export function createIdentityRouter(runtime: IdentityRuntime) {
  const router = Router();
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });

  router.post('/register', authLimiter, async (request, response) => {
    const input = parseBody(registerSchema, request.body);
    const existing = await runtime.db.user.findUnique({ where: { email: input.email } });
    if (existing) throw new HttpError(409, 'EMAIL_IN_USE', 'Email is already registered');
    const user = await runtime.db.user.create({
      data: {
        email: input.email,
        displayName: input.displayName,
        passwordHash: await hashPassword(input.password),
      },
    });
    response.status(201);
    await startSession(runtime, user, response);
  });

  router.post('/login', authLimiter, async (request, response) => {
    const input = parseBody(loginSchema, request.body);
    const user = await runtime.db.user.findUnique({ where: { email: input.email } });
    const valid = user
      ? await verifyPassword(input.password, user.passwordHash)
      : await verifyPassword(input.password, 'scrypt$32768$dummy$' + 'A'.repeat(86));
    if (!user || !valid)
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
    await startSession(runtime, user, response);
  });

  router.get('/me', requireSession(runtime), (request, response) => {
    const current = principal(request);
    response.json({
      user: { id: current.userId, email: current.email, displayName: current.displayName },
      csrfToken: csrfToken(current.sessionToken, runtime.csrfSecret),
    });
  });

  router.post(
    '/logout',
    requireSession(runtime),
    requireCsrf(runtime),
    async (request, response) => {
      await runtime.db.session.update({
        where: { id: principal(request).sessionId },
        data: { revokedAt: new Date() },
      });
      endSession(runtime, response);
      response.status(204).end();
    },
  );

  router.post('/forgot-password', authLimiter, async (request, response) => {
    const input = parseBody(z.object({ email }).strict(), request.body);
    const user = await runtime.db.user.findUnique({ where: { email: input.email } });
    if (user) {
      const raw = randomToken();
      await runtime.db.passwordReset.create({
        data: {
          userId: user.id,
          tokenHash: tokenHash(raw),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      });
      await runtime.mail.sendPasswordReset(user.email, link(runtime.webOrigin, 'reset', raw));
    }
    response
      .status(202)
      .json({ message: 'If the account exists, recovery instructions have been prepared' });
  });

  router.post('/reset-password', authLimiter, async (request, response) => {
    const input = parseBody(tokenSchema.extend({ password }), request.body);
    const reset = await runtime.db.passwordReset.findUnique({
      where: { tokenHash: tokenHash(input.token) },
    });
    if (!reset || reset.consumedAt || reset.expiresAt <= new Date()) {
      throw new HttpError(400, 'INVALID_RESET', 'Recovery link is invalid or expired');
    }
    const passwordHash = await hashPassword(input.password);
    await runtime.db.$transaction(async (tx) => {
      const consumed = await tx.passwordReset.updateMany({
        where: { id: reset.id, consumedAt: null, expiresAt: { gt: new Date() } },
        data: { consumedAt: new Date() },
      });
      if (consumed.count !== 1)
        throw new HttpError(400, 'INVALID_RESET', 'Recovery link is invalid or expired');
      await tx.user.update({ where: { id: reset.userId }, data: { passwordHash } });
      await tx.session.updateMany({
        where: { userId: reset.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
    response.status(204).end();
  });

  router.post(
    '/invitations/accept',
    requireSession(runtime),
    requireCsrf(runtime),
    async (request, response) => {
      const input = parseBody(tokenSchema, request.body);
      const invitation = await runtime.db.invitation.findUnique({
        where: { tokenHash: tokenHash(input.token) },
      });
      const current = principal(request);
      if (
        !invitation ||
        invitation.acceptedAt ||
        invitation.expiresAt <= new Date() ||
        invitation.email !== current.email
      ) {
        throw new HttpError(400, 'INVALID_INVITATION', 'Invitation is invalid or expired');
      }
      await runtime.db.$transaction(async (tx) => {
        const consumed = await tx.invitation.updateMany({
          where: { id: invitation.id, acceptedAt: null, expiresAt: { gt: new Date() } },
          data: { acceptedAt: new Date() },
        });
        if (consumed.count !== 1)
          throw new HttpError(400, 'INVALID_INVITATION', 'Invitation is invalid or expired');
        await tx.membership.upsert({
          where: {
            businessId_userId: { businessId: invitation.businessId, userId: current.userId },
          },
          create: {
            businessId: invitation.businessId,
            userId: current.userId,
            role: invitation.role,
          },
          update: {},
        });
      });
      response.status(204).end();
    },
  );

  return router;
}

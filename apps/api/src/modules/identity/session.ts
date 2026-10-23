import type { Request, RequestHandler, Response } from 'express';
import type { Database } from '../../infrastructure/database.ts';
import { HttpError } from '../../common/errors.ts';
import {
  constantTimeEqual,
  cookieValue,
  csrfToken,
  randomToken,
  tokenHash,
} from '../../common/security.ts';

export interface AuthRuntime {
  db: Database;
  csrfSecret: string;
  production: boolean;
}

export interface Principal {
  userId: string;
  email: string;
  displayName: string;
  sessionId: string;
  sessionToken: string;
}

const sessionDuration = 7 * 24 * 60 * 60 * 1000;

export function sessionCookieName(production: boolean) {
  return production ? '__Host-kampanya_session' : 'kampanya_session';
}

export function principal(request: Request): Principal {
  const value = (request as Request & { principal?: Principal }).principal;
  if (!value) throw new HttpError(401, 'UNAUTHENTICATED', 'Sign in to continue');
  return value;
}

export function requireSession(runtime: AuthRuntime): RequestHandler {
  return async (request, _response, next) => {
    try {
      const raw = cookieValue(request.headers.cookie, sessionCookieName(runtime.production));
      if (!raw) throw new HttpError(401, 'UNAUTHENTICATED', 'Sign in to continue');
      const session = await runtime.db.session.findUnique({
        where: { tokenHash: tokenHash(raw) },
        include: { user: true },
      });
      if (!session || session.revokedAt || session.expiresAt <= new Date()) {
        throw new HttpError(401, 'SESSION_EXPIRED', 'Session has expired');
      }
      (request as Request & { principal?: Principal }).principal = {
        userId: session.userId,
        email: session.user.email,
        displayName: session.user.displayName,
        sessionId: session.id,
        sessionToken: raw,
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireCsrf(runtime: AuthRuntime): RequestHandler {
  return (request, _response, next) => {
    try {
      const provided = request.get('X-CSRF-Token') ?? '';
      if (
        !constantTimeEqual(provided, csrfToken(principal(request).sessionToken, runtime.csrfSecret))
      ) {
        throw new HttpError(403, 'INVALID_CSRF', 'Request verification failed');
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export async function startSession(
  runtime: AuthRuntime,
  user: { id: string; email: string; displayName: string },
  response: Response,
) {
  const raw = randomToken();
  await runtime.db.session.create({
    data: {
      userId: user.id,
      tokenHash: tokenHash(raw),
      expiresAt: new Date(Date.now() + sessionDuration),
    },
  });
  response.cookie(sessionCookieName(runtime.production), raw, {
    httpOnly: true,
    secure: runtime.production,
    sameSite: runtime.production ? 'none' : 'lax',
    path: '/',
    maxAge: sessionDuration,
  });
  response.json({
    user: { id: user.id, email: user.email, displayName: user.displayName },
    csrfToken: csrfToken(raw, runtime.csrfSecret),
  });
}

export function endSession(runtime: AuthRuntime, response: Response) {
  response.clearCookie(sessionCookieName(runtime.production), {
    httpOnly: true,
    secure: runtime.production,
    sameSite: runtime.production ? 'none' : 'lax',
    path: '/',
  });
}

import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express from 'express';
import { HttpError, errorHandler } from './common/errors.ts';
import type { AiService } from './infrastructure/ai.ts';
import { createBusinessesRouter } from './modules/businesses/routes.ts';
import { createContentRouter } from './modules/content/routes.ts';
import { createIdentityRouter, type IdentityRuntime } from './modules/identity/routes.ts';
import { createMarketingRouter } from './modules/marketing/routes.ts';

export interface AppOptions {
  allowedOrigins: string[];
  runtime?: IdentityRuntime & { ai?: AiService };
}

export function createApp({ allowedOrigins, runtime }: AppOptions) {
  const app = express();
  app.disable('x-powered-by');

  app.use((_request, response, next) => {
    response.setHeader('X-Request-Id', randomUUID());
    next();
  });

  app.use(
    cors({
      credentials: true,
      origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin)),
    }),
  );
  if (runtime) {
    app.use((request, _response, next) => {
      if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return next();
      if (
        !request.get('Origin') ||
        !allowedOrigins.includes(request.get('Origin') ?? '') ||
        request.get('X-Kampanya-Request') !== '1'
      ) {
        return next(new HttpError(403, 'INVALID_ORIGIN', 'Request origin is not allowed'));
      }
      return next();
    });
  }
  app.use(express.json({ limit: '64kb' }));

  app.get('/healthz', (_request, response) => {
    response.json({ status: 'ok' });
  });

  app.get('/api/v1', (_request, response) => {
    response.json({ name: 'Kampanya API', version: 'v1' });
  });

  if (runtime) {
    app.use('/api/v1/auth', createIdentityRouter(runtime));
    app.use('/api/v1/businesses', createBusinessesRouter(runtime));
    app.use('/api/v1/businesses/:businessId', createContentRouter(runtime));
    if (runtime.ai)
      app.use(
        '/api/v1/businesses/:businessId',
        createMarketingRouter({ ...runtime, ai: runtime.ai }),
      );
  }

  app.use((_request, response) => {
    response.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Route not found' },
      requestId: response.getHeader('X-Request-Id'),
    });
  });

  app.use(errorHandler);

  return app;
}

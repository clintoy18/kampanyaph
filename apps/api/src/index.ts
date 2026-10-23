import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { createApp } from './app.ts';
import { createAiService } from './infrastructure/ai.ts';
import { createDatabase } from './infrastructure/database.ts';
import { LocalEmailSink } from './infrastructure/email.ts';

if (existsSync('.env')) loadEnvFile('.env');

const port = Number(process.env.PORT ?? 4000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}

const configuredOrigins = process.env.ALLOWED_ORIGINS?.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
if (process.env.NODE_ENV === 'production' && !configuredOrigins?.length) {
  throw new Error('ALLOWED_ORIGINS is required in production');
}

const production = process.env.NODE_ENV === 'production';
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
if (production)
  throw new Error('A production transactional email provider must be configured before deployment');
const csrfSecret = process.env.CSRF_SECRET ?? randomBytes(32).toString('base64url');
if (csrfSecret.length < 32) throw new Error('CSRF_SECRET must contain at least 32 characters');
const allowedOrigins = configuredOrigins ?? ['http://localhost:5173'];

const app = createApp({
  allowedOrigins,
  runtime: {
    db: createDatabase(databaseUrl),
    mail: new LocalEmailSink(),
    csrfSecret,
    production,
    webOrigin: allowedOrigins[0]!,
    ai: createAiService({
      provider: process.env.AI_PROVIDER,
      production,
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    }),
  },
});
app.listen(port, '0.0.0.0');

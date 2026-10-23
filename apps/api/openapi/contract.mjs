import { readFileSync, writeFileSync } from 'node:fs';
import prettier from 'prettier';

// Route manifest for the versioned contract and the web client's accepted paths.
const routes = [
  ['GET', '/healthz', 'Health check', 'public'],
  ['GET', '/api/v1', 'API metadata', 'public'],
  ['POST', '/api/v1/auth/register', 'Register with email and password', 'public'],
  ['POST', '/api/v1/auth/login', 'Start a session', 'public'],
  ['GET', '/api/v1/auth/me', 'Current user and CSRF token'],
  ['POST', '/api/v1/auth/logout', 'Revoke the current session'],
  ['POST', '/api/v1/auth/forgot-password', 'Prepare a recovery link', 'public'],
  ['POST', '/api/v1/auth/reset-password', 'Consume a recovery link', 'public'],
  ['POST', '/api/v1/auth/invitations/accept', 'Accept a business invitation'],
  ['GET', '/api/v1/businesses', 'List current memberships'],
  ['POST', '/api/v1/businesses', 'Create a business'],
  ['GET', '/api/v1/businesses/{businessId}', 'Read a business'],
  ['PATCH', '/api/v1/businesses/{businessId}', 'Update core business details'],
  ['GET', '/api/v1/businesses/{businessId}/members', 'List members'],
  ['PATCH', '/api/v1/businesses/{businessId}/members/{userId}', 'Change a member role'],
  ['DELETE', '/api/v1/businesses/{businessId}/members/{userId}', 'Remove a member'],
  ['GET', '/api/v1/businesses/{businessId}/invitations', 'List pending invitations'],
  ['POST', '/api/v1/businesses/{businessId}/invitations', 'Prepare an invitation'],
  ['GET', '/api/v1/businesses/{businessId}/brand', 'Read brand context'],
  ['PUT', '/api/v1/businesses/{businessId}/brand', 'Save brand context'],
  ['GET', '/api/v1/businesses/{businessId}/audiences', 'List audiences'],
  ['POST', '/api/v1/businesses/{businessId}/audiences', 'Create an audience'],
  ['PATCH', '/api/v1/businesses/{businessId}/audiences/{audienceId}', 'Update an audience'],
  ['DELETE', '/api/v1/businesses/{businessId}/audiences/{audienceId}', 'Delete an audience'],
  ['GET', '/api/v1/businesses/{businessId}/offerings', 'List offers'],
  ['POST', '/api/v1/businesses/{businessId}/offerings', 'Create an offer'],
  ['PATCH', '/api/v1/businesses/{businessId}/offerings/{offeringId}', 'Update an offer'],
  ['DELETE', '/api/v1/businesses/{businessId}/offerings/{offeringId}', 'Delete an offer'],
  ['GET', '/api/v1/businesses/{businessId}/evidence', 'List marketing evidence'],
  ['POST', '/api/v1/businesses/{businessId}/evidence', 'Create evidence'],
  [
    'PATCH',
    '/api/v1/businesses/{businessId}/evidence/{evidenceId}',
    'Update evidence and clear confirmation',
  ],
  ['DELETE', '/api/v1/businesses/{businessId}/evidence/{evidenceId}', 'Delete evidence'],
  [
    'POST',
    '/api/v1/businesses/{businessId}/evidence/{evidenceId}/confirm',
    'Owner confirms evidence',
  ],
  ['GET', '/api/v1/businesses/{businessId}/briefs', 'List strategy briefs'],
  ['POST', '/api/v1/businesses/{businessId}/briefs', 'Create a strategy brief'],
  ['POST', '/api/v1/businesses/{businessId}/briefs/{briefId}/suggest', 'Suggest strategy with AI'],
  [
    'POST',
    '/api/v1/businesses/{businessId}/briefs/{briefId}/generate',
    'Generate an editable content draft',
  ],
  ['GET', '/api/v1/businesses/{businessId}/generations', 'List generation history'],
  ['GET', '/api/v1/businesses/{businessId}/content', 'List content'],
  ['GET', '/api/v1/businesses/{businessId}/content/{contentId}', 'Read content and its history'],
  [
    'PATCH',
    '/api/v1/businesses/{businessId}/content/{contentId}',
    'Update content planning details',
  ],
  ['POST', '/api/v1/businesses/{businessId}/content/{contentId}/revisions', 'Save a new revision'],
  [
    'POST',
    '/api/v1/businesses/{businessId}/content/{contentId}/submit',
    'Submit a draft for review',
  ],
  [
    'POST',
    '/api/v1/businesses/{businessId}/content/{contentId}/decisions',
    'Review submitted content',
  ],
  [
    'POST',
    '/api/v1/businesses/{businessId}/content/{contentId}/publish',
    'Mark approved content published manually',
  ],
  ['GET', '/api/v1/businesses/{businessId}/campaigns', 'List campaigns'],
  ['POST', '/api/v1/businesses/{businessId}/campaigns', 'Create a campaign'],
  ['PATCH', '/api/v1/businesses/{businessId}/campaigns/{campaignId}', 'Update a campaign'],
  ['GET', '/api/v1/businesses/{businessId}/calendar', 'List planned content in a date range'],
];

const bodySchemas = {
  register: { email: 'string', password: 'string', displayName: 'string' },
  login: { email: 'string', password: 'string' },
  'forgot-password': { email: 'string' },
  'reset-password': { token: 'string', password: 'string' },
  accept: { token: 'string' },
  revisions: { body: 'string', expectedVersion: 'integer' },
  decisions: { outcome: 'string', note: 'string', checklist: 'object' },
};
const paths = {};
for (const [method, path, summary, access] of routes) {
  const parts = path.split('/');
  const action = parts.at(-1);
  const parameters = [...path.matchAll(/\{(\w+)\}/g)].map(([, name]) => ({
    in: 'path',
    name,
    required: true,
    schema: { type: 'string', format: 'uuid' },
  }));
  if (action === 'calendar')
    parameters.push(
      { in: 'query', name: 'from', required: true, schema: { type: 'string', format: 'date' } },
      { in: 'query', name: 'to', required: true, schema: { type: 'string', format: 'date' } },
    );
  const operation = {
    summary,
    operationId: `${method.toLowerCase()}${parts
      .filter(Boolean)
      .map((part) => part.replaceAll(/[{}-]/g, ''))
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join('')}`,
    ...(access === 'public' ? {} : { security: [{ sessionCookie: [] }] }),
    ...(parameters.length ? { parameters } : {}),
    ...(method === 'GET' ||
    method === 'DELETE' ||
    ['logout', 'submit', 'publish', 'suggest', 'generate', 'confirm'].includes(action)
      ? {}
      : {
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: Object.fromEntries(
                    Object.entries(bodySchemas[action] ?? {}).map(([name, type]) => [
                      name,
                      { type },
                    ]),
                  ),
                  additionalProperties: true,
                },
              },
            },
          },
        }),
    responses: {
      [method === 'DELETE' || ['logout', 'accept', 'reset-password'].includes(action)
        ? '204'
        : ['forgot-password', 'invitations'].includes(action) && method === 'POST'
          ? '202'
          : method === 'POST' &&
              !['login', 'submit', 'publish', 'confirm', 'suggest'].includes(action)
            ? '201'
            : '200']: { description: summary },
      400: {
        description: 'Invalid input',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
      },
      403: { description: 'Insufficient permission or invalid CSRF token' },
    },
  };
  if (method !== 'GET')
    operation.parameters = [
      ...(operation.parameters ?? []),
      {
        in: 'header',
        name: 'X-Kampanya-Request',
        required: true,
        schema: { type: 'string', const: '1' },
      },
      ...(access === 'public'
        ? []
        : [{ in: 'header', name: 'X-CSRF-Token', required: true, schema: { type: 'string' } }]),
    ];
  (paths[path] ??= {})[method.toLowerCase()] = operation;
}
const contract = {
  openapi: '3.1.0',
  info: {
    title: 'Kampanya API',
    version: '0.2.0',
    description:
      'Versioned MVP contract. Protected writes require an active session, allowed Origin, X-Kampanya-Request: 1, and X-CSRF-Token.',
  },
  servers: [{ url: '/' }],
  paths,
  components: {
    securitySchemes: {
      sessionCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: 'kampanya_session',
        description: 'Production uses __Host-kampanya_session.',
      },
    },
    schemas: {
      ApiError: {
        type: 'object',
        required: ['error', 'requestId'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: { code: { type: 'string' }, message: { type: 'string' } },
          },
          requestId: { type: 'string', format: 'uuid' },
        },
      },
    },
  },
};
const json = await prettier.format(JSON.stringify(contract), { parser: 'json', singleQuote: true });
const routeType = routes
  .filter(([, path]) => path.startsWith('/api/v1/'))
  .map(([, path]) => path.slice('/api/v1'.length).replaceAll(/\{\w+\}/g, '${string}'));
const types = await prettier.format(
  `// Generated from apps/api/openapi/contract.mjs. Do not edit by hand.\nexport type ApiPath =\n${[...new Set(routeType)].map((path) => `  | \`${path}\``).join('\n')};\nexport type ApiRequestPath = ApiPath | \`\${ApiPath}?\${string}\`;\n`,
  { parser: 'typescript', singleQuote: true },
);
const files = [
  ['openapi/openapi.json', json],
  ['../web/src/app/api-contract.ts', types],
];
if (process.argv.includes('--check')) {
  for (const [path, expected] of files)
    if (readFileSync(path, 'utf8') !== expected)
      throw new Error(`${path} is out of date; run npm run contract:generate`);
} else for (const [path, contents] of files) writeFileSync(path, contents);

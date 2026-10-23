import type { ApiRequestPath } from './api-contract';

export type BusinessPath = `/businesses/${string}`;
export type Role = 'OWNER' | 'EDITOR' | 'REVIEWER';
export type User = { id: string; email: string; displayName: string };
export type Business = {
  id: string;
  name: string;
  description: string | null;
  industry: string | null;
  timezone: string;
  role: Role;
};
export type Brand = {
  voice: string;
  valueProposition: string | null;
  boundaries: string | null;
} | null;
export type Audience = { id: string; name: string; needs: string };
export type Evidence = {
  id: string;
  label: string;
  claim: string;
  sourceUrl: string | null;
  confirmedAt: string | null;
};
export type Offering = { id: string; name: string; description: string };
export type Brief = {
  id: string;
  objective: string;
  platform: string;
  campaignTheme: string | null;
  hook: string | null;
  valueProposition: string | null;
  callToAction: string | null;
  audienceId: string;
  trustEvidenceId: string | null;
  pillars: string[] | null;
  angles: string[] | null;
  rationale: string | null;
  audience: Audience;
  trustEvidence: Evidence | null;
};
export type Revision = {
  id: string;
  version: number;
  body: string;
  authorId: string;
  createdAt: string;
};
export type Decision = {
  id: string;
  outcome: 'APPROVED' | 'CHANGES_REQUESTED';
  note: string | null;
  reviewerId: string;
  createdAt: string;
};
export type Content = {
  id: string;
  title: string;
  platform: string;
  status: 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'PUBLISHED';
  createdById: string;
  plannedAt: string | null;
  campaignId: string | null;
  revisions: Revision[];
  reviewDecisions?: Decision[];
  campaign?: { id: string; title: string } | null;
};
export type Campaign = {
  id: string;
  title: string;
  objective: string;
  startsAt: string | null;
  endsAt: string | null;
  _count?: { contentItems: number };
};
export type Member = User & { role: Role };
export type Invitation = { id: string; email: string; role: Role; expiresAt: string };

const baseUrl = (import.meta.env.VITE_API_ORIGIN ?? 'http://localhost:4000').replace(/\/$/, '');
let csrf = '';
export function setCsrf(token: string) {
  csrf = token;
}
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: ApiRequestPath,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    method: options.method ?? 'GET',
    credentials: 'include',
    headers:
      options.method && options.method !== 'GET'
        ? {
            'Content-Type': 'application/json',
            'X-Kampanya-Request': '1',
            ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
          }
        : {},
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as {
      error?: { code?: string; message?: string };
    };
    throw new ApiError(
      response.status,
      error.error?.code ?? 'REQUEST_FAILED',
      error.error?.message ?? 'The request could not be completed',
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const businessPath = (id: string): BusinessPath => `/businesses/${encodeURIComponent(id)}`;

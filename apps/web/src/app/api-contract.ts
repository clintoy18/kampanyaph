// Generated from apps/api/openapi/contract.mjs. Do not edit by hand.
export type ApiPath =
  | `/auth/register`
  | `/auth/login`
  | `/auth/me`
  | `/auth/logout`
  | `/auth/forgot-password`
  | `/auth/reset-password`
  | `/auth/invitations/accept`
  | `/businesses`
  | `/businesses/${string}`
  | `/businesses/${string}/members`
  | `/businesses/${string}/members/${string}`
  | `/businesses/${string}/invitations`
  | `/businesses/${string}/brand`
  | `/businesses/${string}/audiences`
  | `/businesses/${string}/audiences/${string}`
  | `/businesses/${string}/offerings`
  | `/businesses/${string}/offerings/${string}`
  | `/businesses/${string}/evidence`
  | `/businesses/${string}/evidence/${string}`
  | `/businesses/${string}/evidence/${string}/confirm`
  | `/businesses/${string}/briefs`
  | `/businesses/${string}/briefs/${string}/suggest`
  | `/businesses/${string}/briefs/${string}/generate`
  | `/businesses/${string}/generations`
  | `/businesses/${string}/content`
  | `/businesses/${string}/content/${string}`
  | `/businesses/${string}/content/${string}/revisions`
  | `/businesses/${string}/content/${string}/submit`
  | `/businesses/${string}/content/${string}/decisions`
  | `/businesses/${string}/content/${string}/publish`
  | `/businesses/${string}/campaigns`
  | `/businesses/${string}/campaigns/${string}`
  | `/businesses/${string}/calendar`;
export type ApiRequestPath = ApiPath | `${ApiPath}?${string}`;

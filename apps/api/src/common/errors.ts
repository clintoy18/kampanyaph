import type { NextFunction, Request, Response } from 'express';
import { z, type ZodType, type output } from 'zod';

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function parseBody<T extends ZodType>(schema: T, value: unknown): output<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new HttpError(
      400,
      'INVALID_INPUT',
      result.error.issues.map((issue) => issue.message).join('; '),
    );
  }
  return result.data;
}

export function errorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
) {
  void _next;
  const invalidJson = error instanceof SyntaxError && 'body' in error;
  const tooLarge =
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'entity.too.large';
  const known = error instanceof HttpError ? error : null;
  const databaseCode =
    typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
  const databaseConflict = databaseCode === 'P2002' || databaseCode === 'P2034';
  const status =
    known?.status ?? (invalidJson ? 400 : tooLarge ? 413 : databaseConflict ? 409 : 500);
  const code =
    known?.code ??
    (invalidJson
      ? 'INVALID_JSON'
      : tooLarge
        ? 'BODY_TOO_LARGE'
        : databaseConflict
          ? 'CONFLICT'
          : 'INTERNAL_ERROR');
  const message =
    known?.message ??
    (invalidJson
      ? 'Request body is not valid JSON'
      : tooLarge
        ? 'Request body exceeds the allowed size'
        : databaseConflict
          ? 'The record changed. Refresh and try again'
          : 'An unexpected error occurred');
  response.status(status).json({
    error: { code, message },
    requestId: response.getHeader('X-Request-Id'),
  });
}

export function param(value: string | string[] | undefined): string {
  if (!value || Array.isArray(value))
    throw new HttpError(400, 'INVALID_PATH', 'Invalid path parameter');
  return value;
}

export function uuidParam(value: string | string[] | undefined): string {
  const result = z.uuid().safeParse(param(value));
  if (!result.success) throw new HttpError(400, 'INVALID_PATH', 'Invalid identifier');
  return result.data;
}

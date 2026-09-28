import type { NextFunction, Request, Response } from 'express';

import { log } from '../logger.js';
import { getRequestId } from './requestId.js';

type HttpishError = {
  statusCode?: unknown;
  status?: unknown;
  code?: unknown;
  expose?: unknown;
  name?: unknown;
  constructor?: { name?: unknown };
  message?: unknown;
};

function isCsrfError(err: HttpishError): boolean {
  const message = typeof err.message === 'string' ? err.message.toLowerCase() : '';
  const name = typeof err.name === 'string' ? err.name : '';
  const ctorName =
    err.constructor && typeof err.constructor.name === 'string' ? err.constructor.name : '';
  const isNamedCsrfError = name === 'CsrfError' || ctorName === 'CsrfError';
  const isForbiddenError = name === 'ForbiddenError' || ctorName === 'ForbiddenError';
  return (
    isNamedCsrfError ||
    err.code === 'EBADCSRFTOKEN' ||
    (isForbiddenError && message.includes('csrf'))
  );
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const maybe = err as HttpishError;

  if (isCsrfError(maybe)) {
    res.setHeader('X-CSRF-Error', '1');
    res.status(403).json({ error: 'Invalid CSRF token', code: 'CSRF_INVALID' });
    return;
  }

  const statusFromError =
    typeof maybe.statusCode === 'number'
      ? maybe.statusCode
      : typeof maybe.status === 'number'
        ? maybe.status
        : undefined;
  const status =
    statusFromError && statusFromError >= 400 && statusFromError < 600 ? statusFromError : 500;

  log('error', 'request_failed', {
    requestId: getRequestId(res),
    method: req.method,
    path: req.originalUrl,
    status,
    error: err instanceof Error ? (err.stack ?? err.message) : String(err),
  });

  const expose = maybe.expose === true && err instanceof Error && status < 500;
  const message = expose
    ? err.message
    : status === 500
      ? 'Internal server error'
      : 'Request failed';
  res.status(status).json({ error: message });
}

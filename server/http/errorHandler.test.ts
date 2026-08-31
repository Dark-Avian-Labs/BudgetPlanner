import { describe, expect, it, vi } from 'vitest';

import { errorHandler } from './errorHandler.js';

function invoke(err: unknown): { statusCode: number; body: unknown; headers: Record<string, string> } {
  const headers: Record<string, string> = {};
  let statusCode = 0;
  let body: unknown;
  const res = {
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: unknown) {
      body = payload;
      return this;
    },
  };
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    errorHandler(err, {} as never, res as never, () => {});
  } finally {
    errorSpy.mockRestore();
  }
  return { statusCode, body, headers };
}

describe('errorHandler', () => {
  it('maps CSRF failures to a fixed 403 payload', () => {
    const err = Object.assign(new Error('invalid csrf token'), { code: 'EBADCSRFTOKEN' });
    expect(invoke(err)).toEqual({
      statusCode: 403,
      body: { error: 'Invalid CSRF token', code: 'CSRF_INVALID' },
      headers: { 'X-CSRF-Error': '1' },
    });
  });

  it('does not echo 4xx messages unless expose is set', () => {
    const err = Object.assign(new Error('Unexpected token } in JSON'), { status: 400 });
    expect(invoke(err)).toEqual({
      statusCode: 400,
      body: { error: 'Request failed' },
      headers: {},
    });
  });

  it('echoes 4xx messages only when expose is true', () => {
    const err = Object.assign(new Error('Valid email is required'), {
      status: 400,
      expose: true,
    });
    expect(invoke(err).body).toEqual({ error: 'Valid email is required' });
  });

  it('hides 5xx messages', () => {
    const err = Object.assign(new Error('SQLITE_ERROR: no such table'), { status: 500 });
    expect(invoke(err)).toEqual({
      statusCode: 500,
      body: { error: 'Internal server error' },
      headers: {},
    });
  });
});

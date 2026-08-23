export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

let cachedToken = '';
let getClerkToken: (() => Promise<string | null>) | null = null;

export function setClerkTokenGetter(getter: () => Promise<string | null>): void {
  getClerkToken = getter;
}

async function fetchCsrfToken(): Promise<string> {
  try {
    const res = await fetch('/api/csrf');
    if (res.ok) {
      const data = (await res.json()) as { csrfToken?: string };
      return data.csrfToken ?? '';
    }
  } catch {
    // ignore
  }
  return '';
}

async function getCsrfToken(): Promise<string> {
  if (!cachedToken) {
    cachedToken = await fetchCsrfToken();
  }
  return cachedToken;
}

export function clearCsrfToken(): void {
  cachedToken = '';
}

function isCsrfRejection(response: Response): boolean {
  return response.status === 403 && response.headers.get('X-CSRF-Error') === '1';
}

export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const needsCsrf = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';

  const buildHeaders = async (token: string): Promise<Headers> => {
    const headers = new Headers(init?.headers);
    if (needsCsrf && token) headers.set('X-CSRF-Token', token);
    if (getClerkToken) {
      const bearer = await getClerkToken();
      if (bearer) headers.set('Authorization', `Bearer ${bearer}`);
    }
    if (!headers.has('Content-Type') && init?.body && typeof init.body === 'string') {
      headers.set('Content-Type', 'application/json');
    }
    return headers;
  };

  const token = needsCsrf ? await getCsrfToken() : '';
  const response = await fetch(url, { ...init, headers: await buildHeaders(token) });

  if (needsCsrf && isCsrfRejection(response)) {
    clearCsrfToken();
    const freshToken = await getCsrfToken();
    if (freshToken && freshToken !== token) {
      return fetch(url, { ...init, headers: await buildHeaders(freshToken) });
    }
  }

  return response;
}

export async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(url, init);
  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // ignore
    }
    throw new ApiError(message, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

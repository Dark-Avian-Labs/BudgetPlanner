let cachedToken = '';
let getClerkToken: (() => Promise<string | null>) | null = null;

export function setClerkTokenGetter(getter: () => Promise<string | null>): void {
  getClerkToken = getter;
}

async function getCsrfToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  try {
    const res = await fetch('/api/csrf');
    if (res.ok) {
      const data = await res.json();
      cachedToken = (data.csrfToken as string) ?? '';
      return cachedToken;
    }
  } catch {
    // ignore
  }
  return '';
}

export function clearCsrfToken(): void {
  cachedToken = '';
}

export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const needsCsrf = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';

  const headers = new Headers(init?.headers);

  if (needsCsrf) {
    const token = await getCsrfToken();
    if (token) headers.set('X-CSRF-Token', token);
  }

  if (getClerkToken) {
    const bearer = await getClerkToken();
    if (bearer) headers.set('Authorization', `Bearer ${bearer}`);
  }

  if (!headers.has('Content-Type') && init?.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(url, { ...init, headers, credentials: 'same-origin' });
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
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

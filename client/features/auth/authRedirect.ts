export const AUTH_REDIRECT_QUERY_PARAM = 'redirect_url';

export function safeAuthRedirectPath(path: string): string | null {
  if (
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !path.includes('\\') &&
    !path.includes('://')
  ) {
    return path;
  }
  return null;
}

export function buildAuthPagePath(basePath: string, returnTo: string): string {
  const safe = safeAuthRedirectPath(returnTo);
  if (!safe) return basePath;
  return `${basePath}?${AUTH_REDIRECT_QUERY_PARAM}=${encodeURIComponent(safe)}`;
}

export function getAuthRedirectUrl(searchParams: URLSearchParams, fallback: string): string {
  const fromQuery = searchParams.get(AUTH_REDIRECT_QUERY_PARAM);
  if (fromQuery) {
    const safe = safeAuthRedirectPath(fromQuery);
    if (safe) return safe;
  }
  return fallback;
}

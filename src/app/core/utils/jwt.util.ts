function base64UrlEncode(input: string): string {
  return btoa(unescape(encodeURIComponent(input)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  return decodeURIComponent(escape(atob(padded)));
}

/**
 * Structurally a real JWT (header.payload.signature) so exp-based expiry and
 * refresh logic is genuinely exercised — but there's no real backend behind
 * this demo yet, so the signature segment is a placeholder. Swap AuthApiService
 * for real HTTP calls and this becomes unnecessary (the server issues real JWTs).
 */
export function createJwt(claims: Record<string, unknown>, expiresInSeconds: number): string {
  const header = { alg: 'none', typ: 'JWT' };
  const iat = Math.floor(Date.now() / 1000);
  const payload = { ...claims, iat, exp: iat + expiresInSeconds };
  return `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}.mock-signature`;
}

export function decodeJwt<T = Record<string, unknown>>(token: string): T | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    return JSON.parse(base64UrlDecode(parts[1])) as T;
  } catch {
    return null;
  }
}

export function isJwtExpired(token: string, skewSeconds = 0): boolean {
  const payload = decodeJwt<{ exp?: number }>(token);
  if (!payload?.exp) return true;
  return Date.now() >= (payload.exp - skewSeconds) * 1000;
}

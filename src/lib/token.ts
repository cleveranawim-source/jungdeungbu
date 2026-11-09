export const TOKEN_RE = /^[A-Za-z0-9_-]{22}$/;

export function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function isToken(s: unknown): s is string {
  return typeof s === 'string' && TOKEN_RE.test(s);
}

/**
 * Safely decode a JWT token payload.
 * JWT uses base64url encoding (with - and _) but atob() only handles
 * standard base64 (with + and /). This converts before decoding.
 */
export function decodeJwtPayload(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

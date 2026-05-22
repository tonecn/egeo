import type { Env, TokenRecord } from './types.ts';

// ── Basic Auth ─────────────────────────────────────────────────────────────

export function verifyBasicAuth(request: Request, env: Env): boolean {
  const authHeader = request.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Basic ')) return false;

  let decoded: string;
  try {
    decoded = atob(authHeader.slice(6));
  } catch {
    return false;
  }

  const colonIndex = decoded.indexOf(':');
  if (colonIndex === -1) return false;

  const username = decoded.slice(0, colonIndex);
  const password = decoded.slice(colonIndex + 1);

  // Constant-time comparison to prevent timing attacks
  return safeEqual(username, env.ADMIN_USERNAME) && safeEqual(password, env.ADMIN_PASSWORD);
}

// ── Bearer Token ───────────────────────────────────────────────────────────

export async function verifyBearerToken(
  request: Request,
  env: Env,
): Promise<TokenRecord | null> {
  const authHeader = request.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const hash = await sha256Hex(token);
  const raw = await env.APP_KV.get(`token:${hash}`);
  if (!raw) return null;

  const record: TokenRecord = JSON.parse(raw);
  if (!record.enabled) return null;

  return record;
}

// ── Helpers ────────────────────────────────────────────────────────────────

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Constant-time string comparison — prevents timing-based credential enumeration. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

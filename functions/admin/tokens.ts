import type { PagesFunction } from '@cloudflare/workers-types';
import type { Env, TokenMetaRecord } from '../_shared/types.ts';
import { ok, created, Errors } from '../_shared/response.ts';
import { sha256Hex } from '../_shared/auth.ts';

// GET /admin/tokens
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  const list = await env.APP_KV.list({ prefix: 'token_meta:' });

  const tokens = await Promise.all(
    list.keys.map(async (key) => {
      const raw = await env.APP_KV.get(key.name);
      if (!raw) return null;
      const { token_hash: _, ...record } = JSON.parse(raw) as TokenMetaRecord;
      return record;
    }),
  );

  return ok(tokens.filter(Boolean));
};

// POST /admin/tokens
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return Errors.invalidRequest('Invalid JSON body');
  }

  const name = (body.name ?? '').trim();
  if (!name) return Errors.missingParam('name');

  // Generate cryptographically random token
  const randomBytes = new Uint8Array(24);
  crypto.getRandomValues(randomBytes);
  const tokenValue =
    'geoip_' +
    Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

  const tokenHash = await sha256Hex(tokenValue);
  const now = new Date().toISOString();
  const id = `tok_${Date.now()}_${tokenHash.slice(0, 8)}`;

  const baseRecord = { id, name, enabled: true, created_at: now, updated_at: now };
  const metaRecord: TokenMetaRecord = { ...baseRecord, token_hash: tokenHash };

  await Promise.all([
    // Fast lookup by hash — used by Bearer Token auth
    env.APP_KV.put(`token:${tokenHash}`, JSON.stringify(baseRecord)),
    // Full metadata — used by admin listing
    env.APP_KV.put(`token_meta:${id}`, JSON.stringify(metaRecord)),
  ]);

  return created({ ...baseRecord, token: tokenValue });
};

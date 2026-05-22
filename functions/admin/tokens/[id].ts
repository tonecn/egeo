import type { PagesFunction } from '@cloudflare/workers-types';
import type { Env, TokenMetaRecord } from '../../_shared/types.ts';
import { ok, Errors } from '../../_shared/response.ts';

// PATCH /admin/tokens/:id  — enable or disable a token
export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context;
  const id = params.id as string;

  const metaRaw = await env.APP_KV.get(`token_meta:${id}`);
  if (!metaRaw) return Errors.tokenNotFound();

  const meta: TokenMetaRecord = JSON.parse(metaRaw);

  let body: { enabled?: boolean };
  try {
    body = await request.json();
  } catch {
    return Errors.invalidRequest('Invalid JSON body');
  }

  if (typeof body.enabled !== 'boolean') return Errors.missingParam('enabled');

  const now = new Date().toISOString();
  const updatedMeta: TokenMetaRecord = { ...meta, enabled: body.enabled, updated_at: now };
  const updatedBase = {
    id: meta.id,
    name: meta.name,
    enabled: body.enabled,
    created_at: meta.created_at,
    updated_at: now,
  };

  await Promise.all([
    env.APP_KV.put(`token_meta:${id}`, JSON.stringify(updatedMeta)),
    env.APP_KV.put(`token:${meta.token_hash}`, JSON.stringify(updatedBase)),
  ]);

  const { token_hash: _, ...safe } = updatedMeta;
  return ok(safe);
};

// DELETE /admin/tokens/:id
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const id = params.id as string;

  const metaRaw = await env.APP_KV.get(`token_meta:${id}`);
  if (!metaRaw) return Errors.tokenNotFound();

  const meta: TokenMetaRecord = JSON.parse(metaRaw);

  await Promise.all([
    env.APP_KV.delete(`token_meta:${id}`),
    env.APP_KV.delete(`token:${meta.token_hash}`),
  ]);

  return ok({ id, deleted: true });
};

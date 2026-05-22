import type { PagesFunction } from '@cloudflare/workers-types';
import type { Env } from '../_shared/types.ts';
import { okWithMeta, Errors } from '../_shared/response.ts';
import { verifyBearerToken } from '../_shared/auth.ts';
import { getActiveDb } from '../_shared/config.ts';
import { getDbReader, normalizeCityRecord } from '../_shared/db.ts';

function validateIPv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  for (const part of parts) {
    if (!/^\d+$/.test(part) || part.length === 0) return false;
    const num = parseInt(part, 10);
    if (num < 0 || num > 255) return false;
  }
  return true;
}

// GET /api/geoip?ip=x.x.x.x
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  // Auth — only Bearer Token accepted on this route
  const tokenRecord = await verifyBearerToken(request, env);
  if (!tokenRecord) return Errors.invalidBearerToken();

  // Validate IP parameter
  const ip = new URL(request.url).searchParams.get('ip') ?? '';
  if (!ip) return Errors.missingParam('ip');
  if (!validateIPv4(ip)) return Errors.invalidIp();

  // Load active database config
  const activeDb = await getActiveDb(env);
  if (!activeDb) return Errors.dbNotConfigured();

  try {
    const { reader, cacheHit } = await getDbReader(env, activeDb);
    const raw = reader.get(ip);
    const data = normalizeCityRecord(raw, ip);

    return okWithMeta(data, {
      database: {
        filename: activeDb.filename,
        uploaded_at: activeDb.uploaded_at,
      },
      db_cache_hit: cacheHit,
    });
  } catch (e: unknown) {
    return Errors.geoipFailed(e instanceof Error ? e.message : String(e));
  }
};

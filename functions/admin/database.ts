import type { PagesFunction } from '@cloudflare/workers-types';
import type { Env } from '../_shared/types.ts';
import { ok, Errors } from '../_shared/response.ts';
import { getActiveDb } from '../_shared/config.ts';

// GET /admin/database
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const activeDb = await getActiveDb(context.env);
  if (!activeDb) return Errors.dbNotConfigured();
  return ok(activeDb);
};

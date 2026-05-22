import type { PagesFunction } from '@cloudflare/workers-types';
import type { Env } from '../_shared/types.ts';
import { ok } from '../_shared/response.ts';
import { defaultConfig, getActiveDb } from '../_shared/config.ts';

// GET /admin/config
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const activeDb = await getActiveDb(context.env);
  return ok({
    defaults: defaultConfig,
    active_db: activeDb ?? null,
  });
};

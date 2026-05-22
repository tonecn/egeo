import type { PagesFunction } from '@cloudflare/workers-types';
import type { Env } from '../_shared/types.ts';
import { ok, err } from '../_shared/response.ts';
import { getActiveIp2Region } from '../_shared/config.ts';

// GET /admin/ip2region
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const config = await getActiveIp2Region(context.env);
  if (!config) return err('IP2REGION_NOT_CONFIGURED', 'No ip2region database configured', 404);
  return ok(config);
};

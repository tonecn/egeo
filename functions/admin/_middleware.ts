import type { PagesFunction } from '@cloudflare/workers-types';
import type { Env } from '../_shared/types.ts';

/**
 * Basic Auth for /admin/* is enforced by the root _middleware.ts.
 * This file is kept as a structural placeholder for future per-admin middleware.
 */
export const onRequest: PagesFunction<Env> = async (context) => {
  return context.next();
};

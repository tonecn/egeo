import type { PagesFunction } from '@cloudflare/workers-types';
import type { Env } from './_shared/types.ts';
import { verifyBasicAuth } from './_shared/auth.ts';
import { Errors } from './_shared/response.ts';

/**
 * Root middleware — intercepts every request to this Pages site.
 *
 * /api/* routes use Bearer Token auth (handled per-route), so they are
 * passed through here without Basic Auth checking.
 *
 * Everything else — static assets (the Svelte SPA) and all /admin/* routes —
 * requires valid HTTP Basic Auth credentials.
 */
export const onRequest: PagesFunction<Env> = async (context) => {
  const { pathname } = new URL(context.request.url);

  if (pathname.startsWith('/api/')) {
    return context.next();
  }

  if (!verifyBasicAuth(context.request, context.env)) {
    return Errors.invalidBasicAuth();
  }

  return context.next();
};

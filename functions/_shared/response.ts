function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function ok<T>(data: T, status = 200): Response {
  return json({ success: true, data }, status);
}

export function created<T>(data: T): Response {
  return ok(data, 201);
}

export function okWithMeta<T>(data: T, meta: Record<string, unknown>): Response {
  return json({ success: true, data, meta }, 200);
}

export function err(code: string, message: string, status: number): Response {
  return json({ success: false, error: { code, message } }, status);
}

export const Errors = {
  invalidBasicAuth: (): Response => {
    return new Response(
      JSON.stringify({ success: false, error: { code: 'INVALID_BASIC_AUTH', message: 'Invalid credentials' } }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'Basic realm="GeoIP Admin"',
        },
      },
    );
  },
  invalidBearerToken: () => err('INVALID_BEARER_TOKEN', 'Invalid or expired token', 401),
  invalidIp: () => err('INVALID_IP', 'Must be a valid IPv4 address (no IPv6, CIDR, or port)', 400),
  missingParam: (name: string) => err('MISSING_PARAMETER', `${name} is required`, 400),
  invalidRequest: (msg: string) => err('INVALID_REQUEST', msg, 400),
  tokenNotFound: () => err('TOKEN_NOT_FOUND', 'Token not found', 404),
  dbNotConfigured: () => err('DATABASE_NOT_CONFIGURED', 'No active database configured', 500),
  dbNotFound: () => err('DATABASE_NOT_FOUND', 'Database file not found in R2', 404),
  geoipFailed: (msg: string) => err('GEOIP_LOOKUP_FAILED', msg, 500),
  internal: (msg = 'Internal server error') => err('INTERNAL_ERROR', msg, 500),
};

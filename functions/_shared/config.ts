import type { ActiveDbConfig, ActiveIp2RegionConfig, Env } from './types.ts';

export const defaultConfig = {
  r2DatabasePrefix: 'db/uploads/',
  r2Ip2RegionPrefix: 'ip2region/uploads/',
  tokenPrefix: 'geoip',
  tokenLength: 32,
  allowIPv6: false,
  resultCacheEnabled: false,
} as const;

export async function getActiveDb(env: Env): Promise<ActiveDbConfig | null> {
  const raw = await env.APP_KV.get('config:active_db');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ActiveDbConfig;
  } catch {
    return null;
  }
}

export async function setActiveDb(env: Env, config: ActiveDbConfig): Promise<void> {
  await env.APP_KV.put('config:active_db', JSON.stringify(config));
}

export async function getActiveIp2Region(env: Env): Promise<ActiveIp2RegionConfig | null> {
  const raw = await env.APP_KV.get('config:active_ip2region');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ActiveIp2RegionConfig;
  } catch {
    return null;
  }
}

export async function setActiveIp2Region(env: Env, config: ActiveIp2RegionConfig): Promise<void> {
  await env.APP_KV.put('config:active_ip2region', JSON.stringify(config));
}

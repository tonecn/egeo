import { Reader } from 'mmdb-lib';
import type { ActiveDbConfig, Env } from './types.ts';
import { getZhCountryName } from './zh-localization.ts';

interface CityRecord {
  continent?: { code?: string; names?: Record<string, string> };
  country?: { iso_code?: string; names?: Record<string, string> };
  subdivisions?: Array<{ iso_code?: string; names?: Record<string, string> }>;
  city?: { names?: Record<string, string> };
  location?: {
    latitude?: number;
    longitude?: number;
    time_zone?: string;
    accuracy_radius?: number;
  };
  postal?: { code?: string };
}

// In-process reader cache — shared across all requests within one Worker instance.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let dbCache: { objectKey: string; reader: Reader<any> } | null = null;

export async function getDbReader(
  env: Env,
  activeDb: ActiveDbConfig,
): Promise<{ reader: Reader<any>; cacheHit: boolean }> { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (dbCache && dbCache.objectKey === activeDb.object_key) {
    return { reader: dbCache.reader, cacheHit: true };
  }

  const obj = await env.GEOIP_R2.get(activeDb.object_key);
  if (!obj) throw new Error(`mmdb not found in R2: ${activeDb.object_key}`);

  const buffer = Buffer.from(await obj.arrayBuffer());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reader = new Reader<any>(buffer);
  dbCache = { objectKey: activeDb.object_key, reader };
  return { reader, cacheHit: false };
}

export function normalizeCityRecord(
  raw: CityRecord | null,
  ip: string,
  ip2regionResult: string | null = null,
) {
  const isoCode = raw?.country?.iso_code ?? null;
  const isCN = isoCode === 'CN';

  // Chinese country name: prefer MaxMind zh-CN, fall back to static map.
  const zhCountry = getZhCountryName(isoCode, raw?.country?.names?.['zh-CN']);

  // Chinese subdivision/city: only meaningful for CN IPs.
  // ip2regionResult format: "国家|省份|城市|ISP|国家代码"
  let zhSubdivision: string | null = null;
  let zhCity: string | null = null;
  if (isCN) {
    if (ip2regionResult) {
      const parts = ip2regionResult.split('|');
      const province = parts[1]?.trim();
      const city = parts[2]?.trim();
      zhSubdivision = province && province !== '0' ? province : null;
      zhCity = city && city !== '0' ? city : null;
    } else {
      zhSubdivision = null;
      zhCity = null;
    }
  }

  return {
    ip,
    continent: {
      code: raw?.continent?.code ?? null,
      name: raw?.continent?.names?.en ?? null,
    },
    country: {
      iso_code: isoCode,
      name: raw?.country?.names?.en ?? null,
    },
    subdivisions: (raw?.subdivisions ?? []).map(s => ({
      iso_code: s.iso_code ?? null,
      name: s.names?.en ?? null,
    })),
    city: {
      name: raw?.city?.names?.en ?? null,
    },
    location: {
      latitude: raw?.location?.latitude ?? null,
      longitude: raw?.location?.longitude ?? null,
      time_zone: raw?.location?.time_zone ?? null,
      accuracy_radius: raw?.location?.accuracy_radius ?? null,
    },
    postal: {
      code: raw?.postal?.code ?? null,
    },
    localization: {
      zh: {
        country: zhCountry,
        subdivision: zhSubdivision,
        city: zhCity,
      },
    },
  };
}

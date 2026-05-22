/**
 * ip2region xdb v2 reader for Cloudflare Workers (pure ArrayBuffer, no fs).
 *
 * xdb file layout:
 *   [0,       256)          Header (256 bytes)
 *   [256,     256+524288)   Vector index: 256×256×8 bytes
 *   [524544,  EOF)          Segment index entries + data pool
 *
 * Vector index entry at offset  256 + (il0*256+il1)*8:
 *   uint32LE  sPtr  — start of segment entries (absolute file offset)
 *   uint32LE  ePtr  — end   of segment entries (absolute file offset)
 *
 * Each segment index entry is 14 bytes:
 *   uint32LE  start_ip
 *   uint32LE  end_ip
 *   uint16LE  data_len
 *   uint32LE  data_ptr  (absolute file offset into the data pool)
 *
 * ip2region result string format: "国家|区域|省份|城市|ISP"
 * Fields with no data are represented as "0".
 */

import type { ActiveIp2RegionConfig, Env } from './types.ts';

const HEADER_INFO_LENGTH = 256;
const VECTOR_INDEX_COLS = 256;
const VECTOR_INDEX_SIZE = 8;
const SEGMENT_INDEX_SIZE = 14;

function ipToUint32(ip: string): number {
  const parts = ip.split('.');
  return (
    (((parseInt(parts[0], 10) << 24) |
      (parseInt(parts[1], 10) << 16) |
      (parseInt(parts[2], 10) << 8) |
      parseInt(parts[3], 10)) >>>
      0)
  );
}

export class Ip2RegionReader {
  private readonly view: DataView;
  private readonly decoder = new TextDecoder('utf-8');

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
  }

  search(ip: string): string | null {
    const ipInt = ipToUint32(ip);
    const il0 = (ipInt >>> 24) & 0xff;
    const il1 = (ipInt >>> 16) & 0xff;
    const vecOffset = HEADER_INFO_LENGTH + (il0 * VECTOR_INDEX_COLS + il1) * VECTOR_INDEX_SIZE;
    const sPtr = this.view.getUint32(vecOffset, true);
    const ePtr = this.view.getUint32(vecOffset + 4, true);

    let l = 0;
    let h = Math.floor((ePtr - sPtr) / SEGMENT_INDEX_SIZE);

    while (l <= h) {
      const m = (l + h) >> 1;
      const p = sPtr + m * SEGMENT_INDEX_SIZE;
      const startIp = this.view.getUint32(p, true);
      const endIp = this.view.getUint32(p + 4, true);

      if (ipInt < startIp) {
        h = m - 1;
      } else if (ipInt > endIp) {
        l = m + 1;
      } else {
        const dataLen = this.view.getUint16(p + 8, true);
        const dataPtr = this.view.getUint32(p + 10, true);
        const bytes = new Uint8Array(this.view.buffer, dataPtr, dataLen);
        return this.decoder.decode(bytes);
      }
    }

    return null;
  }
}

/**
 * Parse the province field from an ip2region result string.
 * Format: "国家|区域|省份|城市|ISP"
 * Returns null when the province field is absent or "0".
 */
export function parseIp2RegionProvince(result: string): string | null {
  const province = result.split('|')[2]?.trim();
  return province && province !== '0' ? province : null;
}

// In-process reader cache — shared across requests within the same Worker instance.
let ip2regionCache: { objectKey: string; reader: Ip2RegionReader } | null = null;

export async function getIp2RegionReader(
  env: Env,
  config: ActiveIp2RegionConfig,
): Promise<{ reader: Ip2RegionReader; cacheHit: boolean }> {
  if (ip2regionCache && ip2regionCache.objectKey === config.object_key) {
    return { reader: ip2regionCache.reader, cacheHit: true };
  }

  const obj = await env.GEOIP_R2.get(config.object_key);
  if (!obj) throw new Error(`ip2region xdb not found in R2: ${config.object_key}`);

  const buffer = await obj.arrayBuffer();
  const reader = new Ip2RegionReader(buffer);
  ip2regionCache = { objectKey: config.object_key, reader };
  return { reader, cacheHit: false };
}

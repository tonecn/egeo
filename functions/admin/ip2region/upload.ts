import type { PagesFunction } from '@cloudflare/workers-types';
import type { Env, ActiveIp2RegionConfig } from '../../_shared/types.ts';
import { ok, Errors } from '../../_shared/response.ts';
import { setActiveIp2Region } from '../../_shared/config.ts';

const MAX_FILE_SIZE = 64 * 1024 * 1024; // 64 MiB

// POST /admin/ip2region/upload
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Errors.invalidRequest('Expected multipart/form-data');
  }

  const entry = formData.get('file');
  if (!entry || typeof entry === 'string') return Errors.missingParam('file');
  const file = entry as unknown as { name: string; size: number; arrayBuffer(): Promise<ArrayBuffer> };

  if (!file.name.toLowerCase().endsWith('.xdb')) {
    return Errors.invalidRequest('Only .xdb files are accepted');
  }
  if (file.size === 0) return Errors.invalidRequest('File is empty');
  if (file.size > MAX_FILE_SIZE) {
    return Errors.invalidRequest(`File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024} MiB`);
  }

  const objectKey = `ip2region/uploads/${file.name}`;
  const uploadedAt = new Date().toISOString();

  await env.GEOIP_R2.put(objectKey, await file.arrayBuffer(), {
    httpMetadata: { contentType: 'application/octet-stream' },
    customMetadata: { filename: file.name, uploaded_at: uploadedAt },
  });

  const config: ActiveIp2RegionConfig = {
    object_key: objectKey,
    filename: file.name,
    uploaded_at: uploadedAt,
    size: file.size,
  };

  await setActiveIp2Region(env, config);

  return ok(config);
};

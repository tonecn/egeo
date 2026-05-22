import type { PagesFunction } from '@cloudflare/workers-types';
import type { Env, ActiveDbConfig } from '../../_shared/types.ts';
import { ok, Errors } from '../../_shared/response.ts';
import { setActiveDb } from '../../_shared/config.ts';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MiB

// POST /admin/database/upload
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
  // Workers runtime has File, but workers-types types FormData.get() as string|null only
  const file = entry as unknown as { name: string; size: number; arrayBuffer(): Promise<ArrayBuffer> };

  // Validate filename extension and MIME type
  if (!file.name.toLowerCase().endsWith('.mmdb')) {
    return Errors.invalidRequest('Only .mmdb files are accepted');
  }
  if (file.size === 0) return Errors.invalidRequest('File is empty');
  if (file.size > MAX_FILE_SIZE) {
    return Errors.invalidRequest(`File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024} MiB`);
  }

  const objectKey = `db/uploads/${file.name}`;
  const uploadedAt = new Date().toISOString();

  await env.GEOIP_R2.put(objectKey, await file.arrayBuffer(), {
    httpMetadata: { contentType: 'application/octet-stream' },
    customMetadata: { filename: file.name, uploaded_at: uploadedAt },
  });

  const activeDb: ActiveDbConfig = {
    object_key: objectKey,
    filename: file.name,
    uploaded_at: uploadedAt,
    size: file.size,
  };

  await setActiveDb(env, activeDb);

  return ok(activeDb);
};

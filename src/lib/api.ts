import type { ApiResponse, TokenRecord, ActiveDbConfig, ActiveIp2RegionConfig, GeoIpData } from './types.ts';

async function request<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const isFormData = options.body instanceof FormData;
  const res = await fetch(path, {
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  });
  return res.json() as Promise<ApiResponse<T>>;
}

// ── Admin API (no auth param — browser handles Basic Auth automatically) ───

export const adminApi = {
  listTokens() {
    return request<TokenRecord[]>('/admin/tokens');
  },

  createToken(name: string) {
    return request<TokenRecord & { token: string }>('/admin/tokens', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  updateToken(id: string, enabled: boolean) {
    return request<TokenRecord>(`/admin/tokens/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    });
  },

  deleteToken(id: string) {
    return request<{ id: string; deleted: boolean }>(`/admin/tokens/${id}`, {
      method: 'DELETE',
    });
  },

  getDatabase() {
    return request<ActiveDbConfig>('/admin/database');
  },

  uploadDatabase(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return request<ActiveDbConfig>('/admin/database/upload', {
      method: 'POST',
      body: formData,
    });
  },

  getConfig() {
    return request<unknown>('/admin/config');
  },

  getIp2Region() {
    return request<ActiveIp2RegionConfig>('/admin/ip2region');
  },

  uploadIp2Region(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return request<ActiveIp2RegionConfig>('/admin/ip2region/upload', {
      method: 'POST',
      body: formData,
    });
  },
};

// ── GeoIP API (Bearer Token passed explicitly by the user in the tester UI)

export const geoipApi = {
  async query(token: string, ip: string): Promise<ApiResponse<GeoIpData> & { meta?: unknown }> {
    const res = await fetch(`/api/geoip?ip=${encodeURIComponent(ip)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.json();
  },
};

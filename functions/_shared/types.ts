export interface Env {
  APP_KV: KVNamespace;
  GEOIP_R2: R2Bucket;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
}

export interface TokenRecord {
  id: string;
  name: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface TokenMetaRecord extends TokenRecord {
  token_hash: string;
}

export interface ActiveDbConfig {
  object_key: string;
  filename: string;
  uploaded_at: string;
  size: number;
}

export interface ActiveIp2RegionConfig {
  object_key: string;
  filename: string;
  uploaded_at: string;
  size: number;
}

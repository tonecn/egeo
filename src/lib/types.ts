export interface TokenRecord {
  id: string;
  name: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ActiveDbConfig {
  object_key: string;
  filename: string;
  uploaded_at: string;
  size: number;
}

export interface GeoIpData {
  ip: string;
  continent: { code: string | null; name: string | null };
  country: { iso_code: string | null; name: string | null };
  subdivisions: Array<{ iso_code: string | null; name: string | null }>;
  city: { name: string | null };
  location: {
    latitude: number | null;
    longitude: number | null;
    time_zone: string | null;
    accuracy_radius: number | null;
  };
  postal: { code: string | null };
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: { code: string; message: string };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

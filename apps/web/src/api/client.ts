import axios from 'axios';
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './storage';

export const api = axios.create({ baseURL: '/api/v1' });

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  try {
    const { data } = await axios.post('/api/v1/auth/refresh', { refreshToken });
    setTokens(data.accessToken, data.refreshToken);
    return data.accessToken as string;
  } catch {
    clearTokens();
    return null;
  }
}

interface RetriableConfig {
  _retry?: boolean;
  [key: string]: unknown;
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config as RetriableConfig | undefined;
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      refreshing = refreshing ?? doRefresh();
      const token = await refreshing;
      refreshing = null;
      if (token) {
        const cfg = original as unknown as import('axios').InternalAxiosRequestConfig;
        (cfg.headers as Record<string, unknown>)['Authorization'] = `Bearer ${token}`;
        return api.request(cfg);
      }
      window.dispatchEvent(new Event('auth:logout'));
    }
    return Promise.reject(error);
  },
);

// Extract human-friendly error message from an axios error.
export function errorMessage(err: unknown): string {
  const e = err as { response?: { data?: { error?: { message?: string; details?: Array<{ message?: string }> } } }; message?: string };
  return e?.response?.data?.error?.message ?? e?.response?.data?.error?.details?.[0]?.message ?? e?.message ?? 'Something went wrong';
}
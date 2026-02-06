type ApiResponse<T> = {
  success?: boolean;
  data?: T;
  meta?: Record<string, unknown>;
  error?: string;
};

const API_BASE = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api';

async function request<T>(path: string, options?: RequestInit) {
  const headers = new Headers(options?.headers);
  headers.set('Content-Type', 'application/json');

  const token = localStorage.getItem('token');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    headers,
    ...options
  });

  const text = await res.text();
  const payload = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message = payload?.error || `HTTP ${res.status}`;
    throw new Error(message);
  }

  if (payload && typeof payload === 'object' && payload.success === false) {
    throw new Error(payload.error || 'api_error');
  }

  return payload as ApiResponse<T>;
}

export async function apiGet<T>(path: string) {
  const payload = await request<T>(path);
  return {
    data: payload?.data ?? (payload as any),
    meta: payload?.meta || null
  };
}

export async function apiPost<T>(path: string, body?: unknown) {
  const payload = await request<T>(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined
  });
  return {
    data: payload?.data ?? (payload as any),
    meta: payload?.meta || null
  };
}

export async function apiPatch<T>(path: string, body?: unknown) {
  const payload = await request<T>(path, {
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined
  });
  return {
    data: payload?.data ?? (payload as any),
    meta: payload?.meta || null
  };
}

export async function apiDelete<T>(path: string) {
  const payload = await request<T>(path, {
    method: 'DELETE'
  });
  return {
    data: payload?.data ?? (payload as any),
    meta: payload?.meta || null
  };
}

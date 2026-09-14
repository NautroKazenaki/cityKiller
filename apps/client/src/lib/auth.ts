import { SERVER_URL } from './socket';

export interface AuthUser {
  id: string;
  login: string;
  createdAt: string;
}

export interface StoredAuth {
  token: string;
  user: AuthUser;
}

const KEY = 'citykiller-auth';

/**
 * Вход в аккаунт живёт в localStorage: общий для всех вкладок и переживает
 * перезапуск браузера. В отличие от игровой сессии, он не привязан к партии.
 */
export function loadAuth(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredAuth) : null;
  } catch {
    return null;
  }
}

export function saveAuth(auth: StoredAuth): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(auth));
  } catch {
    // приватный режим — останемся гостем
  }
}

export function clearAuth(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // нечего чистить
  }
}

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const res = await fetch(`${SERVER_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error((body as { error?: string }).error ?? 'Сервер недоступен');
    (error as Error & { status?: number }).status = res.status;
    throw error;
  }
  return body as T;
}

export function register(login: string, password: string): Promise<StoredAuth> {
  return request('/auth/register', { method: 'POST', body: JSON.stringify({ login, password }) });
}

export function login(login: string, password: string): Promise<StoredAuth> {
  return request('/auth/login', { method: 'POST', body: JSON.stringify({ login, password }) });
}

export function fetchMe(token: string): Promise<AuthUser> {
  return request('/auth/me', {}, token);
}

export function logout(token: string): Promise<unknown> {
  return request('/auth/logout', { method: 'POST' }, token).catch(() => null);
}

export function fetchProfile<T>(token: string): Promise<T> {
  return request('/profile', {}, token);
}

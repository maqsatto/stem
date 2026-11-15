const rawBase = import.meta.env.VITE_API_URL ?? "/api/v1";
export const API_BASE = rawBase.replace(/\/$/, "");

const ACCESS_KEY = "mlstem.access_token";
const REFRESH_KEY = "mlstem.refresh_token";

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export const tokenStore = {
  get access(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  auth?: boolean;
};

let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccess(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  const refresh = tokenStore.refresh;
  if (!refresh) return false;
  refreshInFlight = (async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (!response.ok) return false;
      const data = (await response.json()) as {
        access_token: string;
        refresh_token: string;
      };
      tokenStore.set(data.access_token, data.refresh_token);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

async function parseError(response: Response): Promise<ApiError> {
  let detail = `Сервер қатесі (${response.status})`;
  let code = "http_error";
  try {
    const data = (await response.json()) as { detail?: string; code?: string };
    detail = data.detail ?? detail;
    code = data.code ?? code;
  } catch {
    // Keep the status-based fallback for non-JSON responses.
  }
  return new ApiError(response.status, code, detail);
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const headers = new Headers(options.headers);
  const isForm = options.body instanceof FormData;
  if (options.body !== undefined && !isForm) {
    headers.set("Content-Type", "application/json");
  }
  if (options.auth !== false) {
    const access = tokenStore.access;
    if (access) headers.set("Authorization", `Bearer ${access}`);
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body:
      options.body === undefined
        ? undefined
        : isForm
          ? (options.body as FormData)
          : JSON.stringify(options.body),
  });
  if (response.status === 401 && options.auth !== false && !path.startsWith("/auth/")) {
    const refreshed = await refreshAccess();
    if (refreshed) {
      const retryHeaders = new Headers(headers);
      const access = tokenStore.access;
      if (access) retryHeaders.set("Authorization", `Bearer ${access}`);
      return fetch(`${API_BASE}${path}`, {
        ...options,
        headers: retryHeaders,
        body:
          options.body === undefined
            ? undefined
            : isForm
              ? (options.body as FormData)
              : JSON.stringify(options.body),
      });
    }
    tokenStore.clear();
    window.dispatchEvent(new Event("mlstem:logout"));
  }
  return response;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(path, options);
  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const http = {
  get: <T>(path: string, options: RequestOptions = {}) =>
    api<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options: RequestOptions = {}) =>
    api<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options: RequestOptions = {}) =>
    api<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options: RequestOptions = {}) =>
    api<T>(path, { ...options, method: "DELETE" }),
  upload: <T>(path: string, file: File, fields: Record<string, string> = {}) => {
    const form = new FormData();
    form.append("file", file);
    Object.entries(fields).forEach(([key, value]) => form.append(key, value));
    return api<T>(path, { method: "POST", body: form });
  },
};

export async function downloadFile(path: string, filename: string): Promise<void> {
  const normalized = path.startsWith("/api/v1/") ? path.slice("/api/v1".length) : path;
  const response = await send(normalized, { method: "GET" });
  if (!response.ok) throw await parseError(response);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Белгісіз қате орын алды.";
}

export function canAccess(role: string | undefined, allowed: string[]): boolean {
  return Boolean(role && allowed.includes(role));
}

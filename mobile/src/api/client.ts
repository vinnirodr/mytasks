import { config } from "@/config";

import { tokenStore } from "./tokenStore";

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, data: unknown) {
    super(`API request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type RequestOptions = {
  method?: Method;
  body?: unknown;
  auth?: boolean;
};

let onUnauthorized: () => void = () => {};

// Single-flight guard: concurrent 401s share one in-flight refresh call
// instead of each firing its own POST /api/auth/token/refresh/.
let refreshPromise: Promise<boolean> | null = null;

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function performFetch(path: string, options: RequestOptions, accessToken: string | null): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (options.auth !== false && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return fetch(`${config.apiBaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

async function refreshTokens(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refresh = await tokenStore.getRefresh();
      if (!refresh) {
        return false;
      }

      try {
        const response = await fetch(`${config.apiBaseUrl}/api/auth/token/refresh/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh }),
        });

        if (!response.ok) {
          return false;
        }

        const data = (await parseJson(response)) as { access?: string; refresh?: string } | null;
        if (!data?.access) {
          return false;
        }

        await tokenStore.setTokens({
          access: data.access,
          refresh: data.refresh ?? refresh,
        });
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const auth = options.auth !== false;
  const accessToken = auth ? await tokenStore.getAccess() : null;

  const response = await performFetch(path, options, accessToken);

  if (response.status === 401 && auth) {
    const refreshed = await refreshTokens();

    if (!refreshed) {
      await tokenStore.clear();
      onUnauthorized();
      const data = await parseJson(response);
      throw new ApiError(401, data);
    }

    const newAccessToken = await tokenStore.getAccess();
    const retryResponse = await performFetch(path, options, newAccessToken);

    if (!retryResponse.ok) {
      const data = await parseJson(retryResponse);
      throw new ApiError(retryResponse.status, data);
    }

    return (await parseJson(retryResponse)) as T;
  }

  if (!response.ok) {
    const data = await parseJson(response);
    throw new ApiError(response.status, data);
  }

  return (await parseJson(response)) as T;
}

function setOnUnauthorized(cb: () => void): void {
  onUnauthorized = cb;
}

export const apiClient = {
  request,
  setOnUnauthorized,
};

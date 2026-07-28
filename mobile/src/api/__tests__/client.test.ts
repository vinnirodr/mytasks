import { apiClient, ApiError } from "../client";
import { tokenStore } from "../tokenStore";

jest.mock("../tokenStore");

const mockGetAccess = tokenStore.getAccess as jest.Mock;
const mockGetRefresh = tokenStore.getRefresh as jest.Mock;
const mockSetTokens = tokenStore.setTokens as jest.Mock;
const mockClear = tokenStore.clear as jest.Mock;

function jsonResponse(status: number, data: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  };
}

describe("apiClient", () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch = jest.fn();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    apiClient.setOnUnauthorized(() => {});
  });

  test("GET attaches Authorization header and returns parsed JSON", async () => {
    mockGetAccess.mockResolvedValue("access-token");
    mockFetch.mockResolvedValueOnce(jsonResponse(200, { id: 1, name: "Task" }));

    const result = await apiClient.request<{ id: number; name: string }>("/api/tasks/1/");

    expect(result).toEqual({ id: 1, name: "Task" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/tasks/1/");
    expect(options.headers.Authorization).toBe("Bearer access-token");
    expect(options.headers["Content-Type"]).toBeUndefined();
  });

  test("request with a body sends Content-Type: application/json", async () => {
    mockGetAccess.mockResolvedValue("access-token");
    mockFetch.mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    await apiClient.request("/api/tasks/", { method: "POST", body: { name: "Task" } });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers["Content-Type"]).toBe("application/json");
  });

  test("401 triggers a single refresh then retries the original request once", async () => {
    mockGetAccess.mockResolvedValue("expired-access");
    mockGetRefresh.mockResolvedValue("refresh-token");
    mockSetTokens.mockResolvedValue(undefined);

    mockFetch
      .mockResolvedValueOnce(jsonResponse(401, { detail: "expired" })) // original call, fails
      .mockResolvedValueOnce(jsonResponse(200, { access: "new-access", refresh: "new-refresh" })) // refresh call
      .mockResolvedValueOnce(jsonResponse(200, { id: 1, name: "Task" })); // retried original call

    const result = await apiClient.request<{ id: number; name: string }>("/api/tasks/1/");

    expect(result).toEqual({ id: 1, name: "Task" });
    expect(mockFetch).toHaveBeenCalledTimes(3);

    const refreshCall = mockFetch.mock.calls[1];
    expect(refreshCall[0]).toContain("/api/auth/token/refresh/");
    expect(JSON.parse(refreshCall[1].body)).toEqual({ refresh: "refresh-token" });

    const originalCalls = mockFetch.mock.calls.filter((call) => call[0].includes("/api/tasks/1/"));
    expect(originalCalls).toHaveLength(2);

    expect(mockSetTokens).toHaveBeenCalledWith({ access: "new-access", refresh: "new-refresh" });
  });

  test("concurrent 401s share a single refresh call (single-flight)", async () => {
    mockGetAccess.mockResolvedValue("expired-access");
    mockGetRefresh.mockResolvedValue("refresh-token");
    mockSetTokens.mockResolvedValue(undefined);

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/auth/token/refresh/")) {
        return Promise.resolve(jsonResponse(200, { access: "new-access", refresh: "new-refresh" }));
      }
      if (url.includes("/api/tasks/1/")) {
        const calls = mockFetch.mock.calls.filter((c: unknown[]) => (c[0] as string).includes("/api/tasks/1/"));
        return Promise.resolve(calls.length <= 1 ? jsonResponse(401, {}) : jsonResponse(200, { id: 1 }));
      }
      if (url.includes("/api/tasks/2/")) {
        const calls = mockFetch.mock.calls.filter((c: unknown[]) => (c[0] as string).includes("/api/tasks/2/"));
        return Promise.resolve(calls.length <= 1 ? jsonResponse(401, {}) : jsonResponse(200, { id: 2 }));
      }
      return Promise.resolve(jsonResponse(404, {}));
    });

    const [r1, r2] = await Promise.all([
      apiClient.request<{ id: number }>("/api/tasks/1/"),
      apiClient.request<{ id: number }>("/api/tasks/2/"),
    ]);

    expect(r1).toEqual({ id: 1 });
    expect(r2).toEqual({ id: 2 });

    const refreshCalls = mockFetch.mock.calls.filter((call) => call[0].includes("/api/auth/token/refresh/"));
    expect(refreshCalls).toHaveLength(1);
  });

  test("401 with a failing refresh clears tokens, calls onUnauthorized, and throws ApiError", async () => {
    const onUnauthorized = jest.fn();
    apiClient.setOnUnauthorized(onUnauthorized);

    mockGetAccess.mockResolvedValue("expired-access");
    mockGetRefresh.mockResolvedValue("refresh-token");
    mockClear.mockResolvedValue(undefined);

    mockFetch
      .mockResolvedValueOnce(jsonResponse(401, { detail: "expired" })) // original call, fails
      .mockResolvedValueOnce(jsonResponse(401, { detail: "invalid refresh" })); // refresh call, fails

    await expect(apiClient.request("/api/tasks/1/")).rejects.toThrow(ApiError);

    expect(mockClear).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  test("401 with no refresh token clears tokens, calls onUnauthorized, and throws without calling refresh endpoint", async () => {
    const onUnauthorized = jest.fn();
    apiClient.setOnUnauthorized(onUnauthorized);

    mockGetAccess.mockResolvedValue("expired-access");
    mockGetRefresh.mockResolvedValue(null);
    mockClear.mockResolvedValue(undefined);

    mockFetch.mockResolvedValueOnce(jsonResponse(401, { detail: "expired" }));

    await expect(apiClient.request("/api/tasks/1/")).rejects.toThrow(ApiError);

    expect(mockClear).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test("401 on the post-refresh retry clears tokens, calls onUnauthorized, and throws ApiError", async () => {
    const onUnauthorized = jest.fn();
    apiClient.setOnUnauthorized(onUnauthorized);

    mockGetAccess.mockResolvedValue("expired-access");
    mockGetRefresh.mockResolvedValue("refresh-token");
    mockSetTokens.mockResolvedValue(undefined);
    mockClear.mockResolvedValue(undefined);

    mockFetch
      .mockResolvedValueOnce(jsonResponse(401, { detail: "expired" })) // original call, fails
      .mockResolvedValueOnce(jsonResponse(200, { access: "new-access", refresh: "new-refresh" })) // refresh call succeeds
      .mockResolvedValueOnce(jsonResponse(401, { detail: "still expired" })); // retried original call, still 401

    await expect(apiClient.request("/api/tasks/1/")).rejects.toMatchObject({
      status: 401,
    });

    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(mockClear).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  test("non-2xx (non-401) response throws ApiError with status and data", async () => {
    mockGetAccess.mockResolvedValue("access-token");
    mockFetch.mockResolvedValue(jsonResponse(500, { detail: "server error" }));

    await expect(apiClient.request("/api/tasks/1/")).rejects.toMatchObject({
      status: 500,
      data: { detail: "server error" },
    });
  });

  test("request without auth does not attach Authorization header even if a token exists", async () => {
    mockGetAccess.mockResolvedValue("access-token");
    mockFetch.mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    await apiClient.request("/api/public/", { auth: false });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers.Authorization).toBeUndefined();
  });
});

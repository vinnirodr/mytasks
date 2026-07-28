/**
 * Converts an HTTP(S) API base URL into its WebSocket equivalent.
 * `http://` becomes `ws://` and `https://` becomes `wss://`; the rest of the
 * URL is left intact, and any trailing slash is stripped.
 */
export function wsUrlFromApi(apiUrl: string): string {
  const withoutTrailingSlash = apiUrl.replace(/\/+$/, "");
  return withoutTrailingSlash.replace(/^http/, "ws");
}

const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

export const config = {
  apiBaseUrl,
  wsBaseUrl: wsUrlFromApi(apiBaseUrl),
};

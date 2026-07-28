# Mobile 6b — API/WS Client + Auth + Auth Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. UI verification is visual (Expo Web — no iOS simulator on this machine) + `npx tsc --noEmit` + jest with **mocks** (fetch, WebSocket, secure-store are all mocked; NO running backend needed). Steps use `- [ ]`.

**Goal:** Build the network + auth foundation of "Organizados" and the entry screens (splash, login, register): a typed API client with JWT + automatic refresh, secure token storage, an auth session context, a WebSocket client (subprotocol auth), a route guard, and the three auth screens built on the 6a design system.

**Architecture:** A small typed `apiClient` (fetch wrapper) reads a config base URL (`EXPO_PUBLIC_API_URL`, graceful default), attaches `Authorization: Bearer <access>`, and on a 401 transparently refreshes via `POST /api/auth/token/refresh/` and retries once (clearing the session if refresh fails). Tokens live in `expo-secure-store`. An `AuthProvider` (React Context) restores the session on launch, exposes `signIn`/`register`/`signOut`/`status`, and drives an expo-router route guard: unauthenticated → `(auth)` screens, authenticated → `(app)` tabs. A `createEnvironmentSocket` opens the Plan-4 WebSocket with subprotocols `["jwt", token]` (consumers land in 6d). Everything is unit-tested with mocked fetch/WebSocket/secure-store — no backend required.

**Tech Stack:** Expo SDK 57, React Native 0.86, TypeScript, expo-router, expo-secure-store, the 6a design system. Server state library (React Query) is deferred to 6d.

## Global Constraints

- Build on the 6a primitives in `mobile/src/` (`theme/useTheme`, `components/*`, `components/brand/*`). Screens reproduce the handoff (`docs/design/handoff/README.md`, screens 1/5/6) — theme-aware, day + night.
- **Graceful integration:** the API base URL comes from `process.env.EXPO_PUBLIC_API_URL` with a default of `http://localhost:8000`; the WS URL derives from it (`http`→`ws`, `https`→`wss`). No hard failure if unset (dev default). No secrets in the client.
- **Do not trust memory for Expo/RN APIs** — check installed `.d.ts` (expo-secure-store, expo-router). `npx tsc --noEmit` (from `mobile/`) must pass at the end of every task; `npm test` must pass. Never commit `.expo/`.
- Tokens: access + refresh from Plan 1 (`POST /api/auth/token/` → `{access, refresh}`; refresh via `POST /api/auth/token/refresh/` → `{access}`). Store both in `expo-secure-store`. The username field is **email**.
- All tests mock the network (`global.fetch`), `WebSocket`, and `expo-secure-store` — no real backend, no real device storage.
- Commit bodies end with a blank line then `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Work in `mobile/`.

---

### Task 1: Deps + config

**Files:** Create `mobile/src/config.ts`, `mobile/.env.example`; modify `mobile/package.json` (expo-secure-store).

**Interfaces:** Produces `config` — `{ apiBaseUrl: string, wsBaseUrl: string }`. `apiBaseUrl` = `process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000"`; `wsBaseUrl` = the same with `http`→`ws`/`https`→`wss`.

- [ ] **Step 1: Install** `cd mobile && npx expo install expo-secure-store`.
- [ ] **Step 2: Create `src/config.ts`** exporting `config` and a `wsUrlFromApi(apiUrl)` helper (pure, exported for a unit test).
- [ ] **Step 3: Create `.env.example`** with `EXPO_PUBLIC_API_URL=http://localhost:8000` and a comment.
- [ ] **Step 4: Test** `src/__tests__/config.test.ts` — `wsUrlFromApi("http://localhost:8000") === "ws://localhost:8000"` and `https`→`wss`.
- [ ] **Step 5:** `npm test -- config` + `npx tsc --noEmit` clean. **Commit** `chore(mobile): api/ws config + expo-secure-store`.

---

### Task 2: Secure token storage

**Files:** Create `mobile/src/api/tokenStore.ts`, `mobile/src/api/__tests__/tokenStore.test.ts`.

**Interfaces:** `tokenStore` with async `getAccess()`, `getRefresh()`, `setTokens({access, refresh})`, `clear()`. Backed by `expo-secure-store` (`setItemAsync`/`getItemAsync`/`deleteItemAsync`) under keys `org.access` / `org.refresh`.

- [ ] **Step 1: Write the failing test** — mock `expo-secure-store` (jest.mock); assert `setTokens` writes both keys, `getAccess`/`getRefresh` read them, `clear` deletes both.
- [ ] **Step 2: Run → fail. Step 3: Implement `tokenStore.ts`.**
- [ ] **Step 4:** `npm test -- tokenStore` + tsc clean. **Commit** `feat(mobile): secure token storage`.

---

### Task 3: API client with auto-refresh

**Files:** Create `mobile/src/api/client.ts`, `mobile/src/api/__tests__/client.test.ts`.

**Interfaces:**
- `apiClient.request<T>(path, { method?, body?, auth? })` → parsed JSON `T`; throws `ApiError { status, data }` on non-2xx.
- Attaches `Authorization: Bearer <access>` when `auth !== false` and an access token exists.
- On a **401** for an authed request: calls `tokenStore.getRefresh()`, `POST /api/auth/token/refresh/` → new access, `tokenStore.setTokens`, and retries the original request **once**. If refresh is missing or also fails → `tokenStore.clear()` and rethrow (an `onUnauthorized` callback, settable via `apiClient.setOnUnauthorized`, lets AuthProvider react).
- Uses `config.apiBaseUrl`. All network via `global.fetch` (mockable).

- [ ] **Step 1: Write failing tests** (mock `global.fetch` + `tokenStore`): (a) a GET attaches the bearer header and returns parsed JSON; (b) a 401 triggers a refresh call then a retry that succeeds; (c) a 401 with a failing refresh clears tokens, calls `onUnauthorized`, and throws.
- [ ] **Step 2: Run → fail. Step 3: Implement `client.ts`** with a single-flight refresh (don't fire N concurrent refreshes; a simple in-module `refreshPromise` guard).
- [ ] **Step 4:** `npm test -- client` + tsc clean. **Commit** `feat(mobile): API client with JWT auto-refresh`.

---

### Task 4: Auth API

**Files:** Create `mobile/src/api/auth.ts`, `mobile/src/api/__tests__/auth.test.ts`.

**Interfaces:** `authApi` with `register({email, password, displayName})` → user, `login({email, password})` → `{access, refresh}`, `me()` → `{id, email, displayName}`, `refresh(refreshToken)` → `{access}`. Maps `displayName`↔`display_name`. Uses `apiClient`.

- [ ] **Step 1: Write failing tests** (mock `apiClient.request`): each function calls the right path/method/body and maps snake_case↔camelCase.
- [ ] **Step 2: Run → fail. Step 3: Implement `auth.ts`.**
- [ ] **Step 4:** `npm test -- auth` + tsc clean. **Commit** `feat(mobile): auth API (register/login/me/refresh)`.

---

### Task 5: Auth session context

**Files:** Create `mobile/src/auth/AuthProvider.tsx`, `mobile/src/auth/useAuth.ts`, `mobile/src/auth/__tests__/AuthProvider.test.tsx`; wrap the app in `mobile/src/app/_layout.tsx`.

**Interfaces:**
- `AuthProvider` — on mount: read `tokenStore.getAccess()`; if present, call `authApi.me()` to validate → `status: "signedIn"` + `user`; else `status: "signedOut"`. Exposes `{ status: "loading" | "signedOut" | "signedIn", user, signIn(email,password), register(email,password,displayName), signOut() }`. `signIn` calls `authApi.login`, stores tokens, `me()`, sets user. `register` calls `authApi.register` then `signIn`. `signOut` clears tokens + resets. Registers `apiClient.setOnUnauthorized(() => signOut())`.
- `useAuth()` — returns the context; throws outside the provider.

- [ ] **Step 1: Write failing tests** (mock `authApi` + `tokenStore`): starts `loading` then resolves `signedOut` with no token; `signIn` transitions to `signedIn` with the user; `signOut` returns to `signedOut` and clears tokens.
- [ ] **Step 2: Run → fail. Step 3: Implement provider + hook**, wrap the tree (inside the existing ThemeProvider + font gate).
- [ ] **Step 4:** `npm test -- AuthProvider` + tsc clean. **Commit** `feat(mobile): auth session provider`.

---

### Task 6: WebSocket client (subprotocol auth)

**Files:** Create `mobile/src/api/socket.ts`, `mobile/src/api/__tests__/socket.test.ts`.

**Interfaces:** `createEnvironmentSocket(envId, accessToken, handlers)` where `handlers = { onMessage(data), onOpen?, onClose? }`. Opens `new WebSocket(\`${config.wsBaseUrl}/ws/environments/${envId}/\`, ["jwt", accessToken])`. Parses incoming JSON to `onMessage`. Returns `{ close() }`. Includes a simple reconnect-with-backoff (capped) unless `close()` was called intentionally. (Consumers: 6d.)

- [ ] **Step 1: Write failing tests** — mock `global.WebSocket` with a fake class capturing the url + `protocols` arg; assert the subprotocols are `["jwt", "<token>"]`, the url targets `/ws/environments/<id>/`, and an incoming message string is JSON-parsed into `onMessage`.
- [ ] **Step 2: Run → fail. Step 3: Implement `socket.ts`** (guard reconnect so a manual `close()` stops it; keep backoff simple).
- [ ] **Step 4:** `npm test -- socket` + tsc clean. **Commit** `feat(mobile): environment WebSocket client (subprotocol JWT)`.

---

### Task 7: Route guard + route groups + Splash

**Files:** Restructure `mobile/src/app/` into `(auth)/` and `(app)/` groups; create `mobile/src/app/(auth)/_layout.tsx`, `mobile/src/app/(app)/_layout.tsx`, and a splash at the root; move the existing tabs under `(app)`. Modify the root `_layout.tsx`.

**Interfaces:** The root layout renders a **guard**: while `status === "loading"` show the Splash (brand `OrgSymbol animated` on `forest` (day)/`bg` (night), wordmark 34, "A CASA EM DIA" mono at the bottom — handoff screen 1); when `signedOut` render/redirect to `(auth)`; when `signedIn` render `(app)`. Use expo-router `Redirect` or conditional `Stack`/group rendering driven by `useAuth().status`. The existing `ds-gallery` route stays reachable in dev.

- [ ] **Step 1:** Create the group layouts and move the current tab routes (`index`, `explore`, `ds-gallery`) under `(app)`. Build the `Splash` component/screen.
- [ ] **Step 2:** In the root `_layout.tsx`, gate on `useAuth().status`: `loading` → Splash; `signedOut` → `<Redirect href="/(auth)/login" />` (or render the auth stack); `signedIn` → the `(app)` tree.
- [ ] **Step 3:** `npx tsc --noEmit` clean; `npm test` green. Verify the route tree builds (no expo-router route errors in Metro).
- [ ] **Step 4: Commit** `feat(mobile): auth route guard, route groups, splash`.

---

### Task 8: Login + Register screens

**Files:** Create `mobile/src/app/(auth)/login.tsx`, `mobile/src/app/(auth)/register.tsx`; tests in `mobile/src/app/(auth)/__tests__/`.

**Interfaces:**
- **Login** (handoff screen 5): `Wordmark`, `Display` headline "A casa, em dia.", `TextField` email + password (mono labels), primary `Button` "Entrar" (calls `useAuth().signIn`, shows inline error on failure, disables while pending), "Esqueci minha senha" (stub link), footer "Não tem conta? Criar conta" → `/(auth)/register`.
- **Register** (handoff screen 6): back button, `TextField` Nome / E-mail / Senha (password with the 3-bar strength meter from `TextField`'s `strength` prop, computed simply from length/variety), a terms checkbox, tangerine `Button` "Criar conta" (calls `useAuth().register`), footer link back to login.

- [ ] **Step 1: Write failing tests** (render inside a mocked `AuthProvider` value): filling email+password and pressing "Entrar" calls `signIn` with those values; a rejected `signIn` shows an error message; on Register, pressing "Criar conta" calls `register` with name/email/password.
- [ ] **Step 2: Run → fail. Step 3: Implement both screens** using 6a components, theme-aware, matching the handoff layout (margins 24 on auth screens, field/label/button specs).
- [ ] **Step 4:** `npm test -- login` and `-- register` + tsc clean. **Commit** `feat(mobile): login and register screens`.

---

### Task 9: Web verification + wrap

**Files:** none (verification); update `mobile/README` if useful.

- [ ] **Step 1:** `cd mobile && npx tsc --noEmit` clean; `npm test` all green (report count).
- [ ] **Step 2: Web verification (controller step, or run the server):** `BROWSER=none npx expo start --web --port 8081`; open the app — with no stored token it should land on **Login**; screenshot it (light + dark via the OS/toggle). Navigate to Register; screenshot. Confirm the screens match the handoff (wordmark, headline, fields, buttons) and that a failed login shows an error (mock or hit a local backend if running). Note deviations.
- [ ] **Step 3: Commit** any small fixes; final `feat(mobile): auth flow web-verified`.

---

## Self-Review

**Coverage:** config (T1), secure storage (T2), API client + refresh (T3), auth API (T4), session provider (T5), WS client (T6), route guard + splash (T7), login/register screens (T8), web verify (T9). This is the network+auth spine; 6c–6f build the remaining screens on it.

**Guardrails:** graceful API base URL (env var + default); mocks everywhere (no backend needed for tests); theme-aware screens; check installed `.d.ts` for expo-secure-store/expo-router; tsc + jest as automated gates; iOS-pixel QA still deferred (no Xcode) — web is the verification surface.

**Deferred:** React Query (server-state caching) → 6d; real backend integration test → when the local Django server is run; forgot-password flow (stub link now); the invite-preview endpoint + accept-invite screen → 6c.

## Execution Handoff

Sub-plan **6b of Plan 6**. Next: **6c** — onboarding (3 screens) + accept-invite (requires a small backend `GET` invite-preview-by-token endpoint) + join-by-code. Then 6d (daily board + live WS), 6e (agenda + create), 6f (environments/members/profile/bell + push registration).

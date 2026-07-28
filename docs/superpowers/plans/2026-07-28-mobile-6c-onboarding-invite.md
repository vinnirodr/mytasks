# Mobile 6c — Onboarding + Accept-Invite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. T1 is backend (Django, real pytest against Postgres). T2–T7 are mobile: `npx tsc --noEmit` + jest (mocked fetch/storage) as gates; visual verification via **Expo Web** (no iOS simulator on this Intel Mac — no Xcode). Steps use `- [ ]`.

**Goal:** Add first-run onboarding (3 screens) and the invite-acceptance flow to "Organizados": a small backend invite-preview endpoint, a mobile invites API, onboarding with first-run persistence, the accept-invite screen (deep-linked by token + a manual "join by code" entry), and the auth-then-accept flow.

**Architecture:** A public `GET /api/invitations/<token>/preview/` returns the environment name + member avatars for an invite (the token is the secret; the invitee may not be authenticated yet). The mobile `invitesApi` wraps preview + accept. Onboarding shows once (persisted flag in AsyncStorage) then routes to login; the auth guard consults `onboardingSeen`. A dynamic route `(auth)/invite/[token]` renders the accept-invite card from the preview; accepting requires auth, so an unauthenticated user is routed through login/register carrying the token, then the accept fires. A "join by code" screen lets the user paste a token manually.

**Tech Stack:** Backend: Django 6 / DRF (Plan 1–5). Mobile: Expo SDK 57, expo-router (dynamic routes + linking), @react-native-async-storage/async-storage, the 6a/6b foundations.

## Global Constraints

- Backend: reuse `Invitation`/`Environment`/`Membership` (Plans 1–2). The preview endpoint is **AllowAny** (token-gated, no auth) since the invitee isn't logged in yet; it exposes only the environment name/type + member display names/initials + inviter name + status. Invalid/unknown token → 404. Backend work follows the Plan-1..5 conventions (UUID, `/api/`, pytest against Postgres, ruff, pristine). Run from `backend/` with its venv.
- Mobile: build on 6a components + 6b (`apiClient`, `useAuth`, route groups `(auth)`/`(app)`). Reproduce handoff screens 2–4 (onboarding), 7 (accept-invite), and the "Inserir código" entry. Theme-aware, day + night. `npx tsc --noEmit` + `npm test` green each task. Never commit `.expo/`. Installs may need `-- --legacy-peer-deps`.
- Deep-linking scheme: use the app scheme already in `mobile/app.json` (add a scheme if missing, e.g. `organizados`); the route `(auth)/invite/[token]` also works via `http://localhost:8081/invite/<token>` on web for verification.
- Commit bodies end with a blank line then `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: Backend — invite-preview endpoint

**Files:** Modify `backend/environments/views.py`, `backend/environments/urls.py`, `backend/environments/serializers.py`; test `backend/environments/tests/test_invitation_preview_api.py`. Run from `backend/` (`. .venv/bin/activate`).

**Interfaces:** `GET /api/invitations/<uuid:token>/preview/` — AllowAny → 200 `{environment_name, env_type, member_count, members: [{display_name, initials}], invited_by_name, status, email}`. Unknown token → 404.

- [ ] **Step 1: Write the failing test** `test_invitation_preview_api.py`:
```python
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from environments.models import Environment, Invitation, Membership

User = get_user_model()


@pytest.mark.django_db
def test_preview_returns_environment_and_members():
    ana = User.objects.create_user(email="ana@example.com", password="x", display_name="Ana")
    bob = User.objects.create_user(email="bob@example.com", password="x", display_name="Bob")
    env = Environment.create_with_admin(name="Casa da Ana", env_type="HOUSE", owner=ana)
    Membership.objects.create(environment=env, user=bob, role="MEMBER")
    inv = Invitation.objects.create(environment=env, email="carol@example.com", invited_by=ana)
    resp = APIClient().get(f"/api/invitations/{inv.token}/preview/")
    assert resp.status_code == 200
    assert resp.data["environment_name"] == "Casa da Ana"
    assert resp.data["member_count"] == 2
    assert resp.data["invited_by_name"] == "Ana"
    assert resp.data["email"] == "carol@example.com"
    assert {"display_name": "Bob", "initials": "BO"} in resp.data["members"]


@pytest.mark.django_db
def test_preview_unknown_token_404():
    resp = APIClient().get("/api/invitations/00000000-0000-0000-0000-000000000000/preview/")
    assert resp.status_code == 404


@pytest.mark.django_db
def test_preview_is_public_no_auth_required():
    ana = User.objects.create_user(email="ana@example.com", password="x", display_name="Ana")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    inv = Invitation.objects.create(environment=env, email="c@example.com", invited_by=ana)
    resp = APIClient().get(f"/api/invitations/{inv.token}/preview/")
    assert resp.status_code == 200  # no Authorization header
```

- [ ] **Step 2: Run → fail.** `cd backend && pytest environments/tests/test_invitation_preview_api.py -v`.

- [ ] **Step 3: Implement.** Add `InvitationPreviewView(APIView)` with `permission_classes = [AllowAny]`: `get_object_or_404(Invitation, token=token)`, build the payload — `environment.name`, `environment.env_type`, `environment.memberships.count()`, a list of `{display_name, initials}` for active members (initials = first two letters of display_name or email, upper), `invitation.invited_by.display_name or email`, `invitation.status`, `invitation.email`. Add the route `path("invitations/<uuid:token>/preview/", InvitationPreviewView.as_view(), name="invitation-preview")` to `environments/urls.py`. (A small `initials(name)` helper; put it in the view or serializers.)

- [ ] **Step 4: Run → pass.** Then `pytest -q` (full backend suite still green) + `ruff check .` clean.

- [ ] **Step 5: Commit** (from repo root) `feat: public invitation-preview endpoint`.

---

### Task 2: Mobile — invites API

**Files:** Create `mobile/src/api/invites.ts`, `mobile/src/api/__tests__/invites.test.ts`.

**Interfaces:** `invitesApi.preview(token)` → GET `/api/invitations/${token}/preview/` (auth:false) → `{environmentName, envType, memberCount, members:[{displayName, initials}], invitedByName, status, email}` (map snake→camel). `invitesApi.accept(token)` → POST `/api/invitations/accept/` body `{token}` (authed) → `{environmentId, role}`.

- [ ] **Step 1: Write failing tests** (mock `apiClient.request`): `preview` calls the right path with `auth:false` and maps fields; `accept` POSTs `/api/invitations/accept/` with `{token}` authed and maps `environment_id`→`environmentId`.
- [ ] **Step 2: Run → fail. Step 3: Implement `invites.ts`.**
- [ ] **Step 4:** `npm test -- invites` + tsc clean. **Commit** `feat(mobile): invites API (preview/accept)`.

---

### Task 3: Onboarding persistence + prefs store

**Files:** Create `mobile/src/prefs/prefsStore.ts`, `mobile/src/prefs/__tests__/prefsStore.test.ts`; modify `package.json` (async-storage).

**Interfaces:** `prefsStore` with `getOnboardingSeen(): Promise<boolean>`, `setOnboardingSeen(): Promise<void>`, backed by `@react-native-async-storage/async-storage` under key `org.onboardingSeen`. (AsyncStorage has web support.)

- [ ] **Step 1: Install** `cd mobile && npx expo install @react-native-async-storage/async-storage` (add `-- --legacy-peer-deps` if the peer conflict blocks it).
- [ ] **Step 2: Write failing test** (mock async-storage): `setOnboardingSeen` writes `"1"`, `getOnboardingSeen` returns true after set / false when unset.
- [ ] **Step 3: Implement. Step 4:** `npm test -- prefsStore` + tsc clean. **Commit** `feat(mobile): prefs store (onboarding-seen)`.

---

### Task 4: Onboarding screens

**Files:** Create `mobile/src/app/(auth)/onboarding.tsx` (a 3-page pager); tests in `mobile/src/app/(auth)/__tests__/onboarding.test.tsx`. Modify the root guard so first-run (signedOut + not onboardingSeen) shows onboarding before login.

**Interfaces:** A horizontally-paged onboarding (handoff screens 2–4): logo top-left + "Pular" (→ marks seen + go to login). Each page: a composed hero using real UI fragments (per handoff), a display title + body, dot indicators (active = 24×7 pill, inactive 7×7), and a next button (pages 1–2 "Continuar" tangerine; page 3 "Começar" → marks seen + go to login). Uses a `ScrollView` with `pagingEnabled` (or `FlatList` horizontal); track the active index.

- [ ] **Step 1:** Extend the guard: `useAuth().status === "signedOut"` → check `prefsStore.getOnboardingSeen()`; if not seen, render/redirect to `(auth)/onboarding`, else login. (Keep it simple: a small hook `useOnboardingSeen()` returning `loading|seen|unseen`; the guard shows a Splash while loading.)
- [ ] **Step 2: Write failing tests** — the pager renders 3 pages; pressing "Pular" calls `prefsStore.setOnboardingSeen` and navigates to login; on the last page the CTA reads "Começar" and does the same. Mock router + prefsStore.
- [ ] **Step 3: Implement** the pager + guard wiring. **Step 4:** `npm test -- onboarding` + tsc clean. **Commit** `feat(mobile): first-run onboarding`.

---

### Task 5: Accept-invite screen + deep-link route

**Files:** Create `mobile/src/app/(auth)/invite/[token].tsx` and an authed variant reachable when signed in (or one screen that branches on auth); tests in `__tests__`. Ensure `mobile/app.json` has a `scheme`.

**Interfaces:** Route `(auth)/invite/[token]` reads `token` from the route params, calls `invitesApi.preview(token)` (loading/error states), and renders the handoff screen 7 card: forest card, mail icon in a butter circle, display title, environment name emphasized, `AvatarStack` from `members`, buttons "Aceitar convite" (tangerine) / "Agora não". On "Aceitar convite": if `useAuth().status === "signedIn"` → `invitesApi.accept(token)` then navigate into `(app)`; if `signedOut` → navigate to register/login passing the token (a query/param), and after successful auth call accept and enter the app. On "Agora não" → go to login (or app if signed in). Footer shows the invite `email`.

- [ ] **Step 1: Write failing tests** (mock `invitesApi` + `useAuth` + router): renders the previewed environment name + members; "Aceitar convite" while signedIn calls `invitesApi.accept(token)`; while signedOut routes to auth carrying the token. Handle a preview 404 (invalid invite) with an error state.
- [ ] **Step 2: Implement** the screen + the auth-carry mechanism (e.g. a `pendingInviteToken` in a small module/context or a router param that login/register read and, on success, accept). Add a `scheme` to `app.json` if missing.
- [ ] **Step 3:** `npm test -- invite` + tsc clean. **Commit** `feat(mobile): accept-invite screen + deep-link route`.

---

### Task 6: Join by code

**Files:** Create `mobile/src/app/(auth)/join.tsx`; test in `__tests__`. Link to it from the login footer ("Recebeu um convite? Inserir código").

**Interfaces:** A screen with a `TextField` for the invite code/token + a primary button "Continuar" that navigates to `(auth)/invite/<entered-token>`. Basic validation (non-empty). Reachable from login's footer link.

- [ ] **Step 1: Write failing test** — entering a token and pressing Continuar navigates to `/invite/<token>`; empty → disabled/no-nav.
- [ ] **Step 2: Implement + add the login footer link. Step 3:** `npm test -- join` + tsc clean. **Commit** `feat(mobile): join-by-code screen`.

---

### Task 7: Web verification + wrap

- [ ] **Step 1:** `cd mobile && npx tsc --noEmit` clean; `npm test` all green (report count). `cd backend && pytest -q` still green.
- [ ] **Step 2: Web verification (controller):** `BROWSER=none npx expo start --web --port 8081`; verify: first run shows **onboarding** (swipe the 3 pages, "Pular" → login); reset the onboarding flag (or clear localStorage) to re-check; open `http://localhost:8081/invite/<a-real-or-mocked-token>` and confirm the accept-invite card renders (with a running local backend + a real invite, or a mocked preview). Screenshot onboarding + accept-invite (light + dark). Note deviations.
- [ ] **Step 3: Commit** any fixes; final `feat(mobile): onboarding + invite flow web-verified`.

---

## Self-Review

**Coverage:** backend invite-preview (T1), mobile invites API (T2), onboarding persistence (T3) + screens (T4), accept-invite + deep-link (T5), join-by-code (T6), web verify (T7). Matches the handoff onboarding (2–4), accept-invite (7), and "Inserir código".

**Guardrails:** preview endpoint AllowAny is token-gated (no PII beyond names/initials the inviter already shares); mobile installs may need `--legacy-peer-deps`; theme-aware; tsc+jest gates; iOS-pixel QA still deferred (no Xcode) — web is the surface; async-storage for the non-sensitive onboarding flag.

**Deferred:** the auth-then-accept "carry token" mechanism is minimal (router param / small module) — a fuller pending-action queue can come later; real end-to-end invite test needs the local Django server running; email SENDING of invites (backend gap noted in stack-lessons) is separate.

## Execution Handoff

Sub-plan **6c of Plan 6**. Next: **6d** — the daily board (hero progress, task cards, complete/defer/pickup) with live WebSocket updates (consumes the 6b socket), then 6e (agenda + create) and 6f (environments/members/profile/bell + push registration).

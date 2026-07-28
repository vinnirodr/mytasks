# Organizados — Project Status & Resume

**Last updated:** 2026-07-28 · **One-liner:** Backend MVP is 100% done and merged; the Expo app (Plan 6) is ~half built — 6a (design system) and 6b (API/auth) merged, 6c (onboarding + invite) in review as PR #8; **6d (daily board + live WS) is next**.

> New session? Read this + the auto-loaded memory. To continue: **merge the open PR, then start the next slice's plan** (see "Next").

## Roadmap (MVP = 6 plans; Plan 6 decomposed into 6a–6f)

| Plan | Scope | Status |
|---|---|---|
| 1 | Backend foundations (accounts/JWT, environments, memberships, invites) | ✅ merged |
| 2 | Recurring agenda + occurrences (catalog, materialization, exceptions, one-off) | ✅ merged |
| 3 | Daily board + status lifecycle (timezone-aware transitions, complete/pickup/postpone) | ✅ merged |
| 4 | Live layer (Channels WS + `ActivityEvent` bell/feed, broadcasts) | ✅ merged |
| 5 | Push reminders (Celery + Beat + Expo; schedules the maintenance commands) | ✅ merged |
| **6a** | Mobile design-system foundation (fonts, day/night tokens, theme, brand, components) | ✅ merged |
| **6b** | Mobile API/WS client + JWT/secure-store + auth screens (splash/login/register) | ✅ merged |
| **6c** | Mobile onboarding + accept-invite (+ backend invite-preview endpoint) | 🔵 **PR #8 open** |
| **6d** | Daily board + task detail + complete/defer/pickup + **live WebSocket** | ⬜ **NEXT** |
| **6e** | Agenda (week view) + new-task (recurring, 2-step) + create-environment | ⬜ pending |
| **6f** | Environments/members/profile/bell screens + Expo push-token registration | ⬜ pending |

PRs: #1 foundations · #2 agenda/occurrences · #3 daily board · #4 live layer · #5 push · #6 mobile 6a · #7 mobile 6b · #8 mobile 6c (open). Repo: `github.com/vinnirodr/mytasks`.

## Plan 6 kickoff decisions (from the designer's handoff)

- Product name is **"Organizados"** (short `Orgs`). Brand = split "O" (forest-green + tangerine halves), Bricolage Grotesque wordmark, pure-SVG symbol.
- The Expo app lives in **`mobile/`** in this repo (monorepo).
- Design asks for 3 things the backend intentionally lacks: **presence dot** + **streak/on-time% stats** → built as neutral/hidden placeholders (wire when future slices land); **accept-invite preview** → added a small public backend endpoint (done in 6c).
- Verification: subagents + **Expo Web** visual check (no Xcode on this Intel Mac → no iOS simulator; web ≈ iOS, not pixel-identical). iOS-pixel QA + push testing need the user's Xcode/device.
- Full design spec of tokens + all 18 screens: `docs/design/handoff/README.md` (+ `prototipo.html`).

## What's next (6d)

Merge PR #8 (6c) → branch `feat/mobile-daily-board` off master → write `docs/superpowers/plans/…-mobile-6d-daily-board.md` and execute. 6d builds the **daily board** (hero progress fraction + ring, task cards, "Nova tarefa" FAB, section headers Atrasadas/Hoje, POSTPONED-last), the **task detail** screen, the **complete/defer/pickup** actions (hit the backend endpoints), and **live updates via WebSocket** (consume the 6b `createEnvironmentSocket`, subprotocol `["jwt", token]`, listening for `board_update`/`activity`). The board also drives the bottom-tab "Hoje". The app currently talks to the backend only through **mocked** tests — 6d is a good point to run the local Django server and exercise a real end-to-end flow.

## Tracked follow-ups (not blocking; pick up when relevant)

**Backend:**
- Deleting a `RecurringTask` CASCADEs its occurrences → will destroy DONE history once scoring exists; soft-delete via `active` or `SET_NULL` before the scoring slice.
- `refresh_statuses` runs on every board GET + has a lost-update race; narrow to requested dates + lock; wire onto Beat too (before real traffic).
- **Invite email is never SENT** (only a token is created) — wire it with Resend HTTP (not SMTP).
- Deploy hardening: Neon DB + `CONN_HEALTH_CHECKS`, `/healthz/` (no DB) + uptime monitor, `SECURE_*`/HSTS, single Celery beat, `update_last_login` in the token helper.
- Minor: extract an `OccurrenceScopedView` base (dedup pk+membership block); index `Occurrence(environment,is_cancelled,status)`; assignee not scoped to env members; preview endpoint exposes member display_name (UI uses only initials).

**Mobile:**
- Invite deep-link is unreachable for **already-signed-in** users (invite/join routes live under `(auth)`; the guard mounts only one group) → move to a shared route or make reachable in both.
- A failed post-auth invite accept only `console.warn`s (no user feedback) → add a toast/retry.
- Login error messages are generic (branch on `ApiError.status`); socket has no max-attempts/`onError`.
- Scoring/streak/presence UI are placeholders awaiting future backend support.

## Gotchas that cost time here (see root `CLAUDE.md` for the full list)

Python 3.14 → `cbor2==5.6.5` + `CBOR2_BUILD_C_EXTENSION=0`; Django **6.0**; deploy runs **ASGI** not WSGI; mobile installs may need `-- --legacy-peer-deps`; verify UI via **Expo Web** (no Xcode here); `.expo/` and `.superpowers/` are git-ignored.

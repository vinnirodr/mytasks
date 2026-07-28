# Organizados — Project Status & Resume

**Last updated:** 2026-07-28 · **One-liner:** Backend MVP is 100% done and merged; the Expo app (Plan 6) is past half — 6a/6b/6c merged; **6d (daily board + task detail + actions + live-WS client) is code-complete on `feat/mobile-daily-board`, web-verified day+night with a real backend, pending final review + PR**; **6e (agenda + new-task + create-environment) is next**.

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
| **6c** | Mobile onboarding + accept-invite (+ backend invite-preview endpoint) | ✅ merged (PR #8) |
| **6d** | Daily board + task detail + complete/defer/pickup + **live WebSocket** | 🔵 **branch `feat/mobile-daily-board` — final review** |
| **6e** | Agenda (week view) + new-task (recurring, 2-step) + create-environment | ⬜ **NEXT** |
| **6f** | Environments/members/profile/bell screens + Expo push-token registration | ⬜ pending |

PRs: #1 foundations · #2 agenda/occurrences · #3 daily board · #4 live layer · #5 push · #6 mobile 6a · #7 mobile 6b · #8 mobile 6c (open). Repo: `github.com/vinnirodr/mytasks`.

## Plan 6 kickoff decisions (from the designer's handoff)

- Product name is **"Organizados"** (short `Orgs`). Brand = split "O" (forest-green + tangerine halves), Bricolage Grotesque wordmark, pure-SVG symbol.
- The Expo app lives in **`mobile/`** in this repo (monorepo).
- Design asks for 3 things the backend intentionally lacks: **presence dot** + **streak/on-time% stats** → built as neutral/hidden placeholders (wire when future slices land); **accept-invite preview** → added a small public backend endpoint (done in 6c).
- Verification: subagents + **Expo Web** visual check (no Xcode on this Intel Mac → no iOS simulator; web ≈ iOS, not pixel-identical). iOS-pixel QA + push testing need the user's Xcode/device.
- Full design spec of tokens + all 18 screens: `docs/design/handoff/README.md` (+ `prototipo.html`).

## What's next (6e)

Finish 6d: dispatch the final whole-branch review, then open the PR for `feat/mobile-daily-board` → merge. Then branch `feat/mobile-agenda` off master and write `docs/superpowers/plans/…-mobile-6e-…md`. 6e builds the **Agenda** (week view, screen 9), the **Nova tarefa** 2-step recurring create (screen 12), and **Criar ambiente** (screen 13). Reuse 6d's `boardApi`/`environmentsApi`, the `ActiveEnvironmentProvider`, and the shared components. Note the FAB "Nova tarefa" (6d) currently routes to a placeholder — 6e wires it. Consider adding a mobile recurring-task/agenda API module and a create-environment endpoint call (backend `POST /environments/` already exists).

**6d recap (done):** backend members-list endpoint; mobile `environments`/`members`/`board` API; `ActiveEnvironmentProvider` + `BoardProvider` (race-guarded, `deriveBoard`); daily-board screen (hero SVG ring, Atrasadas/Hoje, TaskCard, optimistic complete + 5s undo, empty/error states); task-detail **modal** (REPETE + placeholders, adiar/reatribuir/assumir/concluir via MemberPickerSheet); live-WS client (`useBoardSocket`: surgical status patch, debounced refetch for new ids, `connected` → hero live dot). 223 jest tests + tsc clean; backend members tests + ruff clean. Web-verified day+night against a real seeded backend (board, detail, real auth + a real completed action). Live WS **client** verified connecting; live **push** blocked by a backend `channels_redis` Redis read-timeout (tracked follow-up, not a 6d client bug).

## Tracked follow-ups (not blocking; pick up when relevant)

**Backend:**
- **Live WS push broken on local Redis** (found in 6d web verify): the WS client connects fine, but the `channels_redis` layer throws `TimeoutError: Timeout reading from localhost:6379`, disconnecting the consumer before broadcasts arrive — so `board_update`/`activity` never reach the app live. Investigate `channels_redis` config / redis socket timeout before relying on live push (deploy-blocking for real-time).
- **CORS for web**: browser cross-origin (Expo web `:8081` → API `:8000`) needs `django-cors-headers` (dev) — add it (dev-only origins) or treat web as native-parity only and test live on device. 6d web verify used a throwaway non-committed CORS shim.
- Deleting a `RecurringTask` CASCADEs its occurrences → will destroy DONE history once scoring exists; soft-delete via `active` or `SET_NULL` before the scoring slice.
- `refresh_statuses` runs on every board GET + has a lost-update race; narrow to requested dates + lock; wire onto Beat too (before real traffic).
- **Invite email is never SENT** (only a token is created) — wire it with Resend HTTP (not SMTP).
- Deploy hardening: Neon DB + `CONN_HEALTH_CHECKS`, `/healthz/` (no DB) + uptime monitor, `SECURE_*`/HSTS, single Celery beat, `update_last_login` in the token helper.
- Minor: extract an `OccurrenceScopedView` base (dedup pk+membership block); index `Occurrence(environment,is_cancelled,status)`; assignee not scoped to env members; preview endpoint exposes member display_name (UI uses only initials).

**Mobile (6d follow-ups):**
- **Task detail is a modal, not a route** (NativeTabs can't reach sibling routes) — revisit when nav is restructured (6e/6f) if a deep-linkable `/task/[id]` is wanted.
- **Assignee live-sync gap**: `board_update` WS payload carries only `{occurrence_id, status}`, so a reassign/pickup by another user isn't reflected live (only status changes are) — extend the payload or refetch on assignee-affecting verbs.
- **Absent-id refetch** on `board_update` does a full replace that can transiently clobber a *different* occurrence's in-flight optimistic-complete (5s undo window); self-heals. Narrow it (merge instead of replace, or skip during active optimistic windows).
- **LATE checkbox not danger-toned**: handoff wants the late card's checkbox ring in `danger`, but `TaskCheckbox` has no danger state (card conveys via `dangerBg` + danger metadata). Add a danger variant to `TaskCheckbox` for full fidelity.
- Minor: task-detail `Modal` `visible` never toggles false (closes by unmount → no slide-out animation); `useMembers` fetched independently by board + detail (no shared cache).

**Mobile (earlier):**
- Invite deep-link is unreachable for **already-signed-in** users (invite/join routes live under `(auth)`; the guard mounts only one group) → move to a shared route or make reachable in both.
- A failed post-auth invite accept only `console.warn`s (no user feedback) → add a toast/retry.
- Login error messages are generic (branch on `ApiError.status`); socket has no max-attempts/`onError`.
- Scoring/streak/presence UI are placeholders awaiting future backend support.

## Gotchas that cost time here (see root `CLAUDE.md` for the full list)

Python 3.14 → `cbor2==5.6.5` + `CBOR2_BUILD_C_EXTENSION=0`; Django **6.0**; deploy runs **ASGI** not WSGI; mobile installs may need `-- --legacy-peer-deps`; verify UI via **Expo Web** (no Xcode here); `.expo/` and `.superpowers/` are git-ignored.

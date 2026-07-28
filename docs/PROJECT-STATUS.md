# Organizados — Project Status & Resume

**Last updated:** 2026-07-28 · **One-liner:** Backend MVP is 100% done and merged; the Expo app (Plan 6) is ~80% — 6a/6b/6c/6d merged; **6e (agenda + new-task 2-step + create-environment) is code-complete on `feat/mobile-agenda`, web-verified day+night with a real backend, pending final review + PR**; **6f (environments/members/profile/bell + push-token) is the last slice**.

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
| **6d** | Daily board + task detail + complete/defer/pickup + **live WebSocket** | ✅ merged (PR #9) |
| **6e** | Agenda (week view) + new-task (recurring, 2-step) + create-environment | 🔵 **branch `feat/mobile-agenda` — final review** |
| **6f** | Environments/members/profile/bell screens + Expo push-token registration | ⬜ **NEXT** |

PRs: #1 foundations · #2 agenda/occurrences · #3 daily board · #4 live layer · #5 push · #6 mobile 6a · #7 mobile 6b · #8 mobile 6c (open). Repo: `github.com/vinnirodr/mytasks`.

## Plan 6 kickoff decisions (from the designer's handoff)

- Product name is **"Organizados"** (short `Orgs`). Brand = split "O" (forest-green + tangerine halves), Bricolage Grotesque wordmark, pure-SVG symbol.
- The Expo app lives in **`mobile/`** in this repo (monorepo).
- Design asks for 3 things the backend intentionally lacks: **presence dot** + **streak/on-time% stats** → built as neutral/hidden placeholders (wire when future slices land); **accept-invite preview** → added a small public backend endpoint (done in 6c).
- Verification: subagents + **Expo Web** visual check (no Xcode on this Intel Mac → no iOS simulator; web ≈ iOS, not pixel-identical). iOS-pixel QA + push testing need the user's Xcode/device.
- Full design spec of tokens + all 18 screens: `docs/design/handoff/README.md` (+ `prototipo.html`).

## What's next (6f)

Finish 6e: dispatch the final whole-branch review, then open the PR for `feat/mobile-agenda` → merge. Then branch `feat/mobile-environments` off master and write `docs/superpowers/plans/…-mobile-6f-…md`. **6f is the last slice**: "Meus ambientes" (screen 11), "Casa · membros" (screen 16, reuse the 6d members endpoint), profile, and the bell/notifications feed (screen 15, backend bell API from Plan 4) + Expo push-token registration (`POST /api/push-tokens/`, Plan 5). Good moment to also fold in the accumulated cross-slice follow-ups (a shared `MembersProvider`, environment switcher for `setActive`, the invite deep-link fix).

**6e recap (done):** mobile `boardApi.getWeek`/`weekStartISO`, `environmentsApi.create`, `tasksApi` (createDefinition/createRecurring); **Agenda** tab (WeekStrip + AgendaList, status bars, "SEM HORÁRIO", dashed POSTPONED, read-only); **Nova tarefa** admin-only 2-step modal (title/assignee/day-chips→weekday mapping/time → 1 TaskDefinition + N RecurringTask, partial-failure handling; wires the 6d FAB); **Criar ambiente** modal (name/type/local-color → create → `addAndActivate`; wires the no-env empty state). 326 jest tests + tsc clean. Web-verified day+night against a real backend (Agenda live on-brand; Nova tarefa admin flow verified end-to-end incl. real DB weekday rows).

**6d recap (merged):** members endpoint; `environments`/`members`/`board` API; `ActiveEnvironmentProvider` + `BoardProvider` (`deriveBoard`); daily-board screen (SVG ring, optimistic complete + 5s undo); task-detail modal; live-WS client (`useBoardSocket`). Live **push** blocked by a backend `channels_redis` Redis read-timeout (tracked, not a client bug).

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
- Minor (final-review): board shows the empty state ("Nada para hoje 🎉") for one frame before the spinner because `BoardProvider` inits `loading=false` → init `loading=true` or add a first-load flag; add day `overlaySoft`/`scrim` tokens so `TaskDetail`/`MemberPickerSheet` stop using literal rgba; `useUndoableComplete`'s unmount-flush can `setState` after unmount on sign-out (dev warning only); `TaskDetail` action error-revert restores a whole click-time snapshot (edge race, self-heals on refetch).

**Mobile (6e follow-ups):**
- **Shared `MembersProvider`**: `useMembers` is now fetched independently by 3 screens (board, task-detail, new-task) — build one shared members context/cache (do it in 6f).
- **New-task partial-failure retry** re-runs `createDefinition` (possible duplicate `TaskDefinition`) and re-submits already-succeeded weekdays → track `definitionId` + only retry failed weekdays; also call `board.refetch()` after a partial success. Consider a backend convenience endpoint that creates a definition + N recurring tasks atomically.
- **Member one-off task** creation isn't built (Nova tarefa is admin-only recurring); `POST /occurrences/` already supports member one-offs.
- **Agenda can't open task detail** (TaskDetail is coupled to `BoardProvider`/today) — decouple to reuse in the week view; Agenda also has no week navigation yet (static month pill).
- **Environment color** picked in Criar ambiente is local-only (no backend field).

**Mobile (earlier):**
- Invite deep-link is unreachable for **already-signed-in** users (invite/join routes live under `(auth)`; the guard mounts only one group) → move to a shared route or make reachable in both.
- A failed post-auth invite accept only `console.warn`s (no user feedback) → add a toast/retry.
- Login error messages are generic (branch on `ApiError.status`); socket has no max-attempts/`onError`.
- Scoring/streak/presence UI are placeholders awaiting future backend support.

## Gotchas that cost time here (see root `CLAUDE.md` for the full list)

Python 3.14 → `cbor2==5.6.5` + `CBOR2_BUILD_C_EXTENSION=0`; Django **6.0**; deploy runs **ASGI** not WSGI; mobile installs may need `-- --legacy-peer-deps`; verify UI via **Expo Web** (no Xcode here); `.expo/` and `.superpowers/` are git-ignored.

# CLAUDE.md — Organizados (repo: MyTasks)

> This file is auto-loaded at the start of every Claude Code session. **To resume where we left off, read [`docs/PROJECT-STATUS.md`](docs/PROJECT-STATUS.md) first** — it is the single source of "what's done / what's next".

## What this is

**Organizados** (short form `Orgs`) — a mobile app for a household/group to organize and track shared home chores in real time. Each *environment* (house/office/work) has members, a recurring weekly routine of tasks (with assignee + time), and a live "daily board". An admin defines the routine; any member completes / postpones / picks up tasks and can open one-week exceptions. ("MyTasks" is only the repo folder name.)

## Repo layout

- `backend/` — Django 6 / DRF / **PostgreSQL** + **Redis**, with **Channels** (WebSocket real-time) and **Celery + Beat** (push reminders + maintenance jobs). Apps: `accounts` (email User + JWT), `environments` (env/membership/invites), `tasks` (catalog/recurring agenda/occurrences/daily-board), `notifications` (activity feed + WS consumer), `push` (Expo push). Fully MVP-complete and merged.
- `mobile/` — **Expo SDK 57 / React Native 0.86 / expo-router / TypeScript** app. In progress (Plan 6, decomposed 6a–6f).
- `docs/superpowers/specs/` — the MVP design spec. `docs/superpowers/plans/` — one implementation plan per slice. `docs/design/handoff/` — the designer's hi-fi handoff (`README.md` = tokens + all 18 screens; `prototipo.html`).
- `docs/PROJECT-STATUS.md` — **the resume/status doc.**

## How we work (conventions)

- **Communicate in Portuguese (pt-BR).** Code + commit messages in English; UI copy in pt-BR.
- **Subagent-driven development** (superpowers skill): a plan → a fresh subagent per task (TDD) → spec/quality review per task → a final whole-branch review. Backend gates: pytest (against Postgres) + `ruff`. Mobile gates: `npx tsc --noEmit` + jest (mocked) + **Expo Web** visual check.
- **Git flow:** each plan/slice on its own `feat/…` branch → **push + open a PR** to `master` (GitHub `vinnirodr/mytasks`, `gh` authed). **Merge the current PR before branching the next slice.** Planning docs are committed to `master` directly. Commit message bodies end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## How to run

**Backend** (from `backend/`, needs Postgres + Redis running):
```bash
cd backend && . .venv/bin/activate
python manage.py migrate
python manage.py runserver          # ASGI (daphne) — serves HTTP + WebSockets
celery -A config worker -l info     # background jobs
celery -A config beat -l info       # scheduler (run exactly ONE beat)
pytest -q                           # tests
```
**Mobile** (from `mobile/`, Node 20):
```bash
cd mobile
npx expo start                      # dev (needs Expo Go or a dev build)
BROWSER=none npx expo start --web   # web (used for visual verification here)
npx tsc --noEmit && npm test        # gates
```

## Stack caveats (hard-won — apply proactively)

- **Python 3.14:** pin `cbor2==5.6.5` and install backend deps with `CBOR2_BUILD_C_EXTENSION=0` (cbor2 ≥ 5.7 needs Rust, no 3.14 wheel). Django is **6.0** (5.x won't run on 3.14).
- **Deploy must run ASGI** (daphne/uvicorn), never plain WSGI, or WebSockets silently drop.
- **No full Xcode on this (Intel) Mac** — only Command Line Tools. iOS simulator is unavailable; mobile UI is verified via **Expo Web** (≈ iOS, not pixel-identical). iOS-pixel QA + push testing need the user's Xcode/device.
- **Mobile installs** may need `-- --legacy-peer-deps` (a pre-existing RN 0.86 vs jest-preset peer conflict).
- **Deploy DB = Neon** (not Render's free Postgres, deleted after 90 days) + `CONN_HEALTH_CHECKS=True`; **email via Resend HTTP** (Render blocks SMTP) — note: invite **email sending is not wired yet**.
- Never commit `.expo/`. `.superpowers/sdd/progress.md` is a git-ignored per-run scratch ledger (not durable — this file + PROJECT-STATUS.md are the durable record).

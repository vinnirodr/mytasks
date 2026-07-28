# Mobile 6a — Design System Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. This is UI work: verification is primarily **visual on the iOS simulator** against the prototype, plus light tests for pure logic (theme resolution, token maps). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build the "Organizados" design-system foundation in the Expo app (`mobile/`): fonts, day/night theme tokens + provider, typography, the split-"O" brand symbol, and the core reusable components — all matching the hi-fi handoff, verified on the iOS simulator.

**Architecture:** A theme layer (typed token objects for day + night, a `ThemeProvider` that follows the OS scheme with a manual override, and a `useTheme()` hook) sits under a small set of primitive components (typography, brand, Button, TextField, Card, Chip, Avatar/AvatarStack, TaskCheckbox, StatusChip, BottomNav). A DS gallery screen renders everything in both themes for visual QA. Later sub-plans (6b–6f) consume these primitives to build the 18 screens.

**Tech Stack:** Expo SDK 57, React Native 0.86, TypeScript, expo-router, react-native-svg, react-native-reanimated, @expo-google-fonts (Bricolage Grotesque, Manrope, IBM Plex Mono), @expo/vector-icons (Material icons).

## Global Constraints

- The single source of visual truth is `docs/design/handoff/README.md` (tokens + per-screen specs) and `docs/design/handoff/prototipo.html` (rendered screens). Reproduce values **exactly** — colors, sizes, radii, weights are final. All sizes are logical px on a 402×874 base.
- **Theme-aware from the start:** every component reads colors from `useTheme()`, never hardcodes a hex. Support **day and night**, following the OS color scheme by default with a manual override.
- **Do not trust memory for Expo/RN APIs** — they change between SDKs. Check the installed type declarations (`mobile/node_modules/<pkg>/*.d.ts` or the package's exports) and use the non-deprecated form that type-checks with `npx tsc --noEmit`.
- `npx tsc --noEmit` (from `mobile/`) must pass clean at the end of every task (this is the primary automated gate). Never commit `.expo/`.
- Pin Node with `mobile/.nvmrc` (Node 20). Fonts load via `@expo-google-fonts/*` + `expo-font`; hold the splash until fonts are ready.
- Icons: Material Symbols Rounded is the design intent; use `@expo/vector-icons` `MaterialIcons` as the pragmatic stand-in for the MVP (note it; a Material-Symbols variable font is a later polish).
- Product name is **Organizados** (short `Orgs`); the split-"O" symbol is pure SVG (paths below), never an image asset.
- Commit message bodies end with a blank line then `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Work in `mobile/`.

---

### Task 1: Project hygiene + fonts

**Files:**
- Create: `mobile/.nvmrc`
- Modify: `mobile/.gitignore` (ensure `.expo/` ignored)
- Modify: `mobile/package.json` (deps), `mobile/src/app/_layout.tsx` (font loading)
- Verify: iOS simulator

**Interfaces:**
- Produces: the three brand fonts loaded and available by family name; splash held until ready.

- [ ] **Step 1: Create `mobile/.nvmrc`** with `20`.

- [ ] **Step 2: Ensure `.expo/` is git-ignored** in `mobile/.gitignore` (add the line if missing).

- [ ] **Step 3: Install fonts + svg + reanimated (check they're not already present first)**

Run from `mobile/`:
```bash
npx expo install @expo-google-fonts/bricolage-grotesque @expo-google-fonts/manrope @expo-google-fonts/ibm-plex-mono expo-font react-native-svg react-native-reanimated
```
(Use `npx expo install`, not plain `npm install`, so versions match the SDK.)

- [ ] **Step 4: Load fonts in `mobile/src/app/_layout.tsx`**

Use `useFonts` from the google-fonts packages and hold `SplashScreen`. Import the exact weight exports the installed packages expose (check `node_modules/@expo-google-fonts/manrope/index.*` for the export names — e.g. `Manrope_400Regular`). Load: Bricolage 800 (and 700), Manrope 400/600/700/800, IBM Plex Mono 400/500. Keep the splash visible (`SplashScreen.preventAutoHideAsync()`) and hide it once `fontsLoaded` is true. Do not render the app tree until fonts are ready.

- [ ] **Step 5: Type-check**

Run: `cd mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Verify on the simulator**

Launch the app on the iOS simulator (attach first, then `npm run ios` / Expo). Confirm it boots past the splash to the default screen without a font error in the Metro logs. Capture a screenshot.

- [ ] **Step 7: Commit**

```bash
git add mobile/ && git commit -m "chore(mobile): pin node, load brand fonts, add svg+reanimated"
```

---

### Task 2: Design tokens (day + night)

**Files:**
- Create: `mobile/src/theme/tokens.ts`
- Test: `mobile/src/theme/__tests__/tokens.test.ts`

**Interfaces:**
- Produces:
  - `lightColors` / `darkColors` — objects with every color token from the handoff (keys in camelCase of the handoff names: `bg`, `surface`, `ink`, `inkMuted`, `inkDim`, `inkFaint`, `inkPlaceholder`, `forest`, `onForest`, `forestSoft`, `tangerine`, `butter`, `butterBg`, `butterInk`, `danger`, `dangerBg`, `live`, `border`, `borderDashed`, `divider`, `checkboxIdle` for day; and the night set incl. `accent`, `onAccent`, `navActive`, `surfaceSheet`, `dangerInk`, `borderStrong`, `overlaySoft`, `scrim`).
  - `spacing` (screenX day `22`, auth `24`, cardGap `12`, sectionGap `20`), `radius` (`hero:28, task:22, small:20, field:18, dayChip:16, pill:999, sheet:34`), `heights` (`button:58, field:56, nav:62, personChip:44, dayChip:46, iconButton:38, touch:44`), `fontSize` scale, `avatarColors` (per-person day/night bg+text pairs), and day-only `shadow` presets. Copy exact hex/px from `docs/design/handoff/README.md` ("Design Tokens").

- [ ] **Step 1: Write the failing test `mobile/src/theme/__tests__/tokens.test.ts`**

(Requires jest-expo — if not configured, this task also adds it; see Step 3.)
```ts
import { lightColors, darkColors, radius } from "../tokens";

test("day and night share the same color keys", () => {
  // night adds a few keys (accent, scrim...) but must include every day key it overrides
  expect(lightColors.forest).toBe("#123B2E");
  expect(lightColors.tangerine).toBe("#FF5A2B");
  expect(darkColors.bg).toBe("#0E1311");
  expect(darkColors.accent).toBe("#F2C744");
  expect(radius.pill).toBe(999);
});
```

- [ ] **Step 2: Create `mobile/src/theme/tokens.ts`** with the full day/night token objects and scales, copying exact values from `docs/design/handoff/README.md`. Export `lightColors`, `darkColors`, `spacing`, `radius`, `heights`, `fontSize`, `avatarColors`, `shadow`.

- [ ] **Step 3: Ensure a test runner exists**

If `mobile` has no jest config, add `jest-expo` + `@testing-library/react-native` (`npx expo install jest-expo` and dev-install testing-library) and a `"test": "jest"` script with `preset: "jest-expo"`. If configuring jest is disproportionate, convert this task's test to a plain `tsx`-run assertion script and note it — but prefer jest-expo since 6b+ will want component tests.

- [ ] **Step 4: Run the test + type-check**

Run: `cd mobile && npm test -- tokens && npx tsc --noEmit`
Expected: token test passes; no type errors.

- [ ] **Step 5: Commit**

```bash
git add mobile/ && git commit -m "feat(mobile): Organizados day/night design tokens"
```

---

### Task 3: ThemeProvider + useTheme

**Files:**
- Create: `mobile/src/theme/ThemeProvider.tsx`, `mobile/src/theme/useTheme.ts`
- Modify: `mobile/src/app/_layout.tsx` (wrap the tree)
- Test: `mobile/src/theme/__tests__/useTheme.test.tsx`

**Interfaces:**
- Consumes: `lightColors`/`darkColors` (Task 2), RN `useColorScheme`.
- Produces:
  - `ThemeProvider` — resolves `mode: "light" | "dark"` from the OS scheme, with a manual override setter; provides `{ mode, colors, spacing, radius, heights, fontSize, shadow, avatarColors, isDark, setOverride }`.
  - `useTheme()` — returns that context; throws if used outside the provider.
  - `useThemeControls()` (or expose `setOverride` on `useTheme`) so the Profile screen (6f) can toggle theme.

- [ ] **Step 1: Write the failing test `useTheme.test.tsx`** — render a component inside `ThemeProvider`, assert `useTheme().colors.forest === "#123B2E"` (light) and that forcing dark via the override yields `colors.bg === "#0E1311"`.

- [ ] **Step 2: Run it to verify it fails.** `cd mobile && npm test -- useTheme` → FAIL (module missing).

- [ ] **Step 3: Implement `ThemeProvider` + `useTheme`.** Follow the OS via `useColorScheme()`; keep an optional override in state (`"system" | "light" | "dark"`); memoize the context value; select `lightColors`/`darkColors` accordingly.

- [ ] **Step 4: Wrap the app tree** in `_layout.tsx` with `ThemeProvider` (inside the font gate).

- [ ] **Step 5: Run the test + type-check.** Expected: PASS, no type errors.

- [ ] **Step 6: Commit** `feat(mobile): ThemeProvider + useTheme (OS scheme + manual override)`.

---

### Task 4: Typography components

**Files:**
- Create: `mobile/src/components/Text.tsx`
- Test: `mobile/src/components/__tests__/Text.test.tsx`

**Interfaces:**
- Consumes: `useTheme` (Task 3), the loaded fonts (Task 1).
- Produces: a `Text` component (wrapping RN `Text`) with a `variant` prop mapping to the handoff roles: `display` (Bricolage 800, tight tracking, sizes 22–56 via a `size` prop), `title`/`body`/`bodyStrong`/`caption` (Manrope 400/600/700/800), `mono` (IBM Plex Mono 400/500, UPPERCASE, +tracking). Each variant picks the correct family, weight, size, letter-spacing, line-height, and defaults its color from the theme (`ink`, overridable via `color` prop / token key). Convenience exports `Display`, `Body`, `Mono`, etc.

- [ ] **Step 1: Write the failing test** — render `<Display size={56}>3</Display>` and `<Mono>hoje</Mono>`; assert the resolved `fontFamily` (e.g. contains `BricolageGrotesque`) and that `mono` uppercases its text (`getByText("HOJE")`).

- [ ] **Step 2: Run → fails. Step 3: Implement `Text.tsx`.** Map variants → font family/weight/size/tracking/line-height from the handoff typography table; mono transforms to uppercase and applies letter-spacing; color resolves from a theme token key (default `ink`).

- [ ] **Step 4: Test + type-check pass. Step 5: Commit** `feat(mobile): typography components (Display/Body/Mono)`.

---

### Task 5: Brand — split-"O" symbol + wordmark

**Files:**
- Create: `mobile/src/components/brand/OrgSymbol.tsx`, `mobile/src/components/brand/Wordmark.tsx`
- Test: `mobile/src/components/brand/__tests__/OrgSymbol.test.tsx`

**Interfaces:**
- Consumes: `react-native-svg`, `useTheme`, `react-native-reanimated`.
- Produces:
  - `OrgSymbol` — props `size` (default 44, min 20), optional `animated` and `mono`. Renders the two arcs from the handoff (viewBox 44×44): left half `forest`/night `#F2EDE4`, right half `tangerine`/night `#FFD65A`; **stroke-width compensation** (7 above 32px, 7.5 at 24–32, 8–8.5 below 24), `strokeLinecap="round"`. `mono` = full half + 45%-opacity half.
    - SVG paths: `M22 6a16 16 0 0 0 0 32` (left) and `M22 6a16 16 0 0 1 0 32` (right).
  - `Wordmark` — the symbol as the "O" + "rganizados" in Bricolage 800, tracking −4%, 4px gap. Sizes per screen.
  - When `animated`, the two halves enter offset ±7px on X and meet over 420ms with `cubic-bezier(0.2,0.8,0.2,1)` (reanimated). Used on splash + task completion. Never rotate/blink.

- [ ] **Step 1: Write the failing test** — render `<OrgSymbol size={96} />`; assert two `Path`s exist with the two `d` values and that stroke colors resolve to `#123B2E` and `#FF5A2B` in light mode.

- [ ] **Step 2: Run → fails. Step 3: Implement `OrgSymbol` + `Wordmark`** with the stroke-width compensation function and theme-aware half colors. Add the reanimated meet animation behind the `animated` prop.

- [ ] **Step 4: Test + type-check pass. Step 5: Commit** `feat(mobile): split-O brand symbol and wordmark`.

---

### Task 6: Core components — Button, TextField, Card

**Files:**
- Create: `mobile/src/components/Button.tsx`, `mobile/src/components/TextField.tsx`, `mobile/src/components/Card.tsx`
- Test: `mobile/src/components/__tests__/Button.test.tsx`

**Interfaces:**
- Consumes: `useTheme`, `Text` (Task 4).
- Produces:
  - `Button` — `variant`: `primary` (forest bg / onForest text, day shadow `0 8px 20px rgba(18,59,46,0.26)`), `tangerine`, `outline`, `danger`; height 58, radius 999, Manrope 16/700; `disabled` → 40% opacity; optional leading/trailing Material icon; pressable feedback. Night theme: primary uses `accent`/`onAccent`, no shadow.
  - `TextField` — mono label above (via `<Mono>`), 56px height, radius 18 (day) filled `surface`; focused → 2px border in the action color (`forest` day / `accent` night); placeholder uses `inkPlaceholder`; supports `secureTextEntry`. (The 3-bar password strength meter is a separate small component or a `strength` prop — implement the meter here or defer to 6b; if deferred, leave a clean prop hook.)
  - `Card` — `surface` bg, radius 22 default (prop), border `border` 1px, day-only shadow `0 2px 8px rgba(26,23,20,0.07)`; in night, elevation via `border` + surface luminance, never shadow.

- [ ] **Step 1: Write the failing test** — render a `primary` `<Button title="Concluir" onPress={fn} />`; `fireEvent.press` calls `fn`; a `disabled` button does not; assert the primary bg resolves to `forest` in light mode.

- [ ] **Step 2: Run → fails. Step 3: Implement the three components** per spec, all theme-aware, shadows day-only.

- [ ] **Step 4: Test + type-check pass. Step 5: Commit** `feat(mobile): Button, TextField, Card`.

---

### Task 7: Core components — Chip, Avatar, TaskCheckbox, StatusChip, BottomNav

**Files:**
- Create: `mobile/src/components/Chip.tsx`, `mobile/src/components/Avatar.tsx`, `mobile/src/components/TaskCheckbox.tsx`, `mobile/src/components/StatusChip.tsx`, `mobile/src/components/BottomNav.tsx`
- Test: `mobile/src/components/__tests__/Avatar.test.tsx`, `mobile/src/components/__tests__/TaskCheckbox.test.tsx`

**Interfaces:**
- Consumes: `useTheme`, `Text`, Material icons.
- Produces:
  - `Chip` — `person` (44px, selected = solid action color) and `day` (46px square, radius 16, selected = forest/creme with butter dot) variants; `selected` + `onPress`.
  - `Avatar` — `name`/`initials` + `person` key → color pair from `avatarColors` (theme-aware); `size` (default 34/44/62). `AvatarStack` — overlap −9px (−10 at 34px), 2px border in container-bg color, `+N` overflow chip.
  - `TaskCheckbox` — 30px; states: `idle` (2.5px `checkboxIdle` ring), `done` (filled `forest`/`butter` circle + check), `deferred` (dashed ring + `schedule` icon, 0.72 opacity); `onToggle`.
  - `StatusChip` — the 5 statuses (`pending`/`late`/`done`/`deferred`/`missed`) as a mono pill with the right color (e.g. `late` → `danger`).
  - `BottomNav` — 4 tabs (Hoje, Agenda, Casa, Perfil); active tab = solid pill with icon+label side by side; inactive = icon over 11px label; height 62 (iOS pill) — Android variant (80px, Material indicator) is deferred to a later polish, keep the component prop-driven.

- [ ] **Step 1: Write failing tests** — `Avatar` renders the initials "MA" for "Marina" with the day bg `#123B2E`; `TaskCheckbox` calls `onToggle` on press and shows the check when `state="done"`.

- [ ] **Step 2: Run → fail. Step 3: Implement all five** per spec, theme-aware.

- [ ] **Step 4: Tests + type-check pass. Step 5: Commit** `feat(mobile): Chip, Avatar, TaskCheckbox, StatusChip, BottomNav`.

---

### Task 8: Design-system gallery + simulator verification

**Files:**
- Create: `mobile/src/app/_ds-gallery.tsx` (a dev-only route rendering every component)
- Verify: iOS simulator, both themes

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Build the gallery screen** — a scrollable page showing: the wordmark; each Text variant; Buttons (all variants incl. disabled); a TextField (idle + focused); Cards; person/day Chips; an AvatarStack; the 3 TaskCheckbox states; all 5 StatusChips; the BottomNav. Add a toggle that flips the theme override (light/dark) so both can be checked without changing the OS setting.

- [ ] **Step 2: Type-check** `npx tsc --noEmit` clean.

- [ ] **Step 3: Verify on the iOS simulator (light)** — attach the simulator, run the app, navigate to the gallery, screenshot. Compare each component against `docs/design/handoff/prototipo.html` (open it in a browser for reference) and the README specs; note and fix any visible deviations (colors, radii, weights, sizes).

- [ ] **Step 4: Verify on the simulator (dark)** — flip the theme toggle, screenshot, compare against the night-theme screens. Fix deviations.

- [ ] **Step 5: Commit** `feat(mobile): design-system gallery + simulator-verified light/dark`.

---

## Self-Review

**Coverage:** fonts (T1), tokens (T2), theme provider (T3), typography (T4), brand (T5), Button/TextField/Card (T6), Chip/Avatar/Checkbox/StatusChip/BottomNav (T7), gallery + dual-theme simulator QA (T8). This is the primitive set every screen in 6b–6f needs.

**Guardrails baked in:** theme-aware from the first component; `.nvmrc` + `.expo/` ignored; `npx tsc --noEmit` as the automated gate each task; "check the installed `.d.ts`" reminder for font export names and Expo APIs; icons stand-in noted; brand is pure SVG.

**Deferred (later sub-plans / polish):** Android Material 3 variants of nav/fields/chips; a true Material Symbols Rounded font; password strength meter (hook left in TextField); the reanimated completion animation is built in T5 but wired into the board in 6d.

---

## Execution Handoff

This is sub-plan **6a of Plan 6** (the Expo client). Next: **6b** — API/WebSocket client (JWT + secure storage + `["jwt", token]` subprotocol), app state, and the auth screens (splash, login, register) built on these primitives. Then 6c (onboarding + accept-invite, which needs the backend invite-preview endpoint), 6d (daily board + live updates), 6e (agenda + create), 6f (environments/members/profile/bell + push registration).

import { avatarColors, darkColors, fontSize, heights, lightColors, radius, shadow, spacing } from "../tokens";

test("day and night share the same color keys", () => {
  // night adds a few keys (accent, scrim...) but must include every day key it overrides
  expect(lightColors.forest).toBe("#123B2E");
  expect(lightColors.tangerine).toBe("#FF5A2B");
  expect(darkColors.bg).toBe("#0E1311");
  expect(darkColors.accent).toBe("#F2C744");
  expect(radius.pill).toBe(999);
});

test("light colors match the handoff exactly", () => {
  expect(lightColors.bg).toBe("#F2EDE4");
  expect(lightColors.surface).toBe("#FFFDF9");
  expect(lightColors.ink).toBe("#1A1714");
  expect(lightColors.checkboxIdle).toBe("#C9BFB2");
  expect(lightColors.danger).toBe("#C7381F");
});

test("dark colors match the handoff exactly", () => {
  expect(darkColors.surface).toBe("#18211D");
  expect(darkColors.surfaceSheet).toBe("#131A17");
  expect(darkColors.onAccent).toBe("#2A2306");
  expect(darkColors.navActive).toBe("#F3EFE6");
  expect(darkColors.scrim).toBe("rgba(4,7,6,0.62)");
});

test("spacing, radius and heights match the handoff", () => {
  expect(spacing).toEqual({ screenX: 22, screenXAuth: 24, cardGap: 12, sectionGap: 20 });
  expect(radius).toEqual({ hero: 28, task: 22, small: 20, field: 18, dayChip: 16, pill: 999, sheet: 34 });
  expect(heights).toEqual({
    button: 58,
    field: 56,
    nav: 62,
    personChip: 44,
    dayChip: 46,
    iconButton: 38,
    touch: 44,
  });
});

test("fontSize scale matches the typography table", () => {
  expect(fontSize.display).toEqual([56, 44, 34, 32, 30, 28, 24, 22, 19]);
  expect(fontSize.text[0]).toBe(17);
  expect(fontSize.mono[0]).toBe(13);
});

test("avatarColors has day/night pairs for each person", () => {
  expect(avatarColors.marina.light).toEqual({ bg: "#123B2E", text: "#F2EDE4" });
  expect(avatarColors.marina.dark).toEqual({ bg: "#F2C744", text: "#2A2306" });
  expect(avatarColors.carlos.dark).toEqual({ bg: "#2F4038", text: "#A8C4B6" });
});

test("day-only shadow presets are RN-usable style objects", () => {
  expect(shadow.card.shadowColor).toBe("#1A1714");
  expect(shadow.primaryTangerine.shadowColor).toBe("#FF5A2B");
  expect(shadow.hero.shadowOpacity).toBe(0.22);
});

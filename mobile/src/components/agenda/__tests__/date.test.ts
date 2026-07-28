import { addDays, localISO, monthAbbr, parseLocalISO, weekDates, weekdayAbbr } from "../date";

describe("localISO / parseLocalISO", () => {
  test("round-trips a local date without a UTC shift", () => {
    const date = new Date(2026, 6, 28); // 28 Jul 2026 (month is 0-indexed)
    expect(localISO(date)).toBe("2026-07-28");
    expect(localISO(parseLocalISO("2026-07-28"))).toBe("2026-07-28");
  });

  test("zero-pads single-digit month/day", () => {
    expect(localISO(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("addDays", () => {
  test("rolls over month/year boundaries", () => {
    expect(localISO(addDays(new Date(2026, 6, 31), 1))).toBe("2026-08-01");
    expect(localISO(addDays(new Date(2026, 11, 31), 1))).toBe("2027-01-01");
  });
});

describe("weekDates", () => {
  test("returns the 7 Mon..Sun dates for a Monday weekStart", () => {
    const days = weekDates("2026-07-27"); // a Monday
    expect(days).toHaveLength(7);
    expect(days.map(localISO)).toEqual([
      "2026-07-27",
      "2026-07-28",
      "2026-07-29",
      "2026-07-30",
      "2026-07-31",
      "2026-08-01",
      "2026-08-02",
    ]);
  });
});

describe("weekdayAbbr / monthAbbr", () => {
  test("abbreviates weekday and month in pt-BR", () => {
    expect(weekdayAbbr(new Date(2026, 6, 27))).toBe("SEG"); // Monday
    expect(weekdayAbbr(new Date(2026, 6, 28))).toBe("TER"); // Tuesday
    expect(monthAbbr(new Date(2026, 6, 28))).toBe("JUL");
  });
});

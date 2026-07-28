import { fireEvent, render, screen } from "@testing-library/react-native";

import { ThemeProvider } from "@/theme/ThemeProvider";

import { WeekStrip } from "../WeekStrip";

function renderStrip(overrides: Partial<Parameters<typeof WeekStrip>[0]> = {}) {
  const onSelect = jest.fn();
  render(
    <ThemeProvider>
      <WeekStrip weekStart="2026-07-27" selectedISO="2026-07-28" onSelect={onSelect} {...overrides} />
    </ThemeProvider>,
  );
  return { onSelect };
}

test("renders all 7 days of the loaded week with weekday abbreviation + day number", () => {
  renderStrip();

  expect(screen.getByText("SEG")).toBeTruthy();
  expect(screen.getByText("27")).toBeTruthy();
  expect(screen.getByText("TER")).toBeTruthy();
  expect(screen.getByText("28")).toBeTruthy();
  expect(screen.getByText("DOM")).toBeTruthy();
  expect(screen.getByText("2")).toBeTruthy(); // Aug 2, 2026 — the week's Sunday
});

test("marks the selected day via accessibilityState", () => {
  renderStrip({ selectedISO: "2026-07-29" });

  const selectedCell = screen.getByTestId("week-strip-day-2026-07-29");
  expect(selectedCell.props.accessibilityState).toEqual({ selected: true });

  const otherCell = screen.getByTestId("week-strip-day-2026-07-27");
  expect(otherCell.props.accessibilityState).toEqual({ selected: false });
});

test("pressing a day cell calls onSelect with that day's ISO date", () => {
  const { onSelect } = renderStrip();

  fireEvent.press(screen.getByTestId("week-strip-day-2026-07-30"));
  expect(onSelect).toHaveBeenCalledWith("2026-07-30");
});

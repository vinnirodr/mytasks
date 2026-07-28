import { act, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { ThemeProvider } from "../ThemeProvider";
import { useTheme } from "../useTheme";

function Probe() {
  const theme = useTheme();
  return (
    <Text testID="probe">
      {theme.colors.forest}|{theme.colors.bg}|{theme.mode}|{String(theme.isDark)}
    </Text>
  );
}

function ProbeWithToggle() {
  const theme = useTheme();
  return (
    <>
      <Text testID="probe" onPress={() => theme.setOverride("dark")}>
        {theme.colors.forest}|{theme.colors.bg}|{theme.mode}|{String(theme.isDark)}
      </Text>
    </>
  );
}

test("defaults to light colors in the test environment", () => {
  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );

  const text = screen.getByTestId("probe").props.children.join("");
  expect(text).toContain("#123B2E");
});

test("useTheme throws when used outside ThemeProvider", () => {
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  expect(() => render(<Probe />)).toThrow(/ThemeProvider/);
  consoleError.mockRestore();
});

test("setOverride('dark') switches colors to the dark palette", () => {
  let latest: ReturnType<typeof useTheme> | undefined;

  function Capture() {
    latest = useTheme();
    return <Text testID="probe">{latest.colors.bg}</Text>;
  }

  render(
    <ThemeProvider>
      <Capture />
    </ThemeProvider>,
  );

  expect(latest?.colors.bg).toBe("#F2EDE4");

  act(() => {
    latest?.setOverride("dark");
  });

  expect(latest?.colors.bg).toBe("#0E1311");
  expect(latest?.isDark).toBe(true);
  expect(latest?.mode).toBe("dark");
});

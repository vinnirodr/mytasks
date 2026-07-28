import { render, screen } from "@testing-library/react-native";

import { ThemeProvider } from "@/theme/ThemeProvider";

import { Avatar } from "../Avatar";

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>(
      (acc, s) => ({ ...acc, ...flattenStyle(s) }),
      {},
    );
  }
  return (style as Record<string, unknown>) ?? {};
}

test("Avatar renders the initials 'MA' for 'Marina Silva' with the day bg #123B2E", () => {
  render(
    <ThemeProvider>
      <Avatar name="Marina Silva" person="marina" testID="avatar" />
    </ThemeProvider>,
  );

  expect(screen.getByText("MA")).toBeTruthy();

  const style = flattenStyle(screen.getByTestId("avatar").props.style);
  expect(style.backgroundColor).toBe("#123B2E");
});

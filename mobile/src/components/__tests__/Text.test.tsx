import { render, screen } from "@testing-library/react-native";

import { ThemeProvider } from "@/theme/ThemeProvider";

import { Display, Mono } from "../Text";

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>(
      (acc, s) => ({ ...acc, ...flattenStyle(s) }),
      {},
    );
  }
  return (style as Record<string, unknown>) ?? {};
}

test("Display applies a Bricolage Grotesque font family", () => {
  render(
    <ThemeProvider>
      <Display size={56}>3</Display>
    </ThemeProvider>,
  );

  const node = screen.getByText("3");
  const style = flattenStyle(node.props.style);

  expect(style.fontFamily).toEqual(expect.stringContaining("BricolageGrotesque"));
});

test("Mono uppercases its children", () => {
  render(
    <ThemeProvider>
      <Mono>hoje</Mono>
    </ThemeProvider>,
  );

  expect(screen.getByText("HOJE")).toBeTruthy();
});

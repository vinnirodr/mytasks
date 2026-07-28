import { render, screen } from "@testing-library/react-native";

import { ThemeProvider } from "@/theme/ThemeProvider";

import { OrgSymbol } from "../OrgSymbol";

test("renders both split-O arcs with the handoff's light-mode colors", () => {
  render(
    <ThemeProvider>
      <OrgSymbol size={96} />
    </ThemeProvider>,
  );

  const left = screen.getByTestId("org-symbol-left");
  const right = screen.getByTestId("org-symbol-right");

  expect(left.props.d).toBe("M22 6a16 16 0 0 0 0 32");
  expect(right.props.d).toBe("M22 6a16 16 0 0 1 0 32");

  expect(left.props.stroke).toBe("#123B2E");
  expect(right.props.stroke).toBe("#FF5A2B");
});

import { render, screen } from "@testing-library/react-native";

import { ThemeProvider } from "@/theme/ThemeProvider";

import { Splash } from "../Splash";

test("renders the animated org symbol, wordmark, and 'A CASA EM DIA' signature", () => {
  render(
    <ThemeProvider>
      <Splash />
    </ThemeProvider>,
  );

  // Two <OrgSymbol>s render: the large centered brand mark plus the small
  // one baked into <Wordmark>'s logotype.
  expect(screen.getAllByTestId("org-symbol-left").length).toBe(2);
  expect(screen.getAllByTestId("org-symbol-right").length).toBe(2);
  expect(screen.getByText("rganizados")).toBeTruthy();
  expect(screen.getByText("A CASA EM DIA")).toBeTruthy();
});

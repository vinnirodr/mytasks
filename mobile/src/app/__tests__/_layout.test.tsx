import { render, screen } from "@testing-library/react-native";

import { useAuth } from "@/auth/useAuth";
import { ThemeProvider } from "@/theme/ThemeProvider";

import { AuthGate } from "../_layout";

jest.mock("@/auth/useAuth");

jest.mock("expo-router", () => {
  const ReactActual = jest.requireActual("react");

  function Stack({ children }: { children?: React.ReactNode }) {
    return ReactActual.createElement(ReactActual.Fragment, null, children);
  }
  function StackProtected({ guard, children }: { guard: boolean; children?: React.ReactNode }) {
    return guard ? ReactActual.createElement(ReactActual.Fragment, null, children) : null;
  }
  function StackScreen({ name }: { name: string }) {
    const { Text: RNText } = jest.requireActual("react-native");
    return ReactActual.createElement(RNText, { testID: `screen-${name}` }, name);
  }
  Stack.Protected = StackProtected;
  Stack.Screen = StackScreen;

  return { Stack };
});

// Also used elsewhere in `_layout.tsx` (RootLayout, not under test here) —
// mocked so importing the module doesn't require the real native modules.
jest.mock("@/components/animated-icon", () => ({
  AnimatedSplashOverlay: () => null,
}));

const mockUseAuth = useAuth as jest.Mock;

test("renders the Splash while the session is loading", () => {
  mockUseAuth.mockReturnValue({ status: "loading" });

  render(
    <ThemeProvider>
      <AuthGate />
    </ThemeProvider>,
  );

  expect(screen.getByText("A CASA EM DIA")).toBeTruthy();
  expect(screen.queryByTestId("screen-(app)")).toBeNull();
  expect(screen.queryByTestId("screen-(auth)")).toBeNull();
});

test("mounts only the (app) group when signed in", () => {
  mockUseAuth.mockReturnValue({ status: "signedIn" });

  render(
    <ThemeProvider>
      <AuthGate />
    </ThemeProvider>,
  );

  expect(screen.getByTestId("screen-(app)")).toBeTruthy();
  expect(screen.queryByTestId("screen-(auth)")).toBeNull();
  expect(screen.queryByText("A CASA EM DIA")).toBeNull();
});

test("mounts only the (auth) group when signed out", () => {
  mockUseAuth.mockReturnValue({ status: "signedOut" });

  render(
    <ThemeProvider>
      <AuthGate />
    </ThemeProvider>,
  );

  expect(screen.getByTestId("screen-(auth)")).toBeTruthy();
  expect(screen.queryByTestId("screen-(app)")).toBeNull();
  expect(screen.queryByText("A CASA EM DIA")).toBeNull();
});

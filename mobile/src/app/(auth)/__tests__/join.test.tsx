import { fireEvent, render, screen } from "@testing-library/react-native";

import { ThemeProvider } from "@/theme/ThemeProvider";

import JoinScreen from "../join";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  router: {
    push: (...args: unknown[]) => mockPush(...args),
  },
}));

function renderScreen() {
  return render(
    <ThemeProvider>
      <JoinScreen />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

test("entering a token and pressing 'Continuar' navigates to the invite route with that token", () => {
  renderScreen();

  fireEvent.changeText(screen.getByPlaceholderText("Ex: AB12CD34"), "abc123");
  fireEvent.press(screen.getByText("Continuar"));

  expect(mockPush).toHaveBeenCalledWith("/(auth)/invite/abc123");
});

test("an empty field leaves 'Continuar' disabled and does not navigate", () => {
  renderScreen();

  fireEvent.press(screen.getByText("Continuar"));

  expect(mockPush).not.toHaveBeenCalled();
});

test("a whitespace-only token leaves 'Continuar' disabled and does not navigate", () => {
  renderScreen();

  fireEvent.changeText(screen.getByPlaceholderText("Ex: AB12CD34"), "   ");
  fireEvent.press(screen.getByText("Continuar"));

  expect(mockPush).not.toHaveBeenCalled();
});

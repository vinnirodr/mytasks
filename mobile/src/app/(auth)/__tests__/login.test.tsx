import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { useAuth } from "@/auth/useAuth";
import { ThemeProvider } from "@/theme/ThemeProvider";

import LoginScreen from "../login";

jest.mock("@/auth/useAuth");

jest.mock("expo-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

const mockUseAuth = useAuth as jest.Mock;

function renderScreen() {
  return render(
    <ThemeProvider>
      <LoginScreen />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

test("filling email and password and pressing 'Entrar' calls signIn with those values", async () => {
  const signIn = jest.fn().mockResolvedValue(undefined);
  mockUseAuth.mockReturnValue({ signIn, register: jest.fn(), status: "signedOut", user: null });

  renderScreen();

  fireEvent.changeText(screen.getByPlaceholderText("voce@exemplo.com"), "vini@example.com");
  fireEvent.changeText(screen.getByPlaceholderText("••••••••"), "supersecret");
  fireEvent.press(screen.getByText("Entrar"));

  await waitFor(() => {
    expect(signIn).toHaveBeenCalledWith("vini@example.com", "supersecret");
  });
});

test("a rejected signIn shows an inline error message", async () => {
  const signIn = jest.fn().mockRejectedValue(new Error("invalid credentials"));
  mockUseAuth.mockReturnValue({ signIn, register: jest.fn(), status: "signedOut", user: null });

  renderScreen();

  fireEvent.changeText(screen.getByPlaceholderText("voce@exemplo.com"), "vini@example.com");
  fireEvent.changeText(screen.getByPlaceholderText("••••••••"), "wrong-password");
  fireEvent.press(screen.getByText("Entrar"));

  expect(await screen.findByText("E-mail ou senha inválidos")).toBeTruthy();
});

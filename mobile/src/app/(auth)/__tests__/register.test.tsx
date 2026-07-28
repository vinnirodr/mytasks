import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { useAuth } from "@/auth/useAuth";
import { ThemeProvider } from "@/theme/ThemeProvider";

import RegisterScreen from "../register";

jest.mock("@/auth/useAuth");

jest.mock("expo-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

const mockUseAuth = useAuth as jest.Mock;

function renderScreen() {
  return render(
    <ThemeProvider>
      <RegisterScreen />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

test("pressing 'Criar conta' calls register with name, email and password", async () => {
  const register = jest.fn().mockResolvedValue(undefined);
  mockUseAuth.mockReturnValue({ signIn: jest.fn(), register, status: "signedOut", user: null });

  renderScreen();

  fireEvent.changeText(screen.getByPlaceholderText("Seu nome"), "Vini");
  fireEvent.changeText(screen.getByPlaceholderText("voce@exemplo.com"), "vini@example.com");
  fireEvent.changeText(screen.getByPlaceholderText("••••••••"), "Sup3r$ecret!");
  fireEvent.press(screen.getByTestId("terms-checkbox"));
  fireEvent.press(screen.getByRole("button", { name: "Criar conta" }));

  await waitFor(() => {
    expect(register).toHaveBeenCalledWith("vini@example.com", "Sup3r$ecret!", "Vini");
  });
});

test("a rejected register shows an inline error message", async () => {
  const register = jest.fn().mockRejectedValue(new Error("email taken"));
  mockUseAuth.mockReturnValue({ signIn: jest.fn(), register, status: "signedOut", user: null });

  renderScreen();

  fireEvent.changeText(screen.getByPlaceholderText("Seu nome"), "Vini");
  fireEvent.changeText(screen.getByPlaceholderText("voce@exemplo.com"), "vini@example.com");
  fireEvent.changeText(screen.getByPlaceholderText("••••••••"), "Sup3r$ecret!");
  fireEvent.press(screen.getByTestId("terms-checkbox"));
  fireEvent.press(screen.getByRole("button", { name: "Criar conta" }));

  expect(await screen.findByText("Não foi possível criar a conta. Tente novamente.")).toBeTruthy();
});

test("the 'Criar conta' button stays disabled until the terms checkbox is accepted", () => {
  const register = jest.fn();
  mockUseAuth.mockReturnValue({ signIn: jest.fn(), register, status: "signedOut", user: null });

  renderScreen();

  fireEvent.changeText(screen.getByPlaceholderText("Seu nome"), "Vini");
  fireEvent.changeText(screen.getByPlaceholderText("voce@exemplo.com"), "vini@example.com");
  fireEvent.changeText(screen.getByPlaceholderText("••••••••"), "Sup3r$ecret!");
  fireEvent.press(screen.getByRole("button", { name: "Criar conta" }));

  expect(register).not.toHaveBeenCalled();
});

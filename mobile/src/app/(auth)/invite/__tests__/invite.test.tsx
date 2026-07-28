import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { invitesApi } from "@/api/invites";
import { setPendingInvite } from "@/auth/pendingInvite";
import { useAuth } from "@/auth/useAuth";
import { ThemeProvider } from "@/theme/ThemeProvider";

import AcceptInviteScreen from "../[token]";

jest.mock("@/api/invites");
jest.mock("@/auth/useAuth");
jest.mock("@/auth/pendingInvite");

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useLocalSearchParams: jest.fn(),
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useLocalSearchParams } = require("expo-router");

const mockUseAuth = useAuth as jest.Mock;
const mockUseLocalSearchParams = useLocalSearchParams as jest.Mock;
const mockPreview = invitesApi.preview as jest.Mock;
const mockAccept = invitesApi.accept as jest.Mock;
const mockSetPendingInvite = setPendingInvite as jest.Mock;

const preview = {
  environmentName: "Casa da Praia",
  envType: "casa",
  memberCount: 2,
  members: [
    { displayName: "Marina Silva", initials: "MA" },
    { displayName: "Pedro Costa", initials: "PE" },
  ],
  invitedByName: "Marina Silva",
  status: "pending",
  email: "convidado@example.com",
};

function renderScreen() {
  return render(
    <ThemeProvider>
      <AcceptInviteScreen />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseLocalSearchParams.mockReturnValue({ token: "tok-123" });
});

test("renders the previewed environment name and members once the preview resolves", async () => {
  mockUseAuth.mockReturnValue({ status: "signedOut" });
  mockPreview.mockResolvedValue(preview);

  renderScreen();

  expect(await screen.findByText("Casa da Praia")).toBeTruthy();
  expect(screen.getByText("MA")).toBeTruthy();
  expect(screen.getByText("PE")).toBeTruthy();
  // `Mono` uppercases its children per the design system's typography rules.
  expect(screen.getByText("CONVIDADO@EXAMPLE.COM")).toBeTruthy();
  expect(mockPreview).toHaveBeenCalledWith("tok-123");
});

test("'Aceitar convite' while signed in accepts the invite and navigates into the app", async () => {
  mockUseAuth.mockReturnValue({ status: "signedIn" });
  mockPreview.mockResolvedValue(preview);
  mockAccept.mockResolvedValue({ environmentId: "env-1", role: "member" });

  renderScreen();

  await screen.findByText("Casa da Praia");

  fireEvent.press(screen.getByRole("button", { name: "Aceitar convite" }));

  await waitFor(() => {
    expect(mockAccept).toHaveBeenCalledWith("tok-123");
  });
  await waitFor(() => {
    expect(mockReplace).toHaveBeenCalledWith("/(app)");
  });
  expect(mockSetPendingInvite).not.toHaveBeenCalled();
});

test("'Aceitar convite' while signed out stashes the token and routes to register", async () => {
  mockUseAuth.mockReturnValue({ status: "signedOut" });
  mockPreview.mockResolvedValue(preview);

  renderScreen();

  await screen.findByText("Casa da Praia");

  fireEvent.press(screen.getByRole("button", { name: "Aceitar convite" }));

  await waitFor(() => {
    expect(mockSetPendingInvite).toHaveBeenCalledWith("tok-123");
  });
  expect(mockPush).toHaveBeenCalledWith("/(auth)/register");
  expect(mockAccept).not.toHaveBeenCalled();
});

test("a rejected preview shows the invalid-invite error state", async () => {
  mockUseAuth.mockReturnValue({ status: "signedOut" });
  mockPreview.mockRejectedValue(new Error("404"));

  renderScreen();

  expect(await screen.findByText("Convite inválido ou expirado")).toBeTruthy();
});

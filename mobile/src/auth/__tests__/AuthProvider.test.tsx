import { act, render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { authApi } from "@/api/auth";
import { apiClient } from "@/api/client";
import { tokenStore } from "@/api/tokenStore";

import { AuthProvider } from "../AuthProvider";
import { useAuth } from "../useAuth";

jest.mock("@/api/auth");
jest.mock("@/api/tokenStore");
jest.mock("@/api/client", () => ({
  apiClient: { setOnUnauthorized: jest.fn() },
}));

const mockGetAccess = tokenStore.getAccess as jest.Mock;
const mockSetTokens = tokenStore.setTokens as jest.Mock;
const mockClear = tokenStore.clear as jest.Mock;
const mockMe = authApi.me as jest.Mock;
const mockLogin = authApi.login as jest.Mock;
const mockRegister = authApi.register as jest.Mock;

const user = { id: "1", email: "a@b.com", displayName: "A B" };

let latest: ReturnType<typeof useAuth> | undefined;

function Probe() {
  latest = useAuth();
  return (
    <Text testID="probe">
      {latest.status}|{latest.user?.email ?? ""}
    </Text>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  latest = undefined;
});

test("starts loading then resolves to signedOut when no token is stored", async () => {
  mockGetAccess.mockResolvedValue(null);

  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

  expect(latest?.status).toBe("loading");

  await waitFor(() => {
    expect(latest?.status).toBe("signedOut");
  });

  expect(mockMe).not.toHaveBeenCalled();
});

test("resolves to signedIn with the user when a token is stored and me() succeeds", async () => {
  mockGetAccess.mockResolvedValue("stored-access");
  mockMe.mockResolvedValue(user);

  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

  await waitFor(() => {
    expect(latest?.status).toBe("signedIn");
  });

  expect(latest?.user).toEqual(user);
});

test("clears tokens and resolves to signedOut when the stored token is invalid", async () => {
  mockGetAccess.mockResolvedValue("stale-access");
  mockMe.mockRejectedValue(new Error("401"));
  mockClear.mockResolvedValue(undefined);

  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

  await waitFor(() => {
    expect(latest?.status).toBe("signedOut");
  });

  expect(mockClear).toHaveBeenCalledTimes(1);
});

test("signIn transitions signedOut to signedIn with the user", async () => {
  mockGetAccess.mockResolvedValue(null);
  mockLogin.mockResolvedValue({ access: "a", refresh: "r" });
  mockSetTokens.mockResolvedValue(undefined);
  mockMe.mockResolvedValue(user);

  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

  await waitFor(() => {
    expect(latest?.status).toBe("signedOut");
  });

  await act(async () => {
    await latest?.signIn("a@b.com", "secret");
  });

  expect(mockLogin).toHaveBeenCalledWith({ email: "a@b.com", password: "secret" });
  expect(mockSetTokens).toHaveBeenCalledWith({ access: "a", refresh: "r" });
  expect(latest?.status).toBe("signedIn");
  expect(latest?.user).toEqual(user);
});

test("signOut clears tokens and returns to signedOut", async () => {
  mockGetAccess.mockResolvedValue("stored-access");
  mockMe.mockResolvedValue(user);
  mockClear.mockResolvedValue(undefined);

  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

  await waitFor(() => {
    expect(latest?.status).toBe("signedIn");
  });

  await act(async () => {
    await latest?.signOut();
  });

  expect(mockClear).toHaveBeenCalledTimes(1);
  expect(latest?.status).toBe("signedOut");
  expect(latest?.user).toBeNull();
});

test("registers apiClient.setOnUnauthorized on mount", async () => {
  mockGetAccess.mockResolvedValue(null);

  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

  await waitFor(() => {
    expect(latest?.status).toBe("signedOut");
  });

  expect(apiClient.setOnUnauthorized).toHaveBeenCalledWith(expect.any(Function));
});

test("useAuth throws when used outside AuthProvider", () => {
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  expect(() => render(<Probe />)).toThrow(/AuthProvider/);
  consoleError.mockRestore();
});

import { act, render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { environmentsApi, type Environment } from "@/api/environments";
import { prefsStore } from "@/prefs/prefsStore";

import {
  ActiveEnvironmentProvider,
  pickActiveEnvironment,
} from "../ActiveEnvironmentProvider";
import { useActiveEnvironment } from "../useActiveEnvironment";

jest.mock("@/api/environments");
jest.mock("@/prefs/prefsStore", () => ({
  prefsStore: {
    getActiveEnvironmentId: jest.fn(),
    setActiveEnvironmentId: jest.fn(),
  },
}));

const mockList = environmentsApi.list as jest.Mock;
const mockGetActiveEnvironmentId = prefsStore.getActiveEnvironmentId as jest.Mock;
const mockSetActiveEnvironmentId = prefsStore.setActiveEnvironmentId as jest.Mock;

const envA: Environment = { id: "env-a", name: "Casa", envType: "HOUSE", timezone: "America/Sao_Paulo", role: "ADMIN" };
const envB: Environment = { id: "env-b", name: "Trabalho", envType: "OFFICE", timezone: "America/Sao_Paulo", role: "MEMBER" };

let latest: ReturnType<typeof useActiveEnvironment> | undefined;

function Probe() {
  latest = useActiveEnvironment();
  return (
    <Text testID="probe">
      {latest.loading ? "loading" : "loaded"}|{latest.active?.id ?? ""}
    </Text>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  latest = undefined;
  mockSetActiveEnvironmentId.mockResolvedValue(undefined);
});

describe("pickActiveEnvironment (pure selection rule)", () => {
  test("returns the persisted environment when it is still present in the list", () => {
    expect(pickActiveEnvironment([envA, envB], "env-b")).toEqual(envB);
  });

  test("falls back to the first environment when the persisted id is absent", () => {
    expect(pickActiveEnvironment([envA, envB], null)).toEqual(envA);
  });

  test("falls back to the first environment when the persisted id is no longer in the list", () => {
    expect(pickActiveEnvironment([envA, envB], "env-gone")).toEqual(envA);
  });

  test("returns null for an empty list regardless of the persisted id", () => {
    expect(pickActiveEnvironment([], "env-a")).toBeNull();
  });
});

describe("ActiveEnvironmentProvider", () => {
  test("starts loading, then selects the persisted environment and persists it back", async () => {
    mockList.mockResolvedValue([envA, envB]);
    mockGetActiveEnvironmentId.mockResolvedValue("env-b");

    render(
      <ActiveEnvironmentProvider>
        <Probe />
      </ActiveEnvironmentProvider>,
    );

    expect(latest?.loading).toBe(true);

    await waitFor(() => {
      expect(latest?.loading).toBe(false);
    });

    expect(latest?.environments).toEqual([envA, envB]);
    expect(latest?.active).toEqual(envB);
    expect(mockSetActiveEnvironmentId).toHaveBeenCalledWith("env-b");
    expect(latest?.error).toBeNull();
  });

  test("falls back to the first environment when nothing is persisted", async () => {
    mockList.mockResolvedValue([envA, envB]);
    mockGetActiveEnvironmentId.mockResolvedValue(null);

    render(
      <ActiveEnvironmentProvider>
        <Probe />
      </ActiveEnvironmentProvider>,
    );

    await waitFor(() => {
      expect(latest?.loading).toBe(false);
    });

    expect(latest?.active).toEqual(envA);
    expect(mockSetActiveEnvironmentId).toHaveBeenCalledWith("env-a");
  });

  test("resolves active to null and skips persisting when the list is empty", async () => {
    mockList.mockResolvedValue([]);
    mockGetActiveEnvironmentId.mockResolvedValue(null);

    render(
      <ActiveEnvironmentProvider>
        <Probe />
      </ActiveEnvironmentProvider>,
    );

    await waitFor(() => {
      expect(latest?.loading).toBe(false);
    });

    expect(latest?.active).toBeNull();
    expect(mockSetActiveEnvironmentId).not.toHaveBeenCalled();
  });

  test("captures a network error in `error` without throwing", async () => {
    const error = new Error("network down");
    mockList.mockRejectedValue(error);
    mockGetActiveEnvironmentId.mockResolvedValue(null);

    render(
      <ActiveEnvironmentProvider>
        <Probe />
      </ActiveEnvironmentProvider>,
    );

    await waitFor(() => {
      expect(latest?.loading).toBe(false);
    });

    expect(latest?.error).toBe(error);
    expect(latest?.active).toBeNull();
  });

  test("setActive persists and updates the active environment when the id is present", async () => {
    mockList.mockResolvedValue([envA, envB]);
    mockGetActiveEnvironmentId.mockResolvedValue("env-a");

    render(
      <ActiveEnvironmentProvider>
        <Probe />
      </ActiveEnvironmentProvider>,
    );

    await waitFor(() => {
      expect(latest?.active).toEqual(envA);
    });

    act(() => {
      latest?.setActive("env-b");
    });

    expect(latest?.active).toEqual(envB);
    expect(mockSetActiveEnvironmentId).toHaveBeenCalledWith("env-b");
  });

  test("setActive is a no-op for an id that is not in the list", async () => {
    mockList.mockResolvedValue([envA, envB]);
    mockGetActiveEnvironmentId.mockResolvedValue("env-a");

    render(
      <ActiveEnvironmentProvider>
        <Probe />
      </ActiveEnvironmentProvider>,
    );

    await waitFor(() => {
      expect(latest?.active).toEqual(envA);
    });

    mockSetActiveEnvironmentId.mockClear();

    act(() => {
      latest?.setActive("env-unknown");
    });

    expect(latest?.active).toEqual(envA);
    expect(mockSetActiveEnvironmentId).not.toHaveBeenCalled();
  });

  test("reload() re-fetches the list and re-validates the active environment", async () => {
    mockList.mockResolvedValueOnce([envA]).mockResolvedValueOnce([envA, envB]);
    mockGetActiveEnvironmentId.mockResolvedValue("env-a");

    render(
      <ActiveEnvironmentProvider>
        <Probe />
      </ActiveEnvironmentProvider>,
    );

    await waitFor(() => {
      expect(latest?.environments).toEqual([envA]);
    });

    await act(async () => {
      latest?.reload();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(latest?.environments).toEqual([envA, envB]);
    });

    expect(mockList).toHaveBeenCalledTimes(2);
  });

  test("ignores a stale reload() response that resolves after a newer one (race guard)", async () => {
    let resolveFirst: (value: Environment[]) => void = () => {};
    const firstPromise = new Promise<Environment[]>((resolve) => {
      resolveFirst = resolve;
    });
    mockList.mockReturnValueOnce(firstPromise);
    mockGetActiveEnvironmentId.mockResolvedValue(null);

    render(
      <ActiveEnvironmentProvider>
        <Probe />
      </ActiveEnvironmentProvider>,
    );

    // reload() fires a second request before the initial mount request resolves.
    mockList.mockResolvedValueOnce([envA, envB]);

    await act(async () => {
      latest?.reload();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(latest?.environments).toEqual([envA, envB]);
    });

    // the stale initial-mount response resolves late — it must not overwrite reload()'s state.
    await act(async () => {
      resolveFirst([envA]);
      await Promise.resolve();
    });

    expect(latest?.environments).toEqual([envA, envB]);
    expect(latest?.loading).toBe(false);
  });

  test("addAndActivate inserts a new environment, activates it, and persists it", async () => {
    mockList.mockResolvedValue([envA]);
    mockGetActiveEnvironmentId.mockResolvedValue("env-a");

    render(
      <ActiveEnvironmentProvider>
        <Probe />
      </ActiveEnvironmentProvider>,
    );

    await waitFor(() => {
      expect(latest?.active).toEqual(envA);
    });

    mockSetActiveEnvironmentId.mockClear();

    const envC: Environment = {
      id: "env-c",
      name: "Novo lugar",
      envType: "HOUSE",
      timezone: "America/Sao_Paulo",
      role: "ADMIN",
    };

    act(() => {
      latest?.addAndActivate(envC);
    });

    expect(latest?.environments).toEqual([envA, envC]);
    expect(latest?.active).toEqual(envC);
    expect(mockSetActiveEnvironmentId).toHaveBeenCalledWith("env-c");
  });

  test("addAndActivate only activates (no duplicate insert) when the environment is already in the list", async () => {
    mockList.mockResolvedValue([envA, envB]);
    mockGetActiveEnvironmentId.mockResolvedValue("env-a");

    render(
      <ActiveEnvironmentProvider>
        <Probe />
      </ActiveEnvironmentProvider>,
    );

    await waitFor(() => {
      expect(latest?.active).toEqual(envA);
    });

    mockSetActiveEnvironmentId.mockClear();

    act(() => {
      latest?.addAndActivate(envB);
    });

    expect(latest?.environments).toEqual([envA, envB]);
    expect(latest?.active).toEqual(envB);
    expect(mockSetActiveEnvironmentId).toHaveBeenCalledWith("env-b");
  });

  test("useActiveEnvironment throws when used outside the provider", () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/ActiveEnvironmentProvider/);
    consoleError.mockRestore();
  });
});

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import type { Environment } from "@/api/environments";
import { environmentsApi } from "@/api/environments";
import { useActiveEnvironment } from "@/env/useActiveEnvironment";
import { ThemeProvider } from "@/theme/ThemeProvider";

import { canCreateEnv, CreateEnvModal, ENV_TYPE_CHIPS, SWATCH_COLORS } from "../CreateEnvModal";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/api/environments", () => ({
  environmentsApi: { create: jest.fn() },
}));

jest.mock("@/env/useActiveEnvironment", () => ({ useActiveEnvironment: jest.fn() }));

const mockCreate = environmentsApi.create as jest.Mock;
const mockUseActiveEnvironment = useActiveEnvironment as jest.Mock;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const createdEnv: Environment = {
  id: "env-new",
  name: "República do Bloco B",
  envType: "OFFICE",
  timezone: "America/Sao_Paulo",
  role: "ADMIN",
};

let mockAddAndActivate: jest.Mock;

function renderModal(props: Partial<Parameters<typeof CreateEnvModal>[0]> = {}) {
  return render(
    <ThemeProvider>
      <CreateEnvModal visible onClose={jest.fn()} {...props} />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAddAndActivate = jest.fn();
  mockUseActiveEnvironment.mockReturnValue({
    environments: [],
    active: null,
    setActive: jest.fn(),
    addAndActivate: mockAddAndActivate,
    loading: false,
    error: null,
    reload: jest.fn(),
  });
});

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

describe("ENV_TYPE_CHIPS (pt-BR label -> backend EnvType mapping)", () => {
  test("Casa/República/Trabalho map to HOUSE/OFFICE/WORK, in that order", () => {
    expect(ENV_TYPE_CHIPS.map((chip) => chip.label)).toEqual(["Casa", "República", "Trabalho"]);
    expect(ENV_TYPE_CHIPS.map((chip) => chip.envType)).toEqual(["HOUSE", "OFFICE", "WORK"]);
  });
});

describe("SWATCH_COLORS", () => {
  test("exposes exactly 5 local-only color swatches", () => {
    expect(SWATCH_COLORS).toHaveLength(5);
  });
});

describe("canCreateEnv", () => {
  test("false for an empty/blank name even with a type selected", () => {
    expect(canCreateEnv("", "HOUSE")).toBe(false);
    expect(canCreateEnv("   ", "HOUSE")).toBe(false);
  });

  test("false when no type is selected", () => {
    expect(canCreateEnv("Casa da Rua Aurora", null)).toBe(false);
  });

  test("true with a non-empty name and a selected type", () => {
    expect(canCreateEnv("Casa da Rua Aurora", "HOUSE")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

test("does not render when visible is false", () => {
  renderModal({ visible: false });
  expect(screen.queryByTestId("create-env-modal")).toBeNull();
});

test("'Criar ambiente' starts disabled (no name yet, even with the default HOUSE type)", () => {
  renderModal();

  const confirm = screen.getByTestId("create-env-confirm");
  expect(confirm.props.accessibilityState.disabled).toBe(true);
});

test("enables 'Criar ambiente' once a name is typed", () => {
  renderModal();

  fireEvent.changeText(screen.getByPlaceholderText("Nome do ambiente"), "Casa da Rua Aurora");

  expect(screen.getByTestId("create-env-confirm").props.accessibilityState.disabled).toBe(false);
});

test("defaults to the Casa/HOUSE chip selected", () => {
  renderModal();

  expect(screen.getByTestId("env-type-chip-HOUSE").props.accessibilityState.selected).toBe(true);
  expect(screen.getByTestId("env-type-chip-OFFICE").props.accessibilityState.selected).toBe(false);
});

test("tapping a type chip selects it exclusively", () => {
  renderModal();

  fireEvent.press(screen.getByTestId("env-type-chip-OFFICE"));

  expect(screen.getByTestId("env-type-chip-OFFICE").props.accessibilityState.selected).toBe(true);
  expect(screen.getByTestId("env-type-chip-HOUSE").props.accessibilityState.selected).toBe(false);
});

test("on confirm, calls environmentsApi.create with the mapped envType and no color field", async () => {
  mockCreate.mockResolvedValue(createdEnv);
  renderModal();

  fireEvent.changeText(
    screen.getByPlaceholderText("Nome do ambiente"),
    "República do Bloco B",
  );
  fireEvent.press(screen.getByTestId("env-type-chip-OFFICE"));
  fireEvent.press(screen.getByTestId("env-swatch-2"));

  await act(async () => {
    fireEvent.press(screen.getByTestId("create-env-confirm"));
    await Promise.resolve();
  });

  expect(mockCreate).toHaveBeenCalledWith({ name: "República do Bloco B", envType: "OFFICE" });
  const [callArg] = mockCreate.mock.calls[0]!;
  expect(callArg).not.toHaveProperty("color");
});

test("on success, calls addAndActivate with the returned environment and closes", async () => {
  mockCreate.mockResolvedValue(createdEnv);
  const onClose = jest.fn();
  renderModal({ onClose });

  fireEvent.changeText(screen.getByPlaceholderText("Nome do ambiente"), "República do Bloco B");

  await act(async () => {
    fireEvent.press(screen.getByTestId("create-env-confirm"));
    await Promise.resolve();
  });

  expect(mockAddAndActivate).toHaveBeenCalledWith(createdEnv);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("on error, shows a pt-BR notice, stays open, and does not call addAndActivate", async () => {
  mockCreate.mockRejectedValue(new Error("network down"));
  const onClose = jest.fn();
  renderModal({ onClose });

  fireEvent.changeText(screen.getByPlaceholderText("Nome do ambiente"), "Casa");

  await act(async () => {
    fireEvent.press(screen.getByTestId("create-env-confirm"));
    await Promise.resolve();
  });

  await waitFor(() => {
    expect(screen.getByTestId("create-env-error-banner")).toBeTruthy();
  });
  expect(screen.getByText("Não foi possível criar o ambiente. Tente de novo.")).toBeTruthy();
  expect(mockAddAndActivate).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
});

test("dismissing the error banner clears it", async () => {
  mockCreate.mockRejectedValue(new Error("network down"));
  renderModal();

  fireEvent.changeText(screen.getByPlaceholderText("Nome do ambiente"), "Casa");

  await act(async () => {
    fireEvent.press(screen.getByTestId("create-env-confirm"));
    await Promise.resolve();
  });

  await waitFor(() => {
    expect(screen.getByTestId("create-env-error-banner")).toBeTruthy();
  });

  fireEvent.press(screen.getByTestId("create-env-error-dismiss"));

  expect(screen.queryByTestId("create-env-error-banner")).toBeNull();
});

test("tapping close resets and calls onClose", () => {
  const onClose = jest.fn();
  renderModal({ onClose });

  fireEvent.changeText(screen.getByPlaceholderText("Nome do ambiente"), "Rascunho");
  fireEvent.press(screen.getByTestId("create-env-close"));

  expect(onClose).toHaveBeenCalledTimes(1);
});

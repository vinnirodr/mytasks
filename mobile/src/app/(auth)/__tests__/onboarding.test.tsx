import { fireEvent, render, screen } from "@testing-library/react-native";

import { prefsStore } from "@/prefs/prefsStore";
import { ThemeProvider } from "@/theme/ThemeProvider";

import OnboardingScreen from "../onboarding";

jest.mock("@/prefs/prefsStore", () => ({
  prefsStore: {
    getOnboardingSeen: jest.fn().mockResolvedValue(false),
    setOnboardingSeen: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
  },
}));

const mockSetOnboardingSeen = prefsStore.setOnboardingSeen as jest.Mock;

function renderScreen() {
  return render(
    <ThemeProvider>
      <OnboardingScreen />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

test("renders all three onboarding pages", () => {
  renderScreen();

  expect(screen.getByText("Uma rotina, sem esquecer nada.")).toBeTruthy();
  expect(screen.getByText("Cada um sabe o que é seu.")).toBeTruthy();
  expect(screen.getByText("Imprevisto não desmonta o combinado.")).toBeTruthy();
});

test("pressing 'Pular' marks onboarding seen and navigates to login", () => {
  renderScreen();

  fireEvent.press(screen.getByText("Pular"));

  expect(mockSetOnboardingSeen).toHaveBeenCalledTimes(1);
  expect(mockReplace).toHaveBeenCalledWith("/(auth)/login");
});

test("the first page's CTA reads 'Continuar' and advances the pager", () => {
  renderScreen();

  expect(screen.getByText("Continuar")).toBeTruthy();
  expect(screen.queryByText("Começar")).toBeNull();

  fireEvent.press(screen.getByText("Continuar"));

  expect(mockSetOnboardingSeen).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
});

test("the last page's CTA reads 'Começar' and marks onboarding seen + navigates to login", () => {
  renderScreen();

  const pager = screen.getByTestId("onboarding-pager");

  // A very large offset always rounds/clamps to the last page regardless of
  // the mocked window width in the test environment.
  fireEvent.scroll(pager, {
    nativeEvent: { contentOffset: { x: 100000, y: 0 } },
  });

  expect(screen.getByText("Começar")).toBeTruthy();
  expect(screen.queryByText("Continuar")).toBeNull();

  fireEvent.press(screen.getByText("Começar"));

  expect(mockSetOnboardingSeen).toHaveBeenCalledTimes(1);
  expect(mockReplace).toHaveBeenCalledWith("/(auth)/login");
});

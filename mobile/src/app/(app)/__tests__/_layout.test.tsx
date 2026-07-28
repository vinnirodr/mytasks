import { render, screen } from "@testing-library/react-native";

import AppGroupLayout from "../_layout";

jest.mock("@/components/app-tabs", () => ({
  __esModule: true,
  default: () => {
    const { Text: RNText } = jest.requireActual("react-native");
    return <RNText testID="app-tabs">tabs</RNText>;
  },
}));

jest.mock("@/env/ActiveEnvironmentProvider", () => ({
  ActiveEnvironmentProvider: ({ children }: { children?: React.ReactNode }) => {
    const { View } = jest.requireActual("react-native");
    return <View testID="active-environment-provider">{children}</View>;
  },
}));

jest.mock("@/env/BoardProvider", () => ({
  BoardProvider: ({ children }: { children?: React.ReactNode }) => {
    const { View } = jest.requireActual("react-native");
    return <View testID="board-provider">{children}</View>;
  },
}));

test("wraps AppTabs with ActiveEnvironmentProvider > BoardProvider without breaking the tab navigator", () => {
  render(<AppGroupLayout />);

  const activeEnvProvider = screen.getByTestId("active-environment-provider");
  const boardProvider = screen.getByTestId("board-provider");
  const appTabs = screen.getByTestId("app-tabs");

  // BoardProvider must be nested inside ActiveEnvironmentProvider (it reads
  // useActiveEnvironment()), and AppTabs must still render as before.
  expect(activeEnvProvider).toContainElement(boardProvider);
  expect(boardProvider).toContainElement(appTabs);
});

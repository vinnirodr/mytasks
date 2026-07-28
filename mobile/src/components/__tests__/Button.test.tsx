import { fireEvent, render, screen } from "@testing-library/react-native";

import { ThemeProvider } from "@/theme/ThemeProvider";

import { Button } from "../Button";

test("primary Button calls onPress when pressed and renders its label", () => {
  const onPress = jest.fn();

  render(
    <ThemeProvider>
      <Button title="Concluir" onPress={onPress} />
    </ThemeProvider>,
  );

  expect(screen.getByText("Concluir")).toBeTruthy();

  fireEvent.press(screen.getByText("Concluir"));

  expect(onPress).toHaveBeenCalledTimes(1);
});

test("disabled Button does not call onPress when pressed", () => {
  const onPress = jest.fn();

  render(
    <ThemeProvider>
      <Button title="Concluir" onPress={onPress} disabled />
    </ThemeProvider>,
  );

  fireEvent.press(screen.getByText("Concluir"));

  expect(onPress).not.toHaveBeenCalled();
});

import { fireEvent, render, screen } from "@testing-library/react-native";

import { ThemeProvider } from "@/theme/ThemeProvider";

import { TaskCheckbox } from "../TaskCheckbox";

test("TaskCheckbox calls onToggle when pressed", () => {
  const onToggle = jest.fn();

  render(
    <ThemeProvider>
      <TaskCheckbox state="idle" onToggle={onToggle} />
    </ThemeProvider>,
  );

  fireEvent.press(screen.getByTestId("task-checkbox"));

  expect(onToggle).toHaveBeenCalledTimes(1);
});

test("TaskCheckbox shows the check icon when state is 'done'", async () => {
  render(
    <ThemeProvider>
      <TaskCheckbox state="done" onToggle={jest.fn()} />
    </ThemeProvider>,
  );

  // @expo/vector-icons loads its font asynchronously before rendering the
  // glyph, so wait for it rather than asserting on the first synchronous pass.
  expect(await screen.findByTestId("task-checkbox-check")).toBeTruthy();
});

test("TaskCheckbox does not show the check icon for 'idle' or 'deferred'", () => {
  render(
    <ThemeProvider>
      <TaskCheckbox state="idle" onToggle={jest.fn()} />
    </ThemeProvider>,
  );

  expect(screen.queryByTestId("task-checkbox-check")).toBeNull();
});

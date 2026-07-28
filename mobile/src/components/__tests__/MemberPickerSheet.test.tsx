import { fireEvent, render, screen } from "@testing-library/react-native";

import type { Member } from "@/api/members";
import { ThemeProvider } from "@/theme/ThemeProvider";

import { MemberPickerSheet } from "../MemberPickerSheet";

const marina: Member = {
  id: "mem-1",
  userId: "user-1",
  displayName: "Marina",
  initials: "MA",
  role: "ADMIN",
  isMe: true,
};

const pedro: Member = {
  id: "mem-2",
  userId: "user-2",
  displayName: "Pedro",
  initials: "PE",
  role: "MEMBER",
  isMe: false,
};

function renderSheet(props: Partial<Parameters<typeof MemberPickerSheet>[0]> = {}) {
  return render(
    <ThemeProvider>
      <MemberPickerSheet
        visible
        members={[marina, pedro]}
        currentUserId="user-1"
        onSelectMember={jest.fn()}
        onPickupForMe={jest.fn()}
        onClose={jest.fn()}
        {...props}
      />
    </ThemeProvider>,
  );
}

test("renders nothing when not visible", () => {
  renderSheet({ visible: false });
  expect(screen.queryByTestId("member-picker-sheet")).toBeNull();
});

test("lists members, marking the current user", () => {
  renderSheet();
  expect(screen.getByText("Marina (você)")).toBeTruthy();
  expect(screen.getByText("Pedro")).toBeTruthy();
});

test("pressing a member calls onSelectMember with that member", () => {
  const onSelectMember = jest.fn();
  renderSheet({ onSelectMember });

  fireEvent.press(screen.getByTestId("member-picker-member-user-2"));

  expect(onSelectMember).toHaveBeenCalledWith(pedro);
});

test("pressing 'Pegar para mim' calls onPickupForMe", () => {
  const onPickupForMe = jest.fn();
  renderSheet({ onPickupForMe });

  fireEvent.press(screen.getByTestId("member-picker-pickup"));

  expect(onPickupForMe).toHaveBeenCalledTimes(1);
});

test("pressing the scrim calls onClose", () => {
  const onClose = jest.fn();
  renderSheet({ onClose });

  fireEvent.press(screen.getByTestId("member-picker-scrim"));

  expect(onClose).toHaveBeenCalledTimes(1);
});

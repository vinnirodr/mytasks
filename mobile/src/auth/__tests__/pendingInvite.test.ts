import { setPendingInvite, takePendingInvite } from "../pendingInvite";

test("takePendingInvite returns null when nothing was stashed", () => {
  expect(takePendingInvite()).toBeNull();
});

test("takePendingInvite returns the stashed token and clears it", () => {
  setPendingInvite("abc123");

  expect(takePendingInvite()).toBe("abc123");
  expect(takePendingInvite()).toBeNull();
});

test("a later setPendingInvite replaces any previously stashed token", () => {
  setPendingInvite("first");
  setPendingInvite("second");

  expect(takePendingInvite()).toBe("second");
});

import { wsUrlFromApi } from "../config";

test("converts http to ws", () => {
  expect(wsUrlFromApi("http://localhost:8000")).toBe("ws://localhost:8000");
});

test("converts https to wss", () => {
  expect(wsUrlFromApi("https://api.example.com")).toBe("wss://api.example.com");
});

test("strips a trailing slash", () => {
  expect(wsUrlFromApi("http://localhost:8000/")).toBe("ws://localhost:8000");
});

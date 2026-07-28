import { useContext } from "react";

import { BoardContext, type BoardValue } from "./BoardProvider";

export function useBoard(): BoardValue {
  const ctx = useContext(BoardContext);
  if (!ctx) {
    throw new Error("useBoard() must be used within a <BoardProvider>.");
  }
  return ctx;
}

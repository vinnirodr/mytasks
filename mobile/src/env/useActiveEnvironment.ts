import { useContext } from "react";

import { ActiveEnvironmentContext, type ActiveEnvironmentValue } from "./ActiveEnvironmentProvider";

export function useActiveEnvironment(): ActiveEnvironmentValue {
  const ctx = useContext(ActiveEnvironmentContext);
  if (!ctx) {
    throw new Error("useActiveEnvironment() must be used within an <ActiveEnvironmentProvider>.");
  }
  return ctx;
}

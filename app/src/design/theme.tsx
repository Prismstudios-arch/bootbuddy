import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { useAppStore } from "@/state/app-store";
import { darkTheme, lightTheme, type Theme } from "./tokens";

const ThemeContext = createContext<Theme>(darkTheme);

/**
 * Resolves the active theme from the user's in-app preference (Settings →
 * Appearance) falling back to the OS scheme. Dark is the default brand
 * experience; light mode is fully supported, not an afterthought.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const preference = useAppStore((s) => s.appearance);

  const theme = useMemo(() => {
    const scheme = preference === "system" ? (systemScheme ?? "dark") : preference;
    return scheme === "light" ? lightTheme : darkTheme;
  }, [preference, systemScheme]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

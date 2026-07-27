import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Appearance = "system" | "dark" | "light";

type AppState = {
  appearance: Appearance;
  /** Default selling-fee % used when estimating profit (eBay ≈ 13). */
  defaultFeePercent: number;
  hasOnboarded: boolean;
  setAppearance: (a: Appearance) => void;
  setDefaultFeePercent: (pct: number) => void;
  completeOnboarding: () => void;
};

/**
 * Small persisted store for device-local preferences. Server data (scans,
 * finds, stats) never lives here — that's react-query's job, so it gets
 * caching, retries and offline behaviour for free.
 */
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      appearance: "system",
      defaultFeePercent: 13,
      hasOnboarded: false,
      setAppearance: (appearance) => set({ appearance }),
      setDefaultFeePercent: (defaultFeePercent) => set({ defaultFeePercent }),
      completeOnboarding: () => set({ hasOnboarded: true }),
    }),
    {
      name: "bsb-app-store",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

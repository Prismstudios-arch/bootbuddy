import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
  useFonts,
} from "@expo-google-fonts/space-grotesk";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import Animated, { FadeIn } from "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Onboarding } from "@/components/onboarding";
import { ThemeProvider, useTheme } from "@/design/theme";
import { motion } from "@/design/tokens";
import { queryClient } from "@/lib/query-client";
import { usePurchasesIdentity } from "@/purchases/use-purchases-identity";
import { useAppStore } from "@/state/app-store";

// Splash stays up until fonts are ready — no flash of fallback type.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ThemedShell />
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function ThemedShell() {
  const theme = useTheme();
  const hasOnboarded = useAppStore((s) => s.hasOnboarded);
  // Identify the buyer to the store as soon as we know who they are.
  usePurchasesIdentity();

  return (
    <>
      <StatusBar style={theme.scheme === "dark" ? "light" : "dark"} />
      {/* Onboarding replaces the whole shell on first launch rather than
          sitting on a route, so there's no way to swipe back into a
          half-set-up app — and no flash of the camera permission prompt
          before we've explained why we want it. */}
      {hasOnboarded ? (
        // Fades in rather than cutting: finishing onboarding should feel
        // like the app arriving, not like the screen glitching.
        <Animated.View style={{ flex: 1 }} entering={FadeIn.duration(motion.slow)}>
          <Stack
            screenOptions={{
              headerShown: false,
              // An explicit iOS-style push rather than the platform default,
              // so a pushed screen moves at the same 240ms ease-out as
              // everything else. Consistency is what makes motion read as
              // intentional rather than incidental.
              animation: "slide_from_right",
              animationDuration: motion.base,
              contentStyle: { backgroundColor: theme.color.bg },
            }}
          />
        </Animated.View>
      ) : (
        <Onboarding />
      )}
    </>
  );
}

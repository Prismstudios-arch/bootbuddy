import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Bottom padding a scrolling tab screen needs so its last row isn't hidden
 * behind the tab bar.
 *
 * Expo Router 57 dropped React Navigation, so `useBottomTabBarHeight` is
 * gone. Rather than add a dependency whose provider no longer exists, we
 * compute it: iOS tab bars are 49pt of chrome sitting above the home
 * indicator, and the safe-area inset is exactly that indicator's height.
 */
const TAB_BAR_CHROME = 49;

export function useTabBarHeight(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_CHROME + insets.bottom;
}

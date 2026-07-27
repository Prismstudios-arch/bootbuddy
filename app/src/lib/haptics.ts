import * as Haptics from "expo-haptics";

/**
 * Semantic haptics — call sites say what happened, not which vibration to
 * play, so the physical language stays consistent app-wide:
 *   tap        — tab switches, toggles
 *   confirm    — buy logged, setting saved
 *   scanDone   — scan result arrived
 *   greatFind  — gold-tier discovery (pairs with the gold accent)
 *   warn       — quota hit, validation nudge
 *   fail       — request failed
 */
export const haptic = {
  tap: () => Haptics.selectionAsync(),
  confirm: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  scanDone: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  greatFind: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  warn: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  fail: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
};

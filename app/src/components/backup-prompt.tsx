import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSession } from "@/api/scans";
import { useTheme } from "@/design/theme";
import { motion, radius, space } from "@/design/tokens";
import { currentAccessToken } from "@/lib/api";
import { isAppleSignInAvailable, signInWithApple } from "@/lib/apple-auth";
import { haptic } from "@/lib/haptics";
import { useAppStore } from "@/state/app-store";
import { Button } from "./button";
import { Type } from "./type";

/**
 * A nudge to back up, once there's something worth losing.
 *
 * Accounts are anonymous and live in the Keychain. On iOS that usually
 * survives deleting the app — but not a new phone, and not every restore.
 * Someone who loses two years of profit history because the only route to
 * back it up was buried in Settings has been failed by the app, not by
 * their own carelessness.
 *
 * So it waits until there are a few finds (nagging an empty portfolio is
 * pointless), states the actual risk rather than a vague "sign in for more
 * features", and dismisses permanently on request. It is deliberately not
 * a blocker, a modal, or a thing that reappears.
 */
const FINDS_BEFORE_PROMPTING = 3;

export function BackupPrompt({ findCount }: { findCount: number }) {
  const theme = useTheme();
  const session = useSession();
  const dismissed = useAppStore((s) => s.dismissedBackupPrompt);
  const dismiss = useAppStore((s) => s.dismissBackupPrompt);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  // In an effect, not during render: firing an async call from the render
  // body can run several times before the state settles.
  useEffect(() => {
    void isAppleSignInAvailable().then(setAvailable);
  }, []);

  const signedIn = session.data?.user.signedIn ?? false;
  if (signedIn || dismissed || !available || findCount < FINDS_BEFORE_PROMPTING) {
    return null;
  }

  const signIn = async () => {
    setBusy(true);
    const outcome = await signInWithApple(await currentAccessToken());
    setBusy(false);
    if (outcome.status === "signed_in") {
      haptic.confirm();
      void session.refetch();
    } else if (outcome.status === "error") {
      haptic.fail();
      Alert.alert("Couldn't sign in", outcome.message);
    }
  };

  return (
    <Animated.View
      entering={FadeIn.duration(motion.base)}
      exiting={FadeOut.duration(motion.fast)}
      style={{
        backgroundColor: theme.color.surface,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: theme.color.border,
        padding: space.lg,
        marginBottom: space.sm,
        gap: space.md,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.md }}>
        <Ionicons name="cloud-upload-outline" size={22} color={theme.color.gold} />
        <View style={{ flex: 1, gap: space.xs }}>
          <Type variant="headline">Back up your finds</Type>
          <Type variant="caption" tone="secondary" style={{ lineHeight: 19 }}>
            {findCount} {findCount === 1 ? "find is" : "finds are"} saved to this device only. Sign
            in and they follow you to a new phone.
          </Type>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss backup reminder"
          hitSlop={12}
          onPress={() => {
            haptic.tap();
            dismiss();
          }}
        >
          <Ionicons name="close" size={20} color={theme.color.textTertiary} />
        </Pressable>
      </View>

      <Button
        label={busy ? "Signing in…" : "Sign in with Apple"}
        onPress={() => void signIn()}
        disabled={busy}
      />
    </Animated.View>
  );
}

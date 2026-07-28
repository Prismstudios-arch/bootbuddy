import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import { useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRecentScans, useScanMutation, type Scan } from "@/api/scans";
import { BuyLogSheet } from "@/components/buy-log-sheet";
import { Button } from "@/components/button";
import { Paywall } from "@/components/paywall";
import { Pill } from "@/components/pill";
import { ResultSheet } from "@/components/result-sheet";
import { Screen } from "@/components/screen";
import { Type } from "@/components/type";
import { useTheme } from "@/design/theme";
import { radius, space } from "@/design/tokens";
import { ApiError } from "@/lib/api";
import { haptic } from "@/lib/haptics";
import { compressForUpload } from "@/lib/image";
import { formatPenceCompact } from "@/lib/money";

/**
 * Scan — the home tab, and the whole product in one screen. Full-bleed
 * camera, one unmissable shutter, torch, recent-scans strip. After the
 * shutter: freeze the frame, shimmer, then the Result Sheet slides up.
 */
/**
 * Explicit phases rather than deriving the sheet's state from the mutation
 * flags. Deriving it left a gap: between opening the sheet and the mutation
 * actually starting (photo compression takes a beat on a 12MP image) the
 * mutation was idle — not pending, not errored, no data — so the sheet
 * rendered as an empty box. "closed → shooting → uploading" makes that
 * window an honest loading state.
 */
type Phase =
  | { kind: "closed" }
  | { kind: "working"; uri: string }
  | { kind: "failed"; message: string; uri: string | null };

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "closed" });
  const [buying, setBuying] = useState<Scan | null>(null);
  const [revisiting, setRevisiting] = useState<Scan | null>(null);
  const [paywall, setPaywall] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const scan = useScanMutation();
  const recent = useRecentScans();

  const upload = (uri: string) => {
    setPhase({ kind: "working", uri });
    compressForUpload(uri)
      .then((base64) => {
        scan.mutate(base64, {
          onSuccess: () => haptic.scanDone(),
          onError: (error) => {
            // Out of scans isn't a failure — it's the upgrade moment.
            if (error instanceof ApiError && error.isQuota) {
              haptic.warn();
              setPhase({ kind: "closed" });
              setPaywall(true);
            } else {
              haptic.fail();
            }
          },
        });
      })
      .catch(() => {
        // Never swallow this silently — a dead shutter with no explanation
        // is indistinguishable from a broken app.
        haptic.fail();
        setPhase({
          kind: "failed",
          message: "Couldn't process that photo. Give it another go?",
          uri,
        });
      });
  };

  const capture = async () => {
    if (!cameraRef.current || phase.kind === "working") return;
    haptic.confirm();
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (!photo?.uri) throw new Error("no photo returned");
      upload(photo.uri);
    } catch {
      haptic.fail();
      setPhase({
        kind: "failed",
        message: "The camera didn't catch that. Try again?",
        uri: null,
      });
    }
  };

  const dismiss = () => {
    setPhase({ kind: "closed" });
    scan.reset();
  };

  const retry = () => {
    const uri = phase.kind === "failed" ? phase.uri : phase.kind === "working" ? phase.uri : null;
    if (uri) {
      scan.reset();
      upload(uri);
    } else {
      dismiss();
    }
  };

  const sheetOpen = phase.kind !== "closed";
  const frozenUri = phase.kind === "closed" ? null : phase.uri;
  // The sheet is loading from the instant it opens until the API answers.
  const sheetState =
    phase.kind === "failed" || scan.isError
      ? "error"
      : scan.isSuccess
        ? "success"
        : "loading";
  const errorMessage =
    phase.kind === "failed"
      ? phase.message
      : scan.error instanceof ApiError
        ? scan.error.message
        : undefined;

  if (!permission) {
    return <CameraBooting />;
  }
  if (!permission.granted) {
    return (
      <PermissionGate
        canAsk={permission.canAskAgain}
        onAsk={async () => {
          haptic.tap();
          await requestPermission();
        }}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {frozenUri ? (
        <Image source={{ uri: frozenUri }} style={{ flex: 1 }} contentFit="cover" transition={120} />
      ) : (
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" enableTorch={torch} />
      )}

      {!sheetOpen ? (
        <CameraControls
          torch={torch}
          onToggleTorch={() => {
            haptic.tap();
            setTorch((t) => !t);
          }}
          onCapture={capture}
          recentScans={recent.data ?? []}
          onOpenRecent={(item) => {
            haptic.tap();
            setRevisiting(item);
          }}
        />
      ) : null}

      {revisiting ? (
        <ResultSheet
          state="success"
          scan={revisiting}
          onClose={() => setRevisiting(null)}
          onRetry={() => setRevisiting(null)}
          onBought={(bought) => {
            setRevisiting(null);
            setBuying(bought);
          }}
        />
      ) : null}

      {sheetOpen ? (
        <ResultSheet
          state={sheetState}
          {...(scan.data?.scan ? { scan: scan.data.scan } : {})}
          {...(scan.data?.quota ? { quota: scan.data.quota } : {})}
          {...(errorMessage ? { errorMessage } : {})}
          onClose={dismiss}
          onRetry={retry}
          onBought={(bought) => setBuying(bought)}
        />
      ) : null}

      {buying ? (
        <BuyLogSheet
          scan={buying}
          onClose={() => setBuying(null)}
          onLogged={() => {
            haptic.scanDone();
            setBuying(null);
            dismiss();
          }}
        />
      ) : null}

      {paywall ? (
        <Paywall
          reason="quota"
          onClose={() => {
            setPaywall(false);
            scan.reset();
          }}
        />
      ) : null}
    </View>
  );
}

/** Only rendered while the sheet is closed, so the shutter is never busy —
 *  the Result Sheet owns the loading state once a capture is under way. */
function CameraControls({
  torch,
  onToggleTorch,
  onCapture,
  recentScans,
  onOpenRecent,
}: {
  torch: boolean;
  onToggleTorch: () => void;
  onCapture: () => void;
  recentScans: Scan[];
  onOpenRecent: (scan: Scan) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Animated.View
      entering={FadeIn.duration(240)}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingBottom: insets.bottom + space.md,
        gap: space.md,
      }}
    >
      {recentScans.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: space.gutter, gap: space.sm }}
        >
          {recentScans.slice(0, 8).map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`Reopen ${item.name ?? "unknown item"}`}
              accessibilityHint="Shows what this scan was worth"
              onPress={() => onOpenRecent(item)}
              style={({ pressed }) => ({
                backgroundColor: pressed ? "rgba(61,220,132,0.25)" : "rgba(18,17,16,0.72)",
                borderRadius: radius.pill,
                paddingVertical: space.xs,
                paddingHorizontal: space.md,
                maxWidth: 220,
              })}
            >
              <Type variant="caption" style={{ color: "#F5F2ED" }} numberOfLines={1}>
                {item.name ?? "Unknown"}
                {item.askingPrices ? ` · ${formatPenceCompact(item.askingPrices.medianPence)}` : ""}
              </Type>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-evenly" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={torch ? "Turn torch off" : "Turn torch on"}
          accessibilityState={{ selected: torch }}
          onPress={onToggleTorch}
          style={{
            width: 48,
            height: 48,
            borderRadius: radius.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: torch ? theme.color.gold : "rgba(18,17,16,0.55)",
          }}
        >
          <Ionicons
            name="flashlight"
            size={22}
            color={torch ? theme.color.textOnFill : "#F5F2ED"}
          />
        </Pressable>

        {/* 76pt shutter — findable with cold thumbs, one-handed. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Scan item"
          accessibilityHint="Takes a photo and looks up what it sells for"
          onPress={onCapture}
          style={{
            width: 76,
            height: 76,
            borderRadius: radius.pill,
            borderWidth: 4,
            borderColor: "#F5F2ED",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: radius.pill,
              backgroundColor: "#F5F2ED",
            }}
          />
        </Pressable>

        <View style={{ width: 48 }} />
      </View>
    </Animated.View>
  );
}

function CameraBooting() {
  const theme = useTheme();
  return (
    <Screen style={{ alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={theme.color.textSecondary} />
    </Screen>
  );
}

/**
 * Pre-permission explainer — we ask for the camera only after saying why,
 * and a denial is never a dead end: it becomes a one-tap route to Settings.
 */
function PermissionGate({ canAsk, onAsk }: { canAsk: boolean; onAsk: () => void }) {
  const theme = useTheme();

  return (
    <Screen style={{ justifyContent: "center", gap: space.lg }}>
      <View style={{ alignItems: "center", gap: space.md }}>
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: radius.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.color.surface,
          }}
        >
          <Ionicons name="camera-outline" size={40} color={theme.color.gold} />
        </View>
        <Type variant="title" style={{ textAlign: "center" }}>
          {canAsk ? "Let's see it, then" : "Camera's switched off"}
        </Type>
        <Type tone="secondary" style={{ textAlign: "center", maxWidth: 300 }}>
          {canAsk
            ? "Boot Sale Buddy needs the camera to identify what you're holding and price it up. Photos are never stored on our servers."
            : "Turn the camera back on in Settings and you're away."}
        </Type>
        <Pill label="Photos processed, then binned" />
      </View>
      <Button
        label={canAsk ? "Allow camera" : "Open Settings"}
        onPress={canAsk ? onAsk : () => void Linking.openSettings().catch(() => undefined)}
      />
    </Screen>
  );
}

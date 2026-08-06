import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useIsFocused } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";
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
import { motion, radius, space } from "@/design/tokens";
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
  const [buying, setBuying] = useState<{ scan: Scan; photoUri: string | null } | null>(null);
  const [revisiting, setRevisiting] = useState<Scan | null>(null);
  const [paywall, setPaywall] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  // The camera stays mounted but stops capturing off-tab. Unmounting it
  // would mean a black warm-up flash every time you come back from My Finds,
  // which on a boot sale morning is dozens of times; leaving it running
  // would cook the phone and flatten the battery by eleven.
  const focused = useIsFocused();

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

  /**
   * Price up a photo you already have. Boot sales are chaotic — people snap
   * a whole table and sort it out in the car afterwards — and it's also the
   * only way in if the camera permission was denied.
   */
  const pickFromLibrary = async () => {
    if (phase.kind === "working") return;
    haptic.tap();
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.9,
      });
      if (result.canceled) return;
      const uri = result.assets[0]?.uri;
      if (!uri) throw new Error("no asset returned");
      upload(uri);
    } catch {
      haptic.fail();
      setPhase({
        kind: "failed",
        message: "Couldn't open your photos. Try again?",
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

  const cameraReady = permission?.granted === true;

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {/* The permission gate is a state of this screen rather than a
          replacement for it, so a denied camera still leaves you a working
          app: pick a photo from the library and everything downstream — the
          result sheet, logging the buy — carries on as normal. */}
      {frozenUri ? (
        <Image source={{ uri: frozenUri }} style={{ flex: 1 }} contentFit="cover" transition={120} />
      ) : !permission ? (
        <CameraBooting />
      ) : !permission.granted ? (
        <PermissionGate
          canAsk={permission.canAskAgain}
          onAsk={async () => {
            haptic.tap();
            await requestPermission();
          }}
          onPickPhoto={() => void pickFromLibrary()}
        />
      ) : (
        <>
          <CameraView
            ref={cameraRef}
            style={{ flex: 1 }}
            facing="back"
            active={focused}
            enableTorch={torch && focused}
          />
          {!sheetOpen ? <FramingGuide hasScanned={(recent.data?.length ?? 0) > 0} /> : null}
        </>
      )}

      {cameraReady && !sheetOpen ? (
        <CameraControls
          torch={torch}
          onToggleTorch={() => {
            haptic.tap();
            setTorch((t) => !t);
          }}
          onCapture={capture}
          onPickPhoto={() => void pickFromLibrary()}
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
            setBuying({ scan: bought, photoUri: null });
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
          onBought={(bought) => setBuying({ scan: bought, photoUri: frozenUri })}
        />
      ) : null}

      {buying ? (
        <BuyLogSheet
          scan={buying.scan}
          photoUri={buying.photoUri}
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
  onPickPhoto,
  recentScans,
  onOpenRecent,
}: {
  torch: boolean;
  onToggleTorch: () => void;
  onCapture: () => void;
  onPickPhoto: () => void;
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

        {/* Mirrors the torch button so the shutter stays dead centre. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Price up a photo from your library"
          accessibilityHint="Opens your photos so you can scan one you took earlier"
          onPress={onPickPhoto}
          style={({ pressed }) => ({
            width: 48,
            height: 48,
            borderRadius: radius.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? "rgba(245,242,237,0.3)" : "rgba(18,17,16,0.55)",
          })}
        >
          <Ionicons name="images-outline" size={22} color="#F5F2ED" />
        </Pressable>
      </View>
    </Animated.View>
  );
}

/**
 * Framing guide. A bare viewfinder gives no clue what a good scan looks
 * like, and the model reads model numbers far better off one well-framed
 * item than off a whole table. Brackets rather than a full box so the view
 * stays open, and the hint retires once you've actually scanned something.
 */
function FramingGuide({ hasScanned }: { hasScanned: boolean }) {
  const { width } = useWindowDimensions();
  const size = Math.min(width * 0.72, 300);
  const corner = 34;
  const thickness = 3;
  const colour = "rgba(245,242,237,0.85)";

  const bracket = (position: "tl" | "tr" | "bl" | "br") => {
    const isTop = position === "tl" || position === "tr";
    const isLeft = position === "tl" || position === "bl";
    return (
      <View
        key={position}
        style={{
          position: "absolute",
          width: corner,
          height: corner,
          ...(isTop ? { top: 0 } : { bottom: 0 }),
          ...(isLeft ? { left: 0 } : { right: 0 }),
          ...(isTop
            ? { borderTopWidth: thickness, borderTopColor: colour }
            : { borderBottomWidth: thickness, borderBottomColor: colour }),
          ...(isLeft
            ? { borderLeftWidth: thickness, borderLeftColor: colour }
            : { borderRightWidth: thickness, borderRightColor: colour }),
          ...(isTop && isLeft ? { borderTopLeftRadius: radius.card } : {}),
          ...(isTop && !isLeft ? { borderTopRightRadius: radius.card } : {}),
          ...(!isTop && isLeft ? { borderBottomLeftRadius: radius.card } : {}),
          ...(!isTop && !isLeft ? { borderBottomRightRadius: radius.card } : {}),
        }}
      />
    );
  };

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Animated.View
        entering={FadeIn.duration(motion.slow)}
        style={{ width: size, height: size }}
      >
        {(["tl", "tr", "bl", "br"] as const).map(bracket)}
      </Animated.View>

      {!hasScanned ? (
        <Animated.View
          entering={FadeIn.delay(400).duration(motion.slow)}
          style={{
            marginTop: space.xl,
            backgroundColor: "rgba(18,17,16,0.72)",
            borderRadius: radius.pill,
            paddingVertical: space.sm,
            paddingHorizontal: space.lg,
          }}
        >
          <Type variant="caption" style={{ color: "#F5F2ED" }}>
            One item, fill the frame — labels help
          </Type>
        </Animated.View>
      ) : null}
    </View>
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
function PermissionGate({
  canAsk,
  onAsk,
  onPickPhoto,
}: {
  canAsk: boolean;
  onAsk: () => void;
  onPickPhoto: () => void;
}) {
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
      <View style={{ gap: space.sm }}>
        {/* "Continue", never "Allow". A custom screen that asks you to press
            Allow before iOS has asked anything is Apple steering the answer
            on their behalf, and 5.1.1(iv) is explicit about it — this exact
            button cost version 1.0 a rejection. The screen explains why we
            want the camera; the system prompt asks the question. */}
        <Button
          label={canAsk ? "Continue" : "Open Settings"}
          onPress={canAsk ? onAsk : () => void Linking.openSettings().catch(() => undefined)}
        />
        {/* Never a dead end: without the camera you can still price up a
            photo you already have, and the rest of the app works as normal. */}
        <Button label="Use a photo instead" variant="ghost" onPress={onPickPhoto} />
      </View>
    </Screen>
  );
}

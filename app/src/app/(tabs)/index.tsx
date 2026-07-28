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
export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [frozenUri, setFrozenUri] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [buying, setBuying] = useState<Scan | null>(null);
  const [paywall, setPaywall] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const scan = useScanMutation();
  const recent = useRecentScans();

  const capture = async () => {
    if (!cameraRef.current || scan.isPending) return;
    haptic.confirm();
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (!photo?.uri) return;
      setFrozenUri(photo.uri);
      setSheetOpen(true);
      const base64 = await compressForUpload(photo.uri);
      scan.mutate(base64, {
        onSuccess: () => haptic.scanDone(),
        onError: (error) => {
          haptic.warn();
          // Out of scans isn't a failure — it's the upgrade moment.
          if (error instanceof ApiError && error.isQuota) {
            setSheetOpen(false);
            setFrozenUri(null);
            setPaywall(true);
          }
        },
      });
    } catch {
      haptic.fail();
      setFrozenUri(null);
      setSheetOpen(false);
    }
  };

  const dismiss = () => {
    setSheetOpen(false);
    setFrozenUri(null);
    scan.reset();
  };

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
          busy={scan.isPending}
          recentScans={recent.data ?? []}
        />
      ) : null}

      {sheetOpen ? (
        <ResultSheet
          state={scan.isPending ? "loading" : scan.isError ? "error" : "success"}
          {...(scan.data?.scan ? { scan: scan.data.scan } : {})}
          {...(scan.data?.quota ? { quota: scan.data.quota } : {})}
          {...(scan.error instanceof ApiError ? { errorMessage: scan.error.message } : {})}
          onClose={dismiss}
          onRetry={() => {
            if (frozenUri) {
              void compressForUpload(frozenUri).then((b64) => scan.mutate(b64));
            }
          }}
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

function CameraControls({
  torch,
  onToggleTorch,
  onCapture,
  busy,
  recentScans,
}: {
  torch: boolean;
  onToggleTorch: () => void;
  onCapture: () => void;
  busy: boolean;
  recentScans: Scan[];
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
            <View
              key={item.id}
              style={{
                backgroundColor: "rgba(18,17,16,0.72)",
                borderRadius: radius.pill,
                paddingVertical: space.xs,
                paddingHorizontal: space.md,
              }}
            >
              <Type variant="caption" style={{ color: "#F5F2ED" }} numberOfLines={1}>
                {item.name ?? "Unknown"}
                {item.askingPrices ? ` · ${formatPenceCompact(item.askingPrices.medianPence)}` : ""}
              </Type>
            </View>
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
          accessibilityState={{ busy }}
          onPress={onCapture}
          disabled={busy}
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
          {busy ? (
            <ActivityIndicator color="#F5F2ED" />
          ) : (
            <View
              style={{
                width: 60,
                height: 60,
                borderRadius: radius.pill,
                backgroundColor: "#F5F2ED",
              }}
            />
          )}
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
        onPress={canAsk ? onAsk : () => void Linking.openSettings()}
      />
    </Screen>
  );
}

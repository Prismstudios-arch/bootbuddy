import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useMemo } from "react";
import { View } from "react-native";
import { useTheme } from "@/design/theme";
import { radius } from "@/design/tokens";
import { findPhotoUri } from "@/lib/photos";

/**
 * A find's photo, falling back to an icon when there isn't one — items
 * logged before photos existed, or after a reinstall, still look
 * deliberate rather than broken.
 */
export function FindThumbnail({
  findId,
  sold,
  size = 44,
  cornerRadius = radius.card,
}: {
  findId: string;
  sold: boolean;
  size?: number;
  cornerRadius?: number;
}) {
  const theme = useTheme();
  // Reading the filesystem is synchronous and cheap, but pointless to redo
  // on every re-render of a scrolling list.
  const uri = useMemo(() => findPhotoUri(findId), [findId]);

  if (uri) {
    return (
      <Image
        source={{ uri }}
        accessibilityIgnoresInvertColors
        style={{
          width: size,
          height: size,
          borderRadius: cornerRadius,
          backgroundColor: theme.color.surfaceRaised,
        }}
        contentFit="cover"
        transition={150}
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: cornerRadius,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.color.surfaceRaised,
      }}
    >
      <Ionicons
        name={sold ? "checkmark-done" : "cube-outline"}
        size={size * 0.45}
        color={sold ? theme.color.profit : theme.color.textTertiary}
      />
    </View>
  );
}

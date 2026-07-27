import { View, type ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/design/theme";
import { space } from "@/design/tokens";

type Props = ViewProps & {
  /** Full-bleed screens (camera) opt out of gutters and top inset. */
  edgeToEdge?: boolean;
};

/** Standard screen chrome: themed background, safe-area top, gutters. */
export function Screen({ edgeToEdge = false, style, children, ...rest }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      {...rest}
      style={[
        {
          flex: 1,
          backgroundColor: theme.color.bg,
        },
        !edgeToEdge && {
          paddingTop: insets.top + space.sm,
          paddingHorizontal: space.gutter,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

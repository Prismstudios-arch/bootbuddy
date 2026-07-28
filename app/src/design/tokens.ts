/**
 * Boot Sale Buddy design tokens.
 *
 * The mood: a trading app for treasure hunters — Monzo × Robinhood × flea
 * market. Dark-first because the app lives outdoors in a fist at 7am, and a
 * near-black screen with one huge green number is legible in low sun where
 * a white UI is a mirror.
 *
 * Rules that keep this from going "template":
 *  - Components import { useTheme } — never `palette` directly. Semantic
 *    names only, so light mode is a data change, not a refactor.
 *  - Profit green is reserved for money-positive moments. It is not a brand
 *    colour to sprinkle on buttons; the accent for interactive chrome is the
 *    warm text colour itself.
 *  - Gold appears only on "that's a find" moments (great margin, best flip).
 *  - Every spacing/radius value on screen comes from these scales. No naked
 *    numbers in styles.
 */

// ---------------------------------------------------------------------------
// Raw palette — private. Only theme objects below may reference these.
// ---------------------------------------------------------------------------
const palette = {
  // Warm near-blacks (never pure #000 — pure black kills the warmth and
  // makes OLED smearing visible when scrolling).
  coal900: "#121110",
  coal800: "#1C1A18",
  coal700: "#26231F",
  coal600: "#33302A",

  // Warm off-whites (never pure #FFF on dark).
  bone100: "#F5F2ED",
  bone300: "#CFC9C0",
  bone500: "#9C968E",
  bone700: "#6E675E",

  // Light-mode paper
  paper50: "#FAF7F2",
  paper0: "#FFFFFF",
  paperLine: "#E7E1D8",

  // Profit green family — money-positive only
  green400: "#3DDC84",
  green500: "#2BBE6E",
  green900: "#0E2A1B", // tinted surface behind positive chips

  // Loss
  red400: "#FF5D5D",
  red900: "#331516",

  // "Great find" gold
  gold400: "#E8B14E",
  gold900: "#33270F",
} as const;

// ---------------------------------------------------------------------------
// Semantic themes
// ---------------------------------------------------------------------------
export type Theme = {
  scheme: "dark" | "light";
  color: {
    /** Screen background */
    bg: string;
    /** Cards, sheets, list rows */
    surface: string;
    /** Elevated-on-surface: inputs, nested chips */
    surfaceRaised: string;
    /** Pressed state of a surface */
    surfacePressed: string;
    /** Hairline separators */
    border: string;

    textPrimary: string;
    textSecondary: string;
    textTertiary: string;
    /** Text on top of a filled profit/danger element */
    textOnFill: string;

    /** Money-positive number, unrealised/realised profit */
    profit: string;
    /** Tinted background behind a profit chip */
    profitSurface: string;
    loss: string;
    lossSurface: string;
    /** "That's a find" moments only */
    gold: string;
    goldSurface: string;

    /** Interactive chrome: active tab, primary button fill */
    accent: string;
    /** Text/icon on the accent fill */
    onAccent: string;

    /** Camera shutter ring + scrim, stable across themes */
    shutter: string;
    scrim: string;
  };
};

export const darkTheme: Theme = {
  scheme: "dark",
  color: {
    bg: palette.coal900,
    surface: palette.coal800,
    surfaceRaised: palette.coal700,
    surfacePressed: palette.coal600,
    border: palette.coal700,

    textPrimary: palette.bone100,
    textSecondary: palette.bone500,
    textTertiary: palette.bone700,
    textOnFill: palette.coal900,

    profit: palette.green400,
    profitSurface: palette.green900,
    loss: palette.red400,
    lossSurface: palette.red900,
    gold: palette.gold400,
    goldSurface: palette.gold900,

    accent: palette.bone100,
    onAccent: palette.coal900,

    shutter: palette.bone100,
    scrim: "rgba(18, 17, 16, 0.72)",
  },
};

export const lightTheme: Theme = {
  scheme: "light",
  color: {
    bg: palette.paper50,
    surface: palette.paper0,
    surfaceRaised: palette.paper50,
    surfacePressed: palette.paperLine,
    border: palette.paperLine,

    textPrimary: palette.coal800,
    textSecondary: palette.bone700,
    textTertiary: palette.bone500,
    textOnFill: palette.bone100,

    profit: palette.green500,
    profitSurface: "#E2F6EB",
    loss: "#E04848",
    lossSurface: "#FBE9E9",
    gold: "#C08A2D",
    goldSurface: "#F8EEDB",

    accent: palette.coal800,
    onAccent: palette.bone100,

    shutter: palette.bone100,
    scrim: "rgba(18, 17, 16, 0.55)",
  },
};

// ---------------------------------------------------------------------------
// Spacing — 4pt scale. Names, not numbers, at call sites.
// ---------------------------------------------------------------------------
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  /** Screen gutter */
  gutter: 20,
} as const;

// ---------------------------------------------------------------------------
// Radius — 12 cards / 20 sheets / pill. Consistency here is exactly what
// separates "designed" from "vibe coded".
// ---------------------------------------------------------------------------
export const radius = {
  card: 12,
  sheet: 20,
  pill: 999,
} as const;

// ---------------------------------------------------------------------------
// Typography. Display face = Space Grotesk (OFL licence — chosen over Clash
// Display, whose Fontshare licence is murkier for app embedding). Body = the
// system face (SF Pro on iOS). Prices are ALWAYS fontVariant tabular-nums so
// counting-up animations don't jitter.
// ---------------------------------------------------------------------------
export const font = {
  display: "SpaceGrotesk_700Bold",
  displayMedium: "SpaceGrotesk_500Medium",
} as const;

export const type = {
  /** The one huge price on the result sheet / profit tab */
  hero: { fontFamily: font.display, fontSize: 56, lineHeight: 68, letterSpacing: -1 },
  /** Screen-level numbers and headlines */
  display: { fontFamily: font.display, fontSize: 34, lineHeight: 44, letterSpacing: -0.5 },
  /** Section titles */
  title: { fontFamily: font.displayMedium, fontSize: 22, lineHeight: 30 },
  /** Row titles, button labels (system semibold) */
  headline: { fontSize: 17, lineHeight: 22, fontWeight: "600" as const },
  /** Default reading text (system) */
  body: { fontSize: 16, lineHeight: 22 },
  caption: { fontSize: 13, lineHeight: 18 },
  /** Uppercase micro-labels above numbers */
  label: {
    fontFamily: font.displayMedium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: "uppercase" as const,
  },
} as const;

export type TypeVariant = keyof typeof type;

// ---------------------------------------------------------------------------
// Motion — 200–300ms ease-out on everything. Reveals (price count-up) sit at
// the slow end; taps at the fast end. Skeleton shimmer, never spinners, on
// content areas.
// ---------------------------------------------------------------------------
export const motion = {
  fast: 160,
  base: 240,
  slow: 320,
  /** Result-sheet price count-up duration */
  reveal: 700,
} as const;

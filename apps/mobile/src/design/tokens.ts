/**
 * Design rules v1 values for the app (design/DESIGN_RULES.md: colours §2, app text styles §3.2, spacing §4,
 * sizes §5, corners §6.2). Screens take colours and text styles only from here; src/design/tokens.test.ts
 * fails on any other colour or text style literal.
 */
export const color = {
  page: "#F2F2F7",
  surface: "#FFFFFF",
  text: "#202632",
  textSecondary: "#636771",
  textInverse: "#FFFFFF",
  border: "rgba(32,38,50,0.12)",
  borderStrong: "rgba(32,38,50,0.20)",
  borderControl: "#868B95",
  fillSubtle: "rgba(32,38,50,0.04)",
  primary: "#0064FF",
  primarySoft: "rgba(0,100,255,0.08)",
  danger: "#FF3B30",
  dangerSoft: "rgba(255,59,48,0.08)",
} as const;

/** Status labels: dark text on a light fill, always together with the status name (§2.3). */
export const status = {
  urgent: { color: "#C8231A", backgroundColor: "#FFF0EF" },
  waiting: { color: "#9A5B00", backgroundColor: "#FFF3DC" },
  progress: { color: "#0056D8", backgroundColor: "#EEF4FF" },
  done: { color: "#17754F", backgroundColor: "#E7F5EE" },
  neutral: { color: color.textSecondary, backgroundColor: color.fillSubtle },
} as const;

/** The app table of §3.2. React Native takes letter spacing in points. */
export const text = {
  title: { fontSize: 24, lineHeight: 32, fontWeight: "700", letterSpacing: -0.5 },
  heading: { fontSize: 20, lineHeight: 28, fontWeight: "600", letterSpacing: -0.4 },
  subheading: { fontSize: 16, lineHeight: 24, fontWeight: "600", letterSpacing: -0.2 },
  body: { fontSize: 16, lineHeight: 24, fontWeight: "400", letterSpacing: -0.2 },
  label: { fontSize: 16, lineHeight: 24, fontWeight: "600", letterSpacing: -0.2 },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "400", letterSpacing: 0 },
} as const;

/**
 * Single-line inputs use the body style without its line height: on iOS a line height on a single-line TextInput
 * can push the text and cursor down inside the box.
 */
export const inputText = { fontSize: 16, fontWeight: "400", letterSpacing: -0.2 } as const;

export const space = { s1: 5, s2: 10, s3: 15, s4: 20, s5: 25, s6: 30, s8: 40, s10: 50 } as const;

export const radius = { small: 5, control: 10, group: 15, sheet: 20 } as const;

/** Buttons, inputs and other targets are at least 48 tall in the app (§5); multi-line inputs at least 120 (§8.2). */
export const size = { target: 48, multiline: 120 } as const;

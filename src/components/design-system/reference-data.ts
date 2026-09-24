/*
 * Reference data for /design-system — mirrors the three-tier cascade in
 * src/styles/tokens.css.
 *
 * Only token NAMES live here. Every value the page prints is read back from
 * the stylesheet at runtime (see use-token-values.ts), so this file cannot
 * drift from the CSS: rename or re-point a token and the page shows it.
 */

export const PRIMITIVES = [
  {
    group: "Neutral ramp · slate",
    desc: "A blue-tinted grayscale. Every surface, border and text color is drawn from here.",
    tokens: [
      "--slate-950", "--slate-925", "--slate-900", "--slate-880", "--slate-870",
      "--slate-860", "--slate-840", "--slate-800", "--slate-750", "--slate-700",
      "--slate-600", "--slate-500", "--slate-400", "--slate-100",
    ],
  },
  {
    group: "Blue · brand",
    desc: "Focus, active state and the primary action. 600–800 are the fill steps that carry white text.",
    tokens: ["--blue-200", "--blue-400", "--blue-500", "--blue-600", "--blue-700", "--blue-800", "--blue-950"],
  },
  {
    group: "Violet · accent",
    desc: "Onboarding and walkthrough moments only — never status, never a category.",
    tokens: ["--violet-500", "--violet-950"],
  },
  {
    group: "Status hues",
    desc: "Reserved for status. Each hue has a base (500), an on-tint foreground (300) and a solid step (700) that carries white text.",
    tokens: [
      "--green-500", "--green-300", "--green-700",
      "--amber-500", "--amber-300", "--amber-700",
      "--red-500", "--red-300", "--red-700",
    ],
  },
  {
    group: "Constant",
    desc: "The one foreground that never themes: text on a solid fill.",
    tokens: ["--white"],
  },
] as const;

/** [token, dark-theme primitive, usage] */
export const SEMANTIC: [string, string, string][] = [
  ["--canvas", "--slate-900", "App gutter / page background — deliberately mid-tone"],
  ["--card", "--slate-950", "The single floating surface card (darker than canvas)"],
  ["--panel", "--slate-880", "Inset panels, inputs, the pill-tab track"],
  ["--panel-2", "--slate-860", "Row hover, pressed panel"],
  ["--raised", "--slate-840", "Menus, popovers, toast"],
  ["--border-subtle", "--slate-800", "Hairline dividers inside a panel"],
  ["--border-panel", "--slate-750", "Panel, control and drawer borders"],
  ["--border-strong", "--slate-700", "Hover / emphasized borders"],
  ["--text-primary", "--slate-100", "Headings, values, primary copy"],
  ["--text-secondary", "--slate-400", "Labels, secondary copy"],
  ["--text-muted", "--slate-500", "Captions, hints, meta — clears AA on every surface"],
  ["--brand", "--blue-500", "Focus, active rail, brand text and icons"],
  ["--brand-muted", "--blue-950", "Active nav / tab / row background"],
  ["--accent", "--violet-500", "Onboarding & walkthrough accent"],
  ["--accent-muted", "--violet-950", "Accent surface"],
  ["--healthy", "--green-500", "Live and bookable — nothing to do"],
  ["--warning", "--amber-500", "Waiting on someone — under review, payment pending"],
  ["--critical", "--red-500", "Blocked until the operator acts — changes requested"],
  ["--info", "--blue-400", "Informational notices"],
  ["--neutral", "--slate-600", "Draft, disabled, archived — not trading, nothing wrong"],
];

/** [token, resolves to (dark), usage] */
export const COMPONENT_TOKENS: [string, string, string][] = [
  ["--brand-solid", "--blue-600", "Primary button, avatar, selected calendar day"],
  ["--brand-hover", "--blue-700", "Primary fill hover"],
  ["--brand-active", "--blue-800", "Primary fill pressed"],
  ["--brand-on-muted", "--blue-200", "Text / icon on a --brand-muted surface"],
  ["--on-brand", "--white", "Text on any solid fill"],
  ["--healthy-solid", "--green-700", "Status badge fill · healthy"],
  ["--warning-solid", "--amber-700", "Status badge fill · warning"],
  ["--critical-solid", "--red-700", "Status badge fill · critical"],
  ["--info-solid", "--blue-600", "Status badge fill · info"],
  ["--neutral-solid", "--slate-600", "Status badge fill · neutral"],
  ["--card-border", "--slate-870", "Hairline on every card, panel and table surface"],
  ["--card-shadow", "0 4px 20px · --slate-925", "Floating-card elevation"],
  ["--critical-fg", "--red-300", "Status as text — on a critical tint or a plain surface"],
  ["--warning-fg", "--amber-300", "Status as text — on a warning tint or a plain surface"],
  ["--healthy-fg", "--green-300", "Status as text — on a healthy tint or a plain surface"],
  ["--critical-tint", "red-500 · 15%", "Badge / notice critical fill"],
  ["--warning-tint", "amber-500 · 15%", "Badge / notice warning fill"],
  ["--healthy-tint", "green-500 · 14%", "Badge / notice healthy fill"],
  ["--info-tint", "blue-400 · 12%", "Info surface fill"],
  ["--focus-ring", "0 0 0 3px · blue-500 · 14%", "Text input / select focus glow"],
];

/** Tokens whose value differs between themes — read from both scopes. */
export const THEME_DELTAS = [
  "--canvas", "--card", "--panel", "--raised", "--border-panel",
  "--text-primary", "--text-secondary", "--text-muted",
  "--brand", "--brand-solid", "--brand-muted", "--brand-on-muted", "--card-border",
  "--critical", "--critical-fg", "--warning", "--healthy", "--healthy-solid",
];

/**
 * [label, foreground, background, minimum ratio]. Checked live in both
 * themes on the Color section; 4.5 is WCAG AA for text under 18px.
 */
export const CONTRAST_PAIRS: [string, string, string, number][] = [
  ["Primary text on card", "--text-primary", "--card", 4.5],
  ["Secondary text on card", "--text-secondary", "--card", 4.5],
  ["Muted text on card", "--text-muted", "--card", 4.5],
  ["Muted text on panel", "--text-muted", "--panel", 4.5],
  ["Brand text on card", "--brand", "--card", 4.5],
  ["Critical text on card", "--critical-fg", "--card", 4.5],
  ["Warning text on card", "--warning-fg", "--card", 4.5],
  ["Brand-on-muted on muted", "--brand-on-muted", "--brand-muted", 4.5],
  ["Primary button label", "--on-brand", "--brand-solid", 4.5],
  ["Primary button, hover", "--on-brand", "--brand-hover", 4.5],
  ["Healthy badge label", "--on-brand", "--healthy-solid", 4.5],
  ["Warning badge label", "--on-brand", "--warning-solid", 4.5],
  ["Critical badge label", "--on-brand", "--critical-solid", 4.5],
  ["Neutral badge label", "--on-brand", "--neutral-solid", 4.5],
];

export const PRINCIPLES: [string, string, string][] = [
  [
    "01",
    "Status color is never hardcoded",
    "Every dot, badge, KPI value and notice resolves through statusForExperience() or worstStatus(). The status atoms take a Status, not a color — there is no prop a raw hex could arrive through.",
  ],
  [
    "02",
    "Status colors never carry identity",
    "Green, amber and red say whether something needs the operator — nothing else. Experience types, regions, categories and chart series use brand, info and neutral, so a red line never reads as an alarm by accident.",
  ],
  [
    "03",
    "Sort by what needs attention",
    "Lists lead with what is blocked: changes requested, then under review, then live. Bookings by nearest departure, enquiries by longest unanswered. Alphabetical order buries the one row that matters.",
  ],
  [
    "04",
    "No icon-only control without a label",
    "Every icon button carries a visible label or an aria-label. The collapsed 66px nav expands on hover and on keyboard focus, so its labels are reachable without a mouse.",
  ],
  [
    "05",
    "Never a blank screen, never a lost draft",
    "Lists load their rows on arrival, and an empty list names the next action. The experience builder saves every step as the operator types — closing the tab never costs work.",
  ],
  [
    "06",
    "Every number has context",
    "“213 bookings” alone says little. Pair each value with its comparison: versus last month, seats left of capacity, or the group total a variable price produces.",
  ],
];

/** [level, tag, description, GoDND examples] */
export const ATOMIC: [string, string, string, string][] = [
  ["Tokens", "Foundation", "Three-tier CSS custom properties mirrored by the Tailwind theme — the vocabulary every atom is built from.", "--brand · --card-border · --critical-tint · --brand-solid · radius · type scale"],
  ["Atoms", "Indivisible", "The smallest units — one element, one job.", "StatusDot · Badge · Button · TextInput · Select · Checkbox · TokenChip · Avatar · Sparkline"],
  ["Molecules", "Small groups", "A handful of atoms bound into a reusable unit.", "StatusBadge · KpiCard · PillTabs · Field · AffixInput · ChipSelect · Notice · SearchInput"],
  ["Organisms", "Sections", "Standalone, composed regions of the interface.", "ExperiencesTable · Panel · Sidebar · PageBar · RecordDrawer · WizardRail · DropdownMenu · Toast"],
  ["Templates", "Layout", "Page skeletons — arrangement without real data.", "AppShell (nav + one floating surface card) · list + record drawer · rail + step form"],
  ["Pages", "Instances", "Templates filled with an operator's real data.", "Experiences · Experience detail · New experience (7 steps) · Design system"],
];

export type SectionLink = { id: string; label: string; sub?: boolean } | { header: string };

export const SECTIONS: SectionLink[] = [
  { id: "overview", label: "Overview" },
  { id: "principles", label: "Design principles" },
  { id: "atomic", label: "Atomic design" },
  { header: "Tokens" },
  { id: "tokens", label: "Architecture" },
  { id: "primitives", label: "Primitive", sub: true },
  { id: "semantic", label: "Semantic", sub: true },
  { id: "component-tokens", label: "Component", sub: true },
  { id: "theming", label: "Theming", sub: true },
  { header: "Foundations" },
  { id: "color", label: "Color" },
  { id: "typography", label: "Typography" },
  { id: "spacing", label: "Spacing & radius" },
  { id: "elevation", label: "Elevation" },
  { header: "Component library" },
  { id: "c-buttons", label: "Buttons" },
  { id: "c-status", label: "Status & badges" },
  { id: "c-metrics", label: "Metric cards" },
  { id: "c-data", label: "Tables & panels" },
  { id: "c-feedback", label: "Feedback" },
  { id: "c-forms", label: "Forms" },
  { id: "c-overlays", label: "Overlays" },
  { id: "c-nav", label: "Navigation" },
];

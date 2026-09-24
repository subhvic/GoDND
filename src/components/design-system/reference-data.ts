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
      "--white", "--slate-25", "--slate-50", "--slate-75", "--slate-100", "--slate-125",
      "--slate-150", "--slate-200", "--slate-500", "--slate-550", "--slate-600", "--slate-900",
    ],
  },
  {
    group: "Blue · brand",
    desc: "Focus, active state and the primary action. 700–800 are its hover and pressed steps.",
    tokens: ["--blue-50", "--blue-600", "--blue-700", "--blue-800"],
  },
  {
    group: "Violet · accent",
    desc: "Onboarding and walkthrough moments only — never status, never a category.",
    tokens: ["--violet-50", "--violet-600"],
  },
  {
    group: "Status hues",
    desc: "Reserved for status. Each hue has a base (600) for dots and borders, and a deeper step (700) for status text and for fills that carry white text.",
    tokens: ["--green-600", "--green-700", "--amber-600", "--amber-700", "--red-600", "--red-700"],
  },
] as const;

/** [token, primitive, usage] */
export const SEMANTIC: [string, string, string][] = [
  ["--canvas", "--slate-25", "App gutter / page background — a shade darker than the card"],
  ["--card", "--white", "The single floating surface card"],
  ["--panel", "--slate-50", "Inset panels, inputs, the pill-tab track"],
  ["--panel-2", "--slate-100", "Row hover, pressed panel"],
  ["--raised", "--white", "Menus, popovers, toast"],
  ["--border-subtle", "--slate-75", "Hairline dividers inside a panel"],
  ["--border-panel", "--slate-150", "Panel, control and drawer borders"],
  ["--border-strong", "--slate-200", "Hover / emphasized borders"],
  ["--text-primary", "--slate-900", "Headings, values, primary copy"],
  ["--text-secondary", "--slate-600", "Labels, secondary copy"],
  ["--text-muted", "--slate-550", "Captions, hints, meta — clears AA on every surface"],
  ["--brand", "--blue-600", "Focus, active rail, brand text and icons"],
  ["--brand-muted", "--blue-50", "Active nav / tab / row background"],
  ["--accent", "--violet-600", "Onboarding & walkthrough accent"],
  ["--accent-muted", "--violet-50", "Accent surface"],
  ["--healthy", "--green-600", "Live and bookable — nothing to do"],
  ["--warning", "--amber-600", "Waiting on someone — under review, payment pending"],
  ["--critical", "--red-600", "Blocked until the operator acts — changes requested"],
  ["--info", "--blue-600", "Informational notices"],
  ["--neutral", "--slate-500", "Draft, disabled, archived — not trading, nothing wrong"],
];

/** [token, resolves to, usage] */
export const COMPONENT_TOKENS: [string, string, string][] = [
  ["--brand-solid", "--blue-600", "Primary button, avatar, selected calendar day"],
  ["--brand-hover", "--blue-700", "Primary fill hover"],
  ["--brand-active", "--blue-800", "Primary fill pressed"],
  ["--brand-on-muted", "--blue-700", "Text / icon on a --brand-muted surface"],
  ["--on-brand", "--white", "Text on any solid fill"],
  ["--healthy-solid", "--green-700", "Status badge fill · healthy"],
  ["--warning-solid", "--amber-700", "Status badge fill · warning"],
  ["--critical-solid", "--red-700", "Status badge fill · critical"],
  ["--info-solid", "--blue-600", "Status badge fill · info"],
  ["--neutral-solid", "--slate-500", "Status badge fill · neutral"],
  ["--card-border", "--slate-125", "Hairline on every card, panel and table surface"],
  ["--card-shadow", "slate-900 · 5% + 10%", "Floating-card elevation"],
  ["--critical-fg", "--red-700", "Status as text — on a critical tint or a plain surface"],
  ["--warning-fg", "--amber-700", "Status as text — on a warning tint or a plain surface"],
  ["--healthy-fg", "--green-700", "Status as text — on a healthy tint or a plain surface"],
  ["--critical-tint", "red-600 · 10%", "Badge / notice critical fill"],
  ["--warning-tint", "amber-600 · 12%", "Badge / notice warning fill"],
  ["--healthy-tint", "green-600 · 12%", "Badge / notice healthy fill"],
  ["--info-tint", "blue-600 · 10%", "Info surface fill"],
  ["--focus-ring", "0 0 0 3px · blue-600 · 16%", "Text input / select focus glow"],
];

/**
 * [label, foreground, background, minimum ratio]. Checked live on the Color
 * section; 4.5 is WCAG AA for text under 18px.
 */
export const CONTRAST_PAIRS: [string, string, string, number][] = [
  ["Primary text on card", "--text-primary", "--card", 4.5],
  ["Secondary text on card", "--text-secondary", "--card", 4.5],
  ["Muted text on card", "--text-muted", "--card", 4.5],
  ["Muted text on panel", "--text-muted", "--panel", 4.5],
  ["Muted text on hover row", "--text-muted", "--panel-2", 4.5],
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

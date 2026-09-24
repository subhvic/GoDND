"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Boxes,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  Compass,
  Copy,
  Download,
  Eye,
  Home,
  IndianRupee,
  Info,
  Layers,
  MapPin,
  Palette,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Trash2,
  X,
} from "lucide-react";

import { LogoIcon, LogoWordmark } from "@/components/brand/logo";
import {
  ATOMIC,
  COMPONENT_TOKENS,
  CONTRAST_PAIRS,
  PRIMITIVES,
  PRINCIPLES,
  SECTIONS,
  SEMANTIC,
} from "@/components/design-system/reference-data";
import { contrastRatio, useTokenValues } from "@/components/design-system/use-token-values";
import { Button, buttonClass } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSection,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import {
  AffixInput,
  Checkbox,
  ChipSelect,
  Field,
  RadioGroup,
  Select,
  TextArea,
  TextInput,
} from "@/components/ui/field";
import { KpiCard } from "@/components/ui/kpi-card";
import { Notice } from "@/components/ui/notice";
import { Panel } from "@/components/ui/panel";
import { PillTabs } from "@/components/ui/pill-tabs";
import { RecordDrawer, RecordField, RecordSection } from "@/components/ui/record-drawer";
import { Sparkline } from "@/components/ui/sparkline";
import { Badge, StatusBadge, StatusDot } from "@/components/ui/status";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { EXPERIENCE_STATE_LABELS, STATUSES, statusForExperience } from "@/lib/status";
import { cn } from "@/lib/utils";

/*
 * The living reference for GoDND's design system, modelled section for
 * section on the CubeAPM platform's /design-system page.
 *
 * Everything below the token tables is the product's own component code, not
 * a picture of it: change a component or a token and this page changes too.
 */

const ALL_PRIMITIVES = PRIMITIVES.flatMap((group) => group.tokens);
const SEMANTIC_TOKENS = SEMANTIC.map(([token]) => token);
const COMPONENT_TOKEN_NAMES = COMPONENT_TOKENS.map(([token]) => token);
const CONTRAST_TOKENS = [...new Set(CONTRAST_PAIRS.flatMap(([, fg, bg]) => [fg, bg]))];
const SURFACE_TOKENS = ["--canvas", "--card", "--panel", "--panel-2", "--raised"];

const SPARK_UP = [6, 8, 7, 12, 15, 14, 22, 30];
const SPARK_FLAT = [11, 12, 10, 13, 12, 14, 13, 15];
const SPARK_CALM = [9, 8, 9, 8, 10, 9, 8, 9];

const EXPERIENCE_STATES = ["rejected", "under_review", "active", "draft", "disabled", "archived"];

export function DesignSystemView() {
  const [activeId, setActiveId] = useState("overview");
  const navRef = useRef<HTMLElement>(null);

  // Scroll-spy: the section crossing the middle band of the viewport is the
  // one the reader is on.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        }),
      { rootMargin: "-40% 0px -55% 0px" },
    );
    for (const section of SECTIONS) {
      if (!("id" in section)) continue;
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, []);

  // On narrow screens the nav is a horizontal strip; keep the active link in
  // view. scrollLeft rather than scrollIntoView, which can also move the page.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav || nav.scrollWidth <= nav.clientWidth + 1) return;
    const link = nav.querySelector<HTMLElement>(`[data-section="${activeId}"]`);
    if (!link) return;
    const start = link.offsetLeft - 16;
    const end = link.offsetLeft + link.offsetWidth + 16;
    if (start < nav.scrollLeft || end > nav.scrollLeft + nav.clientWidth) {
      nav.scrollLeft = start;
    }
  }, [activeId]);

  return (
    <div className="ds-root">
      <header className="ds-topbar">
        <div className="ds-brand">
          <Link href="/" className="inline-flex items-center gap-[10px] no-underline">
            <LogoIcon size={26} />
            <LogoWordmark className="text-[17px]" />
          </Link>
          <span className="ds-brand-sep" aria-hidden />
          <span className="ds-brand-title">Design System</span>
          <span className="ds-version">v1.0</span>
        </div>
        <div className="ds-topbar-actions">
          <Link href="/" className="ds-back">
            <ArrowLeft aria-hidden />
            Back to app
          </Link>
        </div>
      </header>

      <div className="ds-layout">
        <nav ref={navRef} className="ds-nav" aria-label="Design system sections">
          {SECTIONS.map((section) =>
            "header" in section ? (
              <div key={section.header} className="ds-nav-group">
                {section.header}
              </div>
            ) : (
              <a
                key={section.id}
                href={`#${section.id}`}
                data-section={section.id}
                aria-current={activeId === section.id ? "location" : undefined}
                className={cn(
                  "ds-navlink",
                  section.sub && "ds-navlink--sub",
                  activeId === section.id && "active",
                )}
              >
                {section.label}
              </a>
            ),
          )}
        </nav>

        <main className="ds-main">
          <Overview />
          <Principles />
          <Atomic />
          <Architecture />
          <Primitives />
          <SemanticTokens />
          <ComponentTokens />
          <Color />
          <Typography />
          <SpacingRadius />
          <Elevation />
          <Buttons />
          <StatusBadges />
          <Metrics />
          <TablesPanels />
          <Feedback />
          <Forms />
          <Overlays />
          <Navigation />

          <footer className="ds-footer">
            GoDND Design System · rendered live from
            <code className="ds-token">src/components/design-system</code>
          </footer>
        </main>
      </div>
    </div>
  );
}

/* ============================================================================
   Building blocks
   ========================================================================== */

function Section({
  id,
  kicker,
  title,
  lead,
  heading: Heading = "h2",
  children,
}: {
  id: string;
  kicker?: string;
  title: string;
  lead?: React.ReactNode;
  heading?: "h1" | "h2";
  children?: React.ReactNode;
}) {
  return (
    <section id={id} className="ds-section" aria-labelledby={`${id}-title`}>
      {kicker ? <div className="ds-kicker">{kicker}</div> : null}
      <Heading id={`${id}-title`} className="ds-h2">
        {title}
      </Heading>
      {lead ? <p className="ds-lead">{lead}</p> : null}
      {children}
    </section>
  );
}

function Spec({
  title,
  note,
  wide,
  children,
}: {
  title: string;
  note?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("ds-spec", wide && "ds-spec--wide")}>
      <div className="ds-spec-head">
        <h3 className="ds-spec-title m-0">{title}</h3>
        {note ? <span className="ds-spec-note">{note}</span> : null}
      </div>
      <div className="ds-spec-body">{children}</div>
    </div>
  );
}

function Swatch({ token, value, text }: { token: string; value: string; text?: string }) {
  return (
    <div className="ds-swatch">
      <div className="ds-swatch-chip" style={{ background: `var(${token})` }} />
      <code className="ds-token self-start">{token}</code>
      <span className="ds-swatch-val">{value || " "}</span>
      {text ? <span className="ds-swatch-text">{text}</span> : null}
    </div>
  );
}

const isShadowToken = (token: string) => /shadow|focus-ring/.test(token);

function TokenTable({
  rows,
  values,
  refLabel,
  caption,
}: {
  rows: [string, string, string][];
  values: Record<string, string>;
  refLabel: string;
  caption: string;
}) {
  return (
    <div className="ds-table-wrap">
      <table className="ds-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Token</th>
            <th scope="col">{refLabel}</th>
            <th scope="col">Value</th>
            <th scope="col">Usage</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([token, reference, usage]) => (
            <tr key={token}>
              <td>
                <code className="ds-token">{token}</code>
              </td>
              <td>
                <code className="ds-token ds-token--ref">{reference}</code>
              </td>
              <td>
                <span className="flex items-center gap-[10px]">
                  <span
                    className="ds-table-chip shrink-0"
                    style={
                      isShadowToken(token)
                        ? { background: "var(--raised)", boxShadow: `var(${token})` }
                        : { background: `var(${token})` }
                    }
                  />
                  <span
                    className="max-w-[220px] truncate text-[11px] text-text-secondary"
                    title={values[token]}
                  >
                    {values[token]}
                  </span>
                </span>
              </td>
              <td className="ds-table-usage">{usage}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ============================================================================
   Guidelines
   ========================================================================== */

function Overview() {
  return (
    <Section
      id="overview"
      heading="h1"
      kicker="GoDND Platform"
      title="A design system for running trips, not reading dashboards"
      lead="The living reference for the GoDND operator portal. It has two parts: the guidelines and token architecture that govern every decision, and a component library showing each building block and its variants — rendered live from the same code that ships in the product."
    >
      <div className="ds-stat-row">
        <Stat n="3" label="Token tiers" />
        <Stat n="6" label="Non-negotiable rules" />
        <Stat n="Rubik" label="One typeface" />
        <Stat n="AA" label="Contrast floor, every pair" />
      </div>
      <div className="ds-callout">
        <Palette aria-hidden />
        <div>
          <strong>How the tokens work.</strong> Colors, type, spacing and radius live as CSS
          custom properties in a three-tier cascade (primitive → semantic → component). The
          Tailwind theme mirrors the semantic layer, so a utility class and hand-written CSS
          resolve to the exact same variable. Change a primitive once and it propagates
          everywhere.
        </div>
      </div>
    </Section>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div className="ds-stat">
      <div className="ds-stat-n">{n}</div>
      <div className="ds-stat-l">{label}</div>
    </div>
  );
}

function Principles() {
  return (
    <Section
      id="principles"
      kicker="Guidelines"
      title="Six non-negotiable rules"
      lead="An operator opens the portal to find out what needs them — a trip awaiting approval, a guest waiting on a reply. Every rule serves that question, and each is enforced in code rather than left to discretion."
    >
      <ol className="ds-principle-grid m-0 list-none p-0">
        {PRINCIPLES.map(([n, title, body]) => (
          <li key={n} className="ds-principle">
            <div className="ds-principle-n" aria-hidden>
              {n}
            </div>
            <h3 className="ds-principle-t m-0 mb-[7px]">{title}</h3>
            <p className="ds-principle-b m-0">{body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function Atomic() {
  return (
    <Section
      id="atomic"
      kicker="Methodology"
      title="Atomic design"
      lead="The interface is composed bottom-up. Tokens feed atoms, atoms compose into molecules and organisms, and templates arrange them into the pages operators actually use."
    >
      <ol className="ds-atomic m-0 list-none p-0">
        {ATOMIC.map(([level, tag, description, examples], index) => (
          <li key={level} className="ds-atomic-row">
            <div className="ds-atomic-index" aria-hidden>
              {index + 1}
            </div>
            <div className="ds-atomic-head">
              <h3 className="ds-atomic-lvl m-0">{level}</h3>
              <span className="ds-atomic-tag">{tag}</span>
            </div>
            <div className="ds-atomic-d">{description}</div>
            <div className="ds-atomic-ex">{examples}</div>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/* ============================================================================
   Tokens
   ========================================================================== */

function Architecture() {
  return (
    <Section
      id="tokens"
      kicker="Tokens"
      title="Three-tier token architecture"
      lead="No component ever names a raw value. Each tier references the one beneath it, so intent stays legible and a single edit ripples predictably through the whole platform."
    >
      <div className="ds-tier-flow">
        <Tier
          layer="Layer 1"
          name="Primitive"
          desc="Raw, context-free values. The only place a hex or px is written."
          example="--emerald-700: #047857"
          className="ds-tier--1"
        />
        <div className="ds-tier-arrow" aria-hidden>
          →
        </div>
        <Tier
          layer="Layer 2"
          name="Semantic"
          desc="Role-based aliases the platform consumes. Says what, not which."
          example="--brand: var(--emerald-700)"
          className="ds-tier--2"
        />
        <div className="ds-tier-arrow" aria-hidden>
          →
        </div>
        <Tier
          layer="Layer 3"
          name="Component"
          desc="Element-specific decisions built on the tiers below."
          example="--brand-solid: var(--emerald-700)"
          className="ds-tier--3"
        />
      </div>
    </Section>
  );
}

function Tier({
  layer,
  name,
  desc,
  example,
  className,
}: {
  layer: string;
  name: string;
  desc: React.ReactNode;
  example?: string;
  className?: string;
}) {
  return (
    <div className={cn("ds-tier", className)}>
      <div className="ds-tier-badge">{layer}</div>
      <div className="ds-tier-name">{name}</div>
      <div className="ds-tier-desc">{desc}</div>
      {example ? <code className="ds-token self-start">{example}</code> : null}
    </div>
  );
}

function Primitives() {
  const values = useTokenValues(ALL_PRIMITIVES);
  return (
    <Section
      id="primitives"
      kicker="Tokens · Layer 1"
      title="Primitive tokens"
      lead="The raw palette, named by hue and lightness, never by purpose."
    >
      {PRIMITIVES.map((group) => (
        <div key={group.group} className="ds-ramp-block">
          <div className="ds-ramp-head">
            <h3 className="ds-ramp-name m-0">{group.group}</h3>
            <span className="ds-ramp-desc">{group.desc}</span>
          </div>
          <div className="ds-swatch-grid">
            {group.tokens.map((token) => (
              <Swatch key={token} token={token} value={values[token]} />
            ))}
          </div>
        </div>
      ))}
    </Section>
  );
}

function SemanticTokens() {
  const values = useTokenValues(SEMANTIC_TOKENS);
  return (
    <Section
      id="semantic"
      kicker="Tokens · Layer 2"
      title="Semantic tokens"
      lead="What the platform actually references. Each maps to exactly one primitive."
    >
      <TokenTable rows={SEMANTIC} values={values} refLabel="Primitive" caption="Semantic tokens" />
    </Section>
  );
}

function ComponentTokens() {
  const values = useTokenValues(COMPONENT_TOKEN_NAMES);
  return (
    <Section
      id="component-tokens"
      kicker="Tokens · Layer 3"
      title="Component tokens"
      lead="Interaction states and composite decisions. The -solid steps exist for one reason: a fill that carries white text has to clear 4.5:1, which the base status hues do not."
    >
      <TokenTable
        rows={COMPONENT_TOKENS}
        values={values}
        refLabel="Resolves to"
        caption="Component tokens"
      />
    </Section>
  );
}

/* ============================================================================
   Foundations
   ========================================================================== */

function Color() {
  const surfaces = useTokenValues(SURFACE_TOKENS);
  const contrast = useTokenValues(CONTRAST_TOKENS);

  return (
    <Section
      id="color"
      kicker="Foundations"
      title="Color"
      lead="The card is white and the canvas sits a shade darker, so the single surface card reads as floating. Everything else inside it is a quieter step of the same slate."
    >
      <div className="ds-swatch-grid ds-swatch-grid--lg">
        <Swatch token="--canvas" value={surfaces["--canvas"]} text="Gutter" />
        <Swatch token="--card" value={surfaces["--card"]} text="Surface card" />
        <Swatch token="--panel" value={surfaces["--panel"]} text="Panel" />
        <Swatch token="--panel-2" value={surfaces["--panel-2"]} text="Hover" />
        <Swatch token="--raised" value={surfaces["--raised"]} text="Raised / overlay" />
      </div>
      <div className="ds-swatch-grid ds-swatch-grid--lg mb-[18px]">
        <Swatch token="--brand" value="Brand" />
        <Swatch token="--brand-muted" value="Brand muted" />
        <Swatch token="--accent" value="Accent" />
        <Swatch token="--healthy" value="Healthy" />
        <Swatch token="--warning" value="Warning" />
        <Swatch token="--critical" value="Critical" />
        <Swatch token="--info" value="Info" />
      </div>

      <div className="ds-callout ds-callout--warn mb-[18px]">
        <Boxes aria-hidden />
        <div>
          <strong>Reserved.</strong> Green, amber and red mean status and nothing else. An
          experience type, a region or a chart series never borrows them — there, color must
          signal identity, and a red category would read as an alarm.
        </div>
      </div>

      <div className="ds-callout mb-[18px]">
        <Layers aria-hidden />
        <div>
          <strong>One hue, three jobs.</strong> Each status hue has a base step for dots, rails
          and borders; an <code className="ds-token">-fg</code> step for status written as text;
          and a <code className="ds-token">-solid</code> step for fills that carry a white label.
          Picking the step by job is what keeps every pair at AA.
        </div>
      </div>

      <Spec title="Contrast" note="Computed live from the tokens · WCAG AA is 4.5:1" wide>
        <div className="ds-table-wrap">
          <table className="ds-table">
            <caption className="sr-only">Contrast ratios for key text pairs</caption>
            <thead>
              <tr>
                <th scope="col">Pair</th>
                <th scope="col">Tokens</th>
                <th scope="col">Ratio</th>
              </tr>
            </thead>
            <tbody>
              {CONTRAST_PAIRS.map(([label, fg, bg, minimum]) => (
                <tr key={label}>
                  <th scope="row" className="text-left text-[12px] font-medium text-text-primary">
                    {label}
                  </th>
                  <td className="text-[11px] text-text-secondary">
                    {fg} on {bg}
                  </td>
                  <td>
                    <Ratio value={contrastRatio(contrast[fg], contrast[bg])} minimum={minimum} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Spec>
    </Section>
  );
}

function Ratio({ value, minimum }: { value: number | null; minimum: number }) {
  if (value == null) return <span className="text-text-muted">—</span>;
  const passes = value >= minimum;
  return (
    <span className="ds-ratio">
      <span className="text-[12px] font-semibold text-text-primary">{value.toFixed(2)}:1</span>
      <Badge status={passes ? "healthy" : "critical"}>{passes ? "AA" : "Fails"}</Badge>
    </span>
  );
}

const TYPE_SCALE: [string, string, React.CSSProperties][] = [
  ["kpi-value · 30 / 600", "₹67,000", { fontSize: 30, fontWeight: 600, lineHeight: 1.1 }],
  ["summary-pill · 25 / 700", "8 experiences", { fontSize: 25, fontWeight: 700, lineHeight: 1.1 }],
  ["chart-value · 20 / 700", "213 bookings", { fontSize: 20, fontWeight: 700 }],
  ["page-title · 15 / 600", "New experience", { fontSize: 15, fontWeight: 600 }],
  ["drawer-title · 14 / 600", "7 Day Immersive Experience in Meghalaya", { fontSize: 14, fontWeight: 600 }],
  ["panel-header · 13.5 / 600", "Upcoming departures", { fontSize: 13.5, fontWeight: 600 }],
  ["body · 12.5 / 400", "Lists lead with whatever needs the operator.", { fontSize: 12.5 }],
  ["label · 10.5 / 600 · caps", "Next availability", { fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--text-muted)" }],
  ["caption · 11 / 400 · muted", "↑ 18% vs last month", { fontSize: 11, color: "var(--text-muted)" }],
];

function Typography() {
  return (
    <Section
      id="typography"
      kicker="Foundations"
      title="Typography"
      lead="One typeface: Rubik, for everything. Numerals take tabular figures globally, so prices, dates and counts line up in columns without a second, monospaced face."
    >
      <div className="ds-type-list">
        {TYPE_SCALE.map(([meta, sample, style]) => (
          <div key={meta} className="ds-type-row">
            <span className="ds-type-meta">{meta}</span>
            <span className="min-w-0" style={style}>
              {sample}
            </span>
          </div>
        ))}
      </div>
      <div className="ds-font-pair">
        <div className="ds-font-card">
          <div className="ds-font-name">Rubik · 400 / 500 / 600 / 700</div>
          <div className="ds-font-sample flex flex-wrap gap-x-[14px]">
            <span className="font-normal">Aa</span>
            <span className="font-medium">Aa</span>
            <span className="font-semibold">Aa</span>
            <span className="font-bold">Aa</span>
            <span className="text-text-secondary">— interface</span>
          </div>
        </div>
        <div className="ds-font-card">
          <div className="ds-font-name">Rubik · tabular figures</div>
          <div className="ds-font-sample text-right">
            <div>₹1,11,500</div>
            <div>₹98,000</div>
          </div>
        </div>
      </div>
    </Section>
  );
}

const SPACING: [number, string][] = [
  [4, "Pill-tab track padding"],
  [8, "Card scroll · vertical"],
  [12, "Panel head · vertical"],
  [14, "--gutter · canvas"],
  [16, "Panel & cell · horizontal"],
  [18, "Main column gap"],
];

function SpacingRadius() {
  return (
    <Section
      id="spacing"
      kicker="Foundations"
      title="Spacing & radius"
      lead="A 14px gutter frames the app; radii step 6 → 9 → 10 → 12px from controls up to the surface card."
    >
      <div className="ds-radius-row">
        {(
          [
            ["--radius-sm", "6px", "Chips, inputs, buttons"],
            ["--radius-md", "9px", "Pill tabs, menus, notices"],
            ["--radius-lg", "10px", "Panels, cards, tables"],
            ["--radius-card", "12px", "The surface card"],
          ] as const
        ).map(([token, value, use]) => (
          <div key={token} className="ds-radius-item">
            <div className="ds-radius-demo" style={{ borderRadius: `var(${token})` }} />
            <code className="ds-token self-start">{token}</code>
            <span className="ds-swatch-val">{value}</span>
            <span className="ds-swatch-text">{use}</span>
          </div>
        ))}
      </div>
      <div className="ds-spacing-row">
        {SPACING.map(([size, use]) => (
          <div key={size} className="ds-spacing-item">
            <div className="ds-spacing-bar" style={{ width: size * 3 }} />
            <span className="ds-swatch-val">{size}px</span>
            <span className="ds-swatch-text">{use}</span>
          </div>
        ))}
      </div>
      <div className="ds-layout-tokens">
        <LayoutToken token="--nav-w" value="222px" use="Expanded sidebar" />
        <LayoutToken token="--nav-w-collapsed" value="66px" use="Collapsed sidebar" />
        <LayoutToken token="--gutter" value="14px" use="Canvas padding" />
      </div>
    </Section>
  );
}

function LayoutToken({ token, value, use }: { token: string; value: string; use: string }) {
  return (
    <div className="ds-lt">
      <code className="ds-token">{token}</code>
      <span>{value}</span>
      <span className="ds-swatch-text">{use}</span>
    </div>
  );
}

function Elevation() {
  return (
    <Section
      id="elevation"
      kicker="Foundations"
      title="Elevation"
      lead="Depth is carried by soft, cool-gray shadows. The higher the layer, the larger and softer the cast."
    >
      <div className="ds-elev-row">
        {(
          [
            ["Surface card", "--card-shadow"],
            ["Menu", "--shadow-dropdown"],
            ["Popover", "--shadow-pop"],
            ["Toast", "--shadow-toast"],
            ["Drawer", "--shadow-drawer"],
          ] as const
        ).map(([label, token]) => (
          <div key={token} className="ds-elev-card" style={{ boxShadow: `var(${token})` }}>
            <span>{label}</span>
            <code className="ds-token">{token}</code>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ============================================================================
   Component library
   ========================================================================== */

function Buttons() {
  return (
    <Section
      id="c-buttons"
      kicker="Component library"
      title="Buttons"
      lead="One button family drives every action. The primary fill uses --brand-solid with the --brand-hover / --brand-active steps; everything else stays quiet on a hairline border."
    >
      <Spec title="Header buttons" note="Button · .hbtn · active · icon · small">
        <div className="ds-row">
          <Button>
            <RefreshCw aria-hidden />
            Refresh
          </Button>
          <Button active>This month</Button>
          <Button size="icon" aria-label="Notifications">
            <Bell aria-hidden />
          </Button>
          <Button size="small">
            <Download aria-hidden />
            Export
          </Button>
        </div>
      </Spec>
      <Spec title="Primary & emphasis" note="primary · primary disabled · brand-lit · danger">
        <div className="ds-row">
          <Button variant="primary">
            <Plus aria-hidden />
            Add experience
          </Button>
          <Button variant="primary" disabled>
            <Eye aria-hidden />
            Preview
          </Button>
          <Button variant="brand-lit">
            <Plus aria-hidden />
            Add activity
          </Button>
          <Button variant="danger">
            <Trash2 aria-hidden />
            Delete draft
          </Button>
        </div>
      </Spec>
      <Spec title="Links as buttons" note="buttonClass() on a <Link> — navigation keeps its semantics">
        <div className="ds-row">
          <Link href="#c-buttons" className={buttonClass({ variant: "primary", size: "small" })}>
            Next step
          </Link>
          <Link href="#c-buttons" className={buttonClass({ size: "small" })}>
            Cancel
          </Link>
        </div>
      </Spec>
      <SegmentedToggleSpec />
    </Section>
  );
}

function SegmentedToggleSpec() {
  const [mode, setMode] = useState("guest");
  return (
    <Spec title="Segmented toggle" note=".seg-toggle · two or three mutually exclusive views">
      <div className="seg-toggle" role="group" aria-label="Price shown">
        {(
          [
            ["guest", "Per guest"],
            ["group", "Group total"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={mode === id}
            onClick={() => setMode(id)}
            className={cn("seg", mode === id && "active")}
          >
            {label}
          </button>
        ))}
      </div>
    </Spec>
  );
}

function StatusBadges() {
  return (
    <Section
      id="c-status"
      kicker="Component library"
      title="Status & badges"
      lead="Status indicators are the heart of the system. Every one takes a Status resolved in lib/status.ts — none of them accepts a color."
    >
      <Spec title="Status dot" note="StatusDot · sizes sm / md / lg">
        <div className="ds-row ds-row--gap">
          {(["sm", "md", "lg"] as const).map((size) => (
            <div key={size} className="ds-dot-set">
              {STATUSES.map((status) => (
                <StatusDot key={status} status={status} size={size} />
              ))}
              <span className="ds-swatch-text">{size}</span>
            </div>
          ))}
        </div>
      </Spec>
      <Spec title="Table status dot" note=".status-dot — critical and warning carry a halo">
        <div className="ds-row ds-row--gap">
          {(["critical", "warning", "healthy"] as const).map((status) => (
            <span key={status} className="ds-inline-dot">
              <span className={cn("status-dot", status)} aria-hidden />
              {status}
            </span>
          ))}
        </div>
      </Spec>
      <Spec title="Status badge" note="StatusBadge · solid -solid fill, white label">
        <div className="ds-row">
          {STATUSES.map((status) => (
            <StatusBadge key={status} status={status} />
          ))}
        </div>
      </Spec>
      <Spec title="Pill badges" note="Badge · .kpi-chip · .flag — tint + on-tint foreground">
        <div className="ds-row ds-row--gap">
          {STATUSES.map((status) => (
            <Badge key={status} status={status}>
              {status}
            </Badge>
          ))}
          <span className="kpi-chip critical">↑ Critical</span>
          <span className="kpi-chip warning">Warning</span>
          <span className="flag crit">Overdue</span>
          <span className="flag ok">On time</span>
        </div>
      </Spec>
      <Spec title="Experience state → status" note="statusForExperience() · the one resolver lists and drawers use" wide>
        <div className="ds-table-wrap">
          <table className="ds-table">
            <caption className="sr-only">How each experience state maps to a status</caption>
            <thead>
              <tr>
                <th scope="col">State</th>
                <th scope="col">Status</th>
                <th scope="col">Badge</th>
              </tr>
            </thead>
            <tbody>
              {EXPERIENCE_STATES.map((state) => {
                const status = statusForExperience(state);
                return (
                  <tr key={state}>
                    <th scope="row" className="text-left">
                      <span className="ds-inline-dot">
                        <StatusDot status={status} size="sm" />
                        <code className="ds-token">{state}</code>
                      </span>
                    </th>
                    <td className="text-text-secondary">{status}</td>
                    <td>
                      <StatusBadge status={status} label={EXPERIENCE_STATE_LABELS[state]} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Spec>
    </Section>
  );
}

function Metrics() {
  return (
    <Section
      id="c-metrics"
      kicker="Component library"
      title="Metric cards"
      lead="KpiCard is the workhorse — label, status chip, value, sparkline and a comparison caption, all colored by the resolved status. Summary pills give the count at a glance."
    >
      <Spec title="KPI card" note="KpiCard · comparison is a required prop (rule 06)" wide>
        <div className="ds-grid-3">
          <KpiCard
            label="Unanswered enquiries"
            value="3"
            status="critical"
            comparison="Oldest waiting 26 hours"
            trend={SPARK_UP}
          />
          <KpiCard
            label="Awaiting approval"
            value="1"
            unit="experience"
            status="warning"
            comparison="Submitted 2 days ago"
            trend={SPARK_FLAT}
          />
          <KpiCard
            label="Bookings this month"
            value="213"
            status="healthy"
            comparison="↑ 18% vs August"
            trend={SPARK_CALM}
          />
        </div>
      </Spec>
      <Spec title="Summary pills" note=".summary-strip · total / critical / warning / healthy" wide>
        <div className="summary-strip mb-0">
          <SummaryPill status="total" n="8" label="Experiences" icon={Compass} />
          <SummaryPill status="critical" n="1" label="Changes requested" icon={AlertTriangle} />
          <SummaryPill status="warning" n="1" label="Under review" icon={Bell} />
          <SummaryPill status="healthy" n="4" label="Live" icon={CheckCircle2} />
        </div>
      </Spec>
      <Spec title="Sparkline" note="Sparkline · inline SVG, area + line, color from a token">
        <div className="h-[40px] w-[160px]">
          <Sparkline data={SPARK_UP} color="var(--brand)" />
        </div>
      </Spec>
    </Section>
  );
}

function SummaryPill({
  status,
  n,
  label,
  icon: Icon,
}: {
  status: "total" | "critical" | "warning" | "healthy";
  n: string;
  label: string;
  icon: typeof Compass;
}) {
  return (
    <div className={cn("summary-pill", status)}>
      <div>
        <div className="num">{n}</div>
        <div className="lbl">{label}</div>
      </div>
      <div className="icon-wrap" aria-hidden>
        <Icon />
      </div>
    </div>
  );
}

const SAMPLE_ROWS = [
  { name: "Rafting, Camping & Cycling in Upper Assam", state: "rejected", bookings: 0, seats: "8 of 8", price: "₹98,000" },
  { name: "Raw Experience in Meghalaya", state: "under_review", bookings: 0, seats: "4 of 4", price: "₹18,500" },
  { name: "7 Day Immersive Experience in Meghalaya", state: "active", bookings: 213, seats: "3 of 10", price: "₹67,000" },
];

function TablesPanels() {
  const [tab, setTab] = useState("active");
  const [compact, setCompact] = useState("details");

  return (
    <Section
      id="c-data"
      kicker="Component library"
      title="Tables & panels"
      lead="Panel is the universal card with a header row. Tables right-align every number, lead each row with its status, and sort by what needs attention (rule 03)."
    >
      <Spec title="Panel + data table" note="Panel › .data-table · row header · right-aligned numerics" wide>
        <Panel title="Experiences" hint="needs attention first" actions={<Button size="small">View all</Button>}>
          <div className="overflow-x-auto">
            <table className="data-table min-w-[640px]">
              <caption className="sr-only">Sample experiences, sorted by what needs attention</caption>
              <thead>
                <tr>
                  <th scope="col">Experience</th>
                  <th scope="col" className="left">
                    State
                  </th>
                  <th scope="col">Bookings</th>
                  <th scope="col">Seats left</th>
                  <th scope="col">Base price</th>
                </tr>
              </thead>
              <tbody>
                {SAMPLE_ROWS.map((row) => {
                  const status = statusForExperience(row.state);
                  return (
                    <tr key={row.name}>
                      <th scope="row">
                        <span className="row-name">
                          <StatusDot status={status} label={EXPERIENCE_STATE_LABELS[row.state]} />
                          <span className="truncate">{row.name}</span>
                        </span>
                      </th>
                      <td className={cn("left", status === "critical" && "val-critical", status === "warning" && "val-warning")}>
                        {EXPERIENCE_STATE_LABELS[row.state]}
                      </td>
                      <td>{row.bookings}</td>
                      <td>{row.seats}</td>
                      <td className="primary font-medium">{row.price}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </Spec>
      <Spec title="Pill tabs" note="PillTabs · link tabs for server state, button tabs for view state">
        <PillTabs
          label="Experience status"
          active={tab}
          onChange={setTab}
          tabs={[
            { id: "active", label: "Active", count: 4 },
            { id: "review", label: "Under Review", count: 1 },
            { id: "drafts", label: "Drafts", count: 1 },
            { id: "archived", label: "Archived", count: 1 },
          ]}
        />
      </Spec>
      <Spec title="Compact tabs" note=".tabbar · .tab.active — dense contexts, such as inside a drawer">
        <div className="tabbar" role="group" aria-label="Record view">
          {["details", "itinerary", "media"].map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={compact === id}
              onClick={() => setCompact(id)}
              className={cn("tab capitalize", compact === id && "active")}
            >
              {id}
            </button>
          ))}
        </div>
      </Spec>
    </Section>
  );
}

function Feedback() {
  return (
    <Section
      id="c-feedback"
      kicker="Component library"
      title="Feedback & empty states"
      lead="When something needs the operator, the notice says what and why as a first-class element instead of hiding it in a tooltip. Empty states always offer the next action."
    >
      <Spec title="Notice" note="Notice · left-border status accent" wide>
        <div className="ds-stack">
          <Notice status="critical" title="Changes requested on “Rafting in Upper Assam”">
            The cancellation policy doesn&rsquo;t match the refund window. Edit step 6, then send
            it for approval again.
          </Notice>
          <Notice status="warning" title="“Raw Experience in Meghalaya” is under review">
            Approval usually takes one working day. It stays bookable on your own site meanwhile.
          </Notice>
          <Notice status="info" title="Showing sample data">
            Add your Supabase keys to <code className="ds-token">.env.local</code> to see your own experiences.
          </Notice>
          <Notice status="info" title="Preview with sample data">
            You&rsquo;re looking at a walkthrough of the operator portal. The
            experiences below are representative &mdash; real ones appear here
            once the workspace is connected to a live database.
          </Notice>
          <Notice status="healthy" title="Published to the marketplace">
            Travellers can find and book this experience now.
          </Notice>
        </div>
      </Spec>
      <Spec title="Empty state" note="EmptyState · icon + title + description + action" wide>
        <EmptyState
          icon={Compass}
          title="No drafts"
          description="Experiences you start but don't send for approval are kept here, saved as you type."
          action={
            <Link href="#c-feedback" className={buttonClass({ variant: "primary", size: "small" })}>
              <Plus aria-hidden />
              Add experience
            </Link>
          }
        />
      </Spec>
      <Spec title="Toast" note=".toast-bar · transient, auto-dismisses after 5s" wide>
        <div className="ds-frame">
          <div className="toast-bar" role="status">
            <Info aria-hidden />
            <span className="toast-msg">Help Center isn&rsquo;t built yet — this previews where it will live.</span>
            <button type="button" className="toast-close" aria-label="Dismiss">
              <X aria-hidden />
            </button>
          </div>
        </div>
      </Spec>
      <Spec title="Skeleton" note=".skeleton · the loading shape of what is coming">
        <div className="ds-stack max-w-[360px]" aria-hidden>
          <div className="skeleton h-[14px] w-3/5" />
          <div className="skeleton h-[10px] w-4/5" />
          <div className="skeleton h-[10px] w-2/5" />
        </div>
      </Spec>
    </Section>
  );
}

const REGION_OPTIONS = [
  { value: "meghalaya", label: "Meghalaya" },
  { value: "assam", label: "Assam" },
  { value: "arunachal", label: "Arunachal Pradesh" },
  { value: "sikkim", label: "Sikkim" },
];

function Forms() {
  const [regions, setRegions] = useState(["meghalaya"]);
  const [food, setFood] = useState<"none" | "breakfast_dinner">("breakfast_dinner");
  const [pickup, setPickup] = useState(true);
  const [instant, setInstant] = useState(true);

  return (
    <Section
      id="c-forms"
      kicker="Component library"
      title="Forms"
      lead="Every control is native and shares one focus treatment — a --brand border and the --focus-ring glow. Controls sit quiet on --panel until touched; labels, hints and errors are wired to the control for assistive tech."
    >
      <Spec title="Text fields" note="Field › TextInput · hint · error" wide>
        <div className="grid gap-[20px] md:grid-cols-2">
          <Field label="Experience name" required hint="Shown on the marketplace and on your own site.">
            {({ id, describedBy, invalid }) => (
              <TextInput id={id} describedBy={describedBy} invalid={invalid} defaultValue="7 Day Immersive Experience" />
            )}
          </Field>
          <Field label="Contact email" required error="Enter an email address, like you@company.com">
            {({ id, describedBy, invalid }) => (
              <TextInput id={id} describedBy={describedBy} invalid={invalid} defaultValue="wanderbeyond" />
            )}
          </Field>
        </div>
      </Spec>
      <Spec title="Select, affix & text area" note="Select · AffixInput · TextArea" wide>
        <div className="grid gap-[20px] md:grid-cols-2">
          <Field label="Duration" required>
            {({ id }) => (
              <Select id={id} defaultValue="5">
                {[3, 4, 5, 6, 7].map((day) => (
                  <option key={day} value={day}>
                    {day} days
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Base price" required>
            {({ id }) => <AffixInput id={id} prefix="₹" suffix="per guest" inputMode="numeric" defaultValue="67,000" />}
          </Field>
          <Field label="Comment" className="md:col-span-2">
            {({ id }) => <TextArea id={id} placeholder="Anything the guest should know about this stop…" />}
          </Field>
        </div>
      </Spec>
      <Spec title="Choices" note="Checkbox · RadioGroup · .switch · ChipSelect" wide>
        <div className="grid gap-[20px] md:grid-cols-2">
          <div className="ds-stack">
            <Checkbox label="Pick-up included on day 1" checked={pickup} onChange={setPickup} />
            <RadioGroup
              legend="Food included"
              value={food}
              onChange={setFood}
              options={[
                { value: "none", label: "None" },
                { value: "breakfast_dinner", label: "Breakfast & Dinner" },
              ]}
            />
            <label className="switch">
              <input type="checkbox" checked={instant} onChange={(event) => setInstant(event.target.checked)} />
              <span className="switch-track" aria-hidden>
                <span className="switch-knob" />
              </span>
              Instant booking
            </label>
          </div>
          <ChipSelect
            label="Region/State"
            required
            placeholder="Select states"
            options={REGION_OPTIONS}
            value={regions}
            onChange={setRegions}
          />
        </div>
      </Spec>
      <Spec title="Search" note=".search-wrap · .search-input">
        <div className="search-wrap">
          <Search aria-hidden />
          <input type="search" className="search-input" placeholder="Search experiences…" aria-label="Search experiences" />
        </div>
      </Spec>
    </Section>
  );
}

function Overlays() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <Section
      id="c-overlays"
      kicker="Component library"
      title="Overlays"
      lead="Menus, the record drawer and tooltips sit on --raised or --card with a soft shadow. Each is built on a Radix primitive in shadcn's composition, so keyboard, focus and Escape behave correctly by default."
    >
      <Spec title="Dropdown menu" note="DropdownMenu · Radix · arrow keys, typeahead, Escape">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              Actions
              <ChevronDown aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[220px]">
            <DropdownMenuSection label="Experience">
              <DropdownMenuItem>
                <Pencil aria-hidden className="size-[14px]" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Copy aria-hidden className="size-[14px]" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <Eye aria-hidden className="size-[14px]" />
                Preview
              </DropdownMenuItem>
            </DropdownMenuSection>
            <DropdownMenuSection>
              <DropdownMenuItem danger>
                <Trash2 aria-hidden className="size-[14px]" />
                Archive
              </DropdownMenuItem>
            </DropdownMenuSection>
          </DropdownMenuContent>
        </DropdownMenu>
      </Spec>
      <Spec title="Record drawer" note="RecordDrawer · non-modal, the list stays usable underneath" wide>
        <div className="ds-drawer-frame">
          <div className="flex h-full items-center justify-center p-[20px]">
            <Button variant="brand-lit" onClick={() => setDrawerOpen(true)} aria-expanded={drawerOpen}>
              <Layers aria-hidden />
              Open record drawer
            </Button>
          </div>
          <RecordDrawer
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            title="7 Day Immersive Experience in Meghalaya"
            subtitle={
              <span className="flex items-center gap-[8px]">
                <StatusBadge status="healthy" label="Active" />
                7D &amp; 6N · EXP-0045835
              </span>
            }
          >
            <RecordSection title="Basic info">
              <RecordField label="Regions">Meghalaya, Assam</RecordField>
              <RecordField label="Categories">Adventure, Culture &amp; Heritage</RecordField>
            </RecordSection>
            <RecordSection title="Availability">
              <RecordField label="Next available">15 May 2026</RecordField>
            </RecordSection>
          </RecordDrawer>
        </div>
      </Spec>
      <Spec title="Tooltip" note="Tooltip · shows on hover and on keyboard focus">
        <TooltipProvider delayDuration={200}>
          <div className="ds-row">
            <Tooltip label="Notifications" side="top">
              <Button size="icon" aria-label="Notifications">
                <Bell aria-hidden />
              </Button>
            </Tooltip>
            <Tooltip label="Settings" side="top">
              <Button size="icon" aria-label="Settings">
                <Settings aria-hidden />
              </Button>
            </Tooltip>
          </div>
        </TooltipProvider>
      </Spec>
    </Section>
  );
}

function Navigation() {
  return (
    <Section
      id="c-nav"
      kicker="Component library"
      title="Navigation"
      lead="The sidebar item is the atom of navigation — an always-labeled icon with a brand rail when active, and a genuinely disabled state for modules that aren't built yet."
    >
      <Spec title="Sidebar item" note=".nav-item · default / active / disabled">
        <div className="ds-nav-frame">
          <span className="nav-item">
            <Home aria-hidden />
            <span className="nav-text">Home</span>
          </span>
          <span className="nav-item active">
            <Compass aria-hidden />
            <span className="nav-text">Experiences</span>
          </span>
          <span className="nav-item disabled">
            <CalendarCheck aria-hidden />
            <span className="nav-text">Bookings</span>
          </span>
        </div>
      </Spec>
      <Spec title="Step rail" note=".rail-item · the wizard's secondary navigation">
        <div className="ds-nav-frame w-[260px] px-0">
          <div className="rail-label">New experience</div>
          <span className="rail-item">
            <Info aria-hidden />
            <span className="rail-name">Basic Info</span>
            <CheckCircle2 aria-label="Complete" className="rail-check" />
          </span>
          <span className="rail-item active">
            <MapPin aria-hidden />
            <span className="rail-name">Itinerary Builder</span>
            <span className="rail-count">2</span>
          </span>
          <span className="rail-item disabled">
            <IndianRupee aria-hidden />
            <span className="rail-name">Pricing Strategy</span>
            <span className="rail-count">4</span>
          </span>
        </div>
      </Spec>
      <Spec title="Breadcrumb" note=".card-crumbs · the last crumb is the page heading">
        <div className="card-crumbs m-0 border-0 p-0">
          <div className="card-crumbs-left">
            <a href="#c-nav">GoDND</a>
            <span className="sep" aria-hidden>
              /
            </span>
            <a href="#c-nav">Experiences</a>
            <span className="sep" aria-hidden>
              /
            </span>
            <span className="current">New experience</span>
          </div>
        </div>
      </Spec>
      <Spec title="Avatar" note=".avatar · gradient monogram on --brand-solid">
        <div className="ds-row">
          <button type="button" className="avatar" aria-label="Account menu for Dipendu">
            D
          </button>
        </div>
      </Spec>
    </Section>
  );
}

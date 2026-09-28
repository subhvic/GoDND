"use client";

import Link from "next/link";
import { useId } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock,
  Info,
  Landmark,
  ShieldCheck,
  User,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { useSettings } from "@/components/settings/settings-provider";
import { SETTINGS_SECTIONS, type SectionSlug } from "@/lib/settings/model";
import type { SectionHealth } from "@/lib/settings/rules";
import { cn } from "@/lib/utils";

const ICONS: Record<SectionSlug, LucideIcon> = {
  "basic-info": Info,
  compliance: ShieldCheck,
  financial: Landmark,
  certifications: BadgeCheck,
  operations: Wrench,
  profile: User,
  team: Users,
};

const HEALTH: Record<SectionHealth, { icon: LucideIcon; className: string }> = {
  complete: { icon: CheckCircle2, className: "rail-check" },
  in_review: { icon: Clock, className: "rail-wait" },
  attention: { icon: AlertTriangle, className: "rail-flag" },
};

/**
 * The seven sections (handoff: the "Itinerary Sub-tab" stack — the same
 * component as the experience wizard's rail, so it wears the same style).
 *
 * Each row ends in its state — a tick, a clock while GoDND verifies, a
 * warning when it needs the operator — except the current one, which gets
 * the file's arrow. The state is also spoken, since an icon alone isn't.
 * On a phone the rail becomes a native picker above the form.
 */
export function SettingsRail({ current }: { current: SectionSlug }) {
  const { progress } = useSettings();
  const health = (slug: SectionSlug) => progress.health.find((entry) => entry.slug === slug)!;

  return (
    <nav aria-label="Settings sections" className="rail settings-rail hidden md:block">
      <ol className="m-0 list-none p-0">
        {SETTINGS_SECTIONS.map((section) => {
          const Icon = ICONS[section.slug];
          const { health: state, reason } = health(section.slug);
          const isCurrent = section.slug === current;
          const Status = isCurrent ? ArrowRight : HEALTH[state].icon;
          return (
            <li key={section.slug}>
              <Link
                href={`/dashboard/settings/${section.slug}`}
                aria-current={isCurrent ? "page" : undefined}
                // The state is spoken as well as drawn; the name starts with
                // the visible label, so voice control still finds it.
                aria-label={`${section.label}, ${reason}`}
                className={cn("rail-item", isCurrent && "active")}
              >
                <Icon aria-hidden />
                <span className="rail-name">{section.label}</span>
                <Status aria-hidden className={isCurrent ? "rail-here" : HEALTH[state].className} />
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Phones: the rail as a native picker at the top of the section. */
export function SettingsPicker({ current }: { current: SectionSlug }) {
  const { progress, navigate } = useSettings();
  const pickerId = useId();
  const health = (slug: SectionSlug) => progress.health.find((entry) => entry.slug === slug)!;

  return (
    <div className="settings-picker md:hidden">
      <label htmlFor={pickerId} className="field-label">
        Section
      </label>
      <select
        id={pickerId}
        className="select has-value"
        value={current}
        onChange={(event) => navigate(`/dashboard/settings/${event.target.value}`)}
      >
        {SETTINGS_SECTIONS.map((section, index) => (
          <option key={section.slug} value={section.slug}>
            {index + 1}. {section.label} — {health(section.slug).reason}
          </option>
        ))}
      </select>
    </div>
  );
}

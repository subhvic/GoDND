"use client";

import { SectionBasicInfo } from "@/components/settings/section-basic-info";
import { SectionCertifications } from "@/components/settings/section-certifications";
import { SectionCompliance } from "@/components/settings/section-compliance";
import { SectionFinancial } from "@/components/settings/section-financial";
import { SectionOperations } from "@/components/settings/section-operations";
import { SectionProfile } from "@/components/settings/section-profile";
import { SectionTeam } from "@/components/settings/section-team";
import { SettingsPicker, SettingsRail } from "@/components/settings/settings-rail";
import type { SectionSlug } from "@/lib/settings/model";

const SECTIONS: Record<SectionSlug, () => React.ReactElement> = {
  "basic-info": SectionBasicInfo,
  compliance: SectionCompliance,
  financial: SectionFinancial,
  certifications: SectionCertifications,
  operations: SectionOperations,
  profile: SectionProfile,
  team: SectionTeam,
};

/**
 * The rail beside the section, on the body layer — the same "sidebar inside
 * the card" layout as the experience wizard. Keyed by the section so each one
 * mounts fresh with its own saved values.
 */
export function SettingsScreen({ slug }: { slug: SectionSlug }) {
  const Section = SECTIONS[slug];
  return (
    <div className="body-rail">
      <SettingsRail current={slug} />
      <div className="body-scroll settings-scroll">
        <SettingsPicker current={slug} />
        <Section key={slug} />
      </div>
    </div>
  );
}

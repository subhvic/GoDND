import "server-only";

import { connection } from "next/server";

import {
  EMPTY_VALUES,
  emptySection,
  type DocumentRef,
  type ReviewStatus,
  type ReviewedKey,
  type ReviewedSection,
  type ReviewedValues,
  type SettingsState,
  type TeamMemberRecord,
} from "@/lib/settings/model";
import type { Role } from "@/lib/settings/options";
import { can } from "@/lib/settings/rules";
import { todayInIndia } from "@/lib/settings/schema";
import { createServerSupabase } from "@/lib/supabase/server";

/*
 * Data access for Settings. Same contract as the other data files: live
 * reads run through the caller's session so RLS scopes them, and the
 * fixture applies only when Supabase isn't configured.
 *
 * Bank details are the one part a teammate may not see. A finance-less role
 * gets the Financial section's status — so the rail can say it's done — and
 * never its values: RLS keeps the row from them, and the status arrives
 * through profile_section_statuses(), which returns no data.
 */

export const isSettingsDemo = () =>
  !(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export type SettingsLoad = {
  state: SettingsState;
  isDemoData: boolean;
  /** Server clock at render, so both sides agree on what has expired. */
  now: string;
};

export async function getSettings(): Promise<SettingsLoad | null> {
  await connection();
  const now = new Date();
  if (isSettingsDemo()) return { state: demoSettings(now), isDemoData: true, now: now.toISOString() };
  const state = await liveSettings();
  return state ? { state, isDemoData: false, now: now.toISOString() } : null;
}

/* --------------------------------------------------------------------------
 * Live
 * ----------------------------------------------------------------------- */

export const SECTION_COLUMN: Record<ReviewedKey, string> = {
  basicInfo: "basic_info",
  compliance: "compliance",
  financial: "financial",
  certifications: "certifications",
  operations: "operations",
};

type SectionRow = {
  section: string;
  data: Record<string, unknown> | null;
  status: ReviewStatus;
  saved_at: string | null;
  submitted_at: string | null;
  verified_at: string | null;
  reviewer_note: string | null;
  flagged_fields: string[] | null;
  updated_by_name: string | null;
};

type StatusRow = Pick<SectionRow, "section" | "status" | "saved_at" | "submitted_at" | "verified_at" | "reviewer_note">;

type MemberRow = {
  id: string;
  user_id: string | null;
  invited_email: string | null;
  role: Role;
  status: "invited" | "active" | "disabled";
  created_at: string;
  invite_expires_at: string | null;
  accepted_at: string | null;
  profile: { full_name: string | null; email: string } | null;
  inviter: { full_name: string | null } | null;
};

async function liveSettings(): Promise<SettingsState | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("agency_members")
    .select("id, agency_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!membership) return null;

  const agencyId = membership.agency_id as string;
  const role = membership.role as Role;

  const [sections, statuses, profile, team, agency] = await Promise.all([
    supabase
      .from("agency_profile_sections")
      .select("section, data, status, saved_at, submitted_at, verified_at, reviewer_note, flagged_fields, updated_by_name")
      .eq("agency_id", agencyId),
    supabase.rpc("profile_section_statuses"),
    supabase.from("profiles").select("full_name, phone, designation, avatar_url, email").eq("id", user.id).single(),
    supabase
      .from("agency_members")
      .select(
        "id, user_id, invited_email, role, status, created_at, invite_expires_at, accepted_at, " +
          "profile:profiles!agency_members_user_id_fkey ( full_name, email ), " +
          "inviter:profiles!agency_members_invited_by_fkey ( full_name )",
      )
      .eq("agency_id", agencyId)
      .neq("status", "disabled")
      .order("created_at"),
    supabase.from("agencies").select("name").eq("id", agencyId).single(),
  ]);

  for (const result of [sections, statuses, profile, team]) {
    if (result.error) throw new Error(`Failed to load Settings: ${result.error.message}`);
  }

  const rows = (sections.data ?? []) as SectionRow[];
  const statusRows = (statuses.data ?? []) as StatusRow[];

  const section = <K extends ReviewedKey>(key: K): ReviewedSection<ReviewedValues[K]> => {
    const column = SECTION_COLUMN[key];
    const row = rows.find((entry) => entry.section === column);
    const meta = row ?? statusRows.find((entry) => entry.section === column);
    const base = emptySection(key);
    if (!meta) return base;
    return {
      values: { ...base.values, ...((row?.data ?? {}) as Partial<ReviewedValues[K]>) },
      status: meta.status,
      savedAt: meta.saved_at,
      submittedAt: meta.submitted_at,
      verifiedAt: meta.verified_at,
      reviewerNote: meta.reviewer_note,
      flaggedFields: row?.flagged_fields ?? [],
      updatedBy: row?.updated_by_name ?? null,
    };
  };

  const operations = section("operations");
  if (!operations.values.brandName && agency.data?.name) {
    operations.values = { ...operations.values, brandName: agency.data.name as string };
  }

  const financial = section("financial");
  if (!can(role, "view_financial")) financial.values = structuredClone(EMPTY_VALUES.financial);

  const me = profile.data as {
    full_name: string | null;
    phone: string | null;
    designation: string | null;
    avatar_url: string | null;
    email: string;
  };

  return {
    basicInfo: section("basicInfo"),
    compliance: section("compliance"),
    financial,
    certifications: section("certifications"),
    operations,
    profile: {
      values: {
        fullName: me.full_name ?? "",
        phone: me.phone ?? "",
        designation: me.designation ?? "",
        avatar: me.avatar_url ? storedDocument(me.avatar_url, "Profile photo") : null,
      },
      email: me.email,
      savedAt: null,
    },
    team: ((team.data ?? []) as unknown as MemberRow[]).map(toMember),
    viewer: { userId: user.id, memberId: membership.id as string, role, email: me.email, agencyId },
  };
}

function toMember(row: MemberRow): TeamMemberRecord {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.profile?.full_name ?? null,
    email: row.profile?.email ?? row.invited_email ?? "",
    role: row.role,
    status: row.status === "active" ? "active" : "invited",
    invitedAt: row.created_at,
    inviteExpiresAt: row.invite_expires_at,
    invitedBy: row.inviter?.full_name ?? null,
    joinedAt: row.accepted_at ?? (row.status === "active" ? row.created_at : null),
  };
}

function storedDocument(path: string, name: string): DocumentRef {
  return { id: path, name, sizeBytes: 0, mimeType: "image/*", uploadedAt: "", path };
}

/* --------------------------------------------------------------------------
 * Demo — the states the handoff file draws, on a workspace the rest of the
 * preview already uses (Wander Beyond, Dipendu as Admin). Basic Info and
 * Compliance are verified; Financial Details is empty; Certifications came
 * back with a change request; Operational Details is the filled-but-unsent
 * draft from the frame, still missing its languages; My Profile lacks a
 * phone number. Dates are relative to today so the expiring certificate
 * always expires soon and the expired one stays expired.
 * ----------------------------------------------------------------------- */

function demoSettings(nowDate: Date): SettingsState {
  const now = nowDate.getTime();
  const DAY = 86_400_000;
  const at = (days: number) => new Date(now + days * DAY).toISOString();
  const today = todayInIndia(nowDate);
  const dateIn = (days: number) => {
    const [year, month, day] = today.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
  };
  const doc = (id: string, name: string, sizeBytes: number, days: number, mimeType = "application/pdf"): DocumentRef => ({
    id,
    name,
    sizeBytes,
    mimeType,
    uploadedAt: at(days),
    path: null,
  });

  const verified = <T>(values: T, days: number): ReviewedSection<T> => ({
    values,
    status: "verified",
    savedAt: at(days - 3),
    submittedAt: at(days - 3),
    verifiedAt: at(days),
    reviewerNote: null,
    flaggedFields: [],
    updatedBy: "Rohit Sangha",
  });

  const expiredOn = dateIn(-107);

  return {
    basicInfo: verified(
      {
        logo: doc("doc-logo", "wander-beyond-logo.png", 48_210, -44, "image/png"),
        legalName: "Wander Beyond Travels LLP",
        businessType: "llp",
        establishedYear: "2019",
        addressLine1: "2nd Floor, Laitumkhrah Main Road",
        addressLine2: "Near Don Bosco Square",
        city: "Shillong",
        state: "ML",
        pincode: "793003",
        email: "hello@wanderbeyond.in",
        phone: "+91 98620 33145",
        website: "https://wanderbeyond.in",
      },
      -41,
    ),
    compliance: verified(
      {
        pan: "AAHFW4821K",
        panDocument: doc("doc-pan", "pan-card.pdf", 182_400, -44),
        gstRegistered: "yes",
        gstin: "17AAHFW4821K1ZU",
        gstDocument: doc("doc-gst", "gst-registration-certificate.pdf", 311_902, -44),
        registrationNumber: "AAQ-4821",
        registrationDocument: doc("doc-llp", "llp-incorporation-certificate.pdf", 402_118, -44),
        termsAccepted: true,
      },
      -40,
    ),
    financial: emptySection("financial"),
    certifications: {
      values: {
        certificates: [
          {
            id: "cert-tourism",
            type: "state_tourism",
            name: "",
            number: "MT/TO/2021/0417",
            issuer: "Directorate of Tourism, Meghalaya",
            validUntil: dateIn(410),
            document: doc("doc-tourism", "meghalaya-tourism-registration.pdf", 256_004, -21),
          },
          {
            id: "cert-wfa",
            type: "first_aid",
            name: "",
            number: "WFA-88213",
            issuer: "Indian Red Cross Society",
            validUntil: expiredOn,
            document: doc("doc-wfa", "wilderness-first-aid.pdf", 140_551, -21),
          },
          {
            id: "cert-atoai",
            type: "atoai",
            name: "",
            number: "ATOAI/LM/1123",
            issuer: "Adventure Tour Operators Association of India",
            validUntil: dateIn(45),
            document: doc("doc-atoai", "atoai-membership.pdf", 98_760, -21),
          },
        ],
      },
      status: "changes_requested",
      savedAt: at(-21),
      submittedAt: at(-21),
      verifiedAt: null,
      reviewerNote:
        "The wilderness first aid certificate has expired. Upload the renewed one, or remove it if your crew no longer holds it.",
      flaggedFields: ["certificates.cert-wfa"],
      updatedBy: "Dipendu Dey",
    },
    operations: {
      values: {
        brandName: "Wander Beyond",
        mission:
          "Small-group journeys through the root-bridge villages, river valleys and high passes of the North East, led by captains who grew up there. Every trip is paced for the place, not the itinerary.",
        regions: ["arunachal-pradesh", "meghalaya"],
        categories: ["adventure", "culture-heritage"],
        activities: ["rafting", "biking"],
        languages: [],
        otherDocuments: [doc("doc-pledge", "responsible-tourism-pledge.pdf", 64_300, -2)],
      },
      status: "draft",
      savedAt: at(-2),
      submittedAt: null,
      verifiedAt: null,
      reviewerNote: null,
      flaggedFields: [],
      updatedBy: "Dipendu Dey",
    },
    profile: {
      values: { fullName: "Dipendu Dey", phone: "", designation: "Operations lead", avatar: null },
      email: "dipendu@wanderbeyond.in",
      savedAt: null,
    },
    team: [
      member("u-rohit", "Rohit Sangha", "rohit@wanderbeyond.in", "owner", at(-760)),
      member("u-dipendu", "Dipendu Dey", "dipendu@wanderbeyond.in", "admin", at(-540)),
      member("u-riya", "Riya Das", "riya@wanderbeyond.in", "sales", at(-300)),
      member("u-arjun", "Arjun Gogoi", "arjun@wanderbeyond.in", "ops", at(-190)),
      {
        id: "inv-accounts",
        userId: null,
        name: null,
        email: "accounts@wanderbeyond.in",
        role: "finance",
        status: "invited",
        invitedAt: at(-2),
        inviteExpiresAt: at(5),
        invitedBy: "Rohit Sangha",
        joinedAt: null,
      },
    ],
    viewer: {
      userId: "u-dipendu",
      memberId: "u-dipendu",
      role: "admin",
      email: "dipendu@wanderbeyond.in",
      agencyId: "demo-agency",
    },
  };
}

function member(id: string, name: string, email: string, role: Role, joinedAt: string): TeamMemberRecord {
  return {
    id,
    userId: id,
    name,
    email,
    role,
    status: "active",
    invitedAt: joinedAt,
    inviteExpiresAt: null,
    invitedBy: null,
    joinedAt,
  };
}

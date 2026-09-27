import type { Status } from "@/lib/status";
import {
  REVIEWED_SLUGS,
  SETTINGS_SECTIONS,
  getSection,
  type ProfileValues,
  type ReviewedKey,
  type ReviewedSection,
  type ReviewedValues,
  type SectionSlug,
  type SettingsState,
  type TeamMemberRecord,
} from "@/lib/settings/model";
import { INVITE_VALID_DAYS, roleLabel, type Role } from "@/lib/settings/options";
import {
  draftSchemas,
  formatPhone,
  inviteSchema,
  normaliseWebsite,
  profileSchema,
  submitSchemaFor,
  todayInIndia,
} from "@/lib/settings/schema";
import { isValidEmail, normaliseEmail } from "@/lib/auth/config";

/**
 * The rules of Settings, as pure functions over SettingsState.
 *
 * The browser runs them for an instant update and the server runs them
 * again against the stored state before anything is written, so the two
 * can never disagree about what an action does — the same arrangement the
 * booking drawer uses.
 */

/* --------------------------------------------------------------------------
 * Permissions
 * ----------------------------------------------------------------------- */

export type Capability = "edit_business" | "view_financial" | "edit_financial" | "manage_team";

const CAPABILITIES: Record<Capability, Role[]> = {
  edit_business: ["owner", "admin"],
  view_financial: ["owner", "admin", "finance"],
  edit_financial: ["owner", "admin", "finance"],
  manage_team: ["owner", "admin"],
};

export const can = (role: Role, capability: Capability) => CAPABILITIES[capability].includes(role);

export function canEditSection(role: Role, key: ReviewedKey) {
  return key === "financial" ? can(role, "edit_financial") : can(role, "edit_business");
}

/** Why a team action isn't available on this member — or null when it is. */
export function teamActionBlock(
  state: SettingsState,
  member: TeamMemberRecord,
  action: "change_role" | "remove",
): string | null {
  if (!can(state.viewer.role, "manage_team")) return "Only owners and admins manage the team";
  if (member.id === state.viewer.memberId) {
    return action === "remove" ? "You can’t remove yourself" : "Ask another admin to change your role";
  }
  if (member.role === "owner") {
    return action === "remove" ? "The owner can’t be removed" : "The owner’s role changes only by transferring ownership";
  }
  return null;
}

/* --------------------------------------------------------------------------
 * Health — what the rail and the step bar show
 * ----------------------------------------------------------------------- */

export type SectionHealth = "complete" | "in_review" | "attention";

export const CERT_WARNING_DAYS = 60;

export function daysUntil(isoDate: string, today: string): number {
  return Math.round((Date.parse(`${isoDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

export function certificateExpiry(validUntil: string | null, today: string): { status: Status; label: string } {
  if (!validUntil) return { status: "healthy", label: "Doesn’t expire" };
  const days = daysUntil(validUntil, today);
  const date = formatIsoDate(validUntil);
  if (days < 0) return { status: "critical", label: `Expired on ${date}` };
  if (days === 0) return { status: "critical", label: "Expires today" };
  if (days <= CERT_WARNING_DAYS) return { status: "warning", label: `Expires in ${days} day${days === 1 ? "" : "s"}` };
  return { status: "healthy", label: `Valid until ${date}` };
}

export function formatIsoDate(isoDate: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

export function isProfileComplete(values: ProfileValues) {
  return profileSchema.safeParse(values).success;
}

export function sectionHealth(
  state: SettingsState,
  slug: SectionSlug,
  today: string = todayInIndia(),
): { health: SectionHealth; reason: string } {
  const section = getSection(slug)!;

  if (slug === "profile") {
    return isProfileComplete(state.profile.values)
      ? { health: "complete", reason: "Complete" }
      : { health: "attention", reason: "Add your phone number" };
  }
  if (slug === "team") {
    const members = state.team.filter((member) => member.status === "active").length;
    return { health: "complete", reason: `${members} ${members === 1 ? "member" : "members"}` };
  }

  const record = state[section.key as ReviewedKey] as ReviewedSection<ReviewedValues[ReviewedKey]>;

  if (slug === "certifications" && record.status !== null) {
    const expired = state.certifications.values.certificates.some(
      (certificate) => certificate.validUntil !== null && certificate.validUntil < today,
    );
    if (expired && record.status !== "changes_requested") {
      return { health: "attention", reason: "A certificate has expired" };
    }
  }

  switch (record.status) {
    case "verified":
      return { health: "complete", reason: "Verified" };
    case "submitted":
      return { health: "in_review", reason: "GoDND is verifying" };
    case "changes_requested":
      return { health: "attention", reason: "Changes requested" };
    case "draft":
      return { health: "attention", reason: "Not submitted" };
    default:
      return { health: "attention", reason: "Not started" };
  }
}

export function settingsProgress(state: SettingsState, today: string = todayInIndia()) {
  const health = SETTINGS_SECTIONS.map((section) => ({
    slug: section.slug,
    ...sectionHealth(state, section.slug, today),
  }));
  const reviewed = health.filter((entry) => (REVIEWED_SLUGS as string[]).includes(entry.slug));
  return {
    health,
    done: health.filter((entry) => entry.health !== "attention").length,
    total: health.length,
    /** Every business section verified: the marketplace gate is open. */
    listingReady: reviewed.every((entry) => entry.health === "complete"),
    /** Every business section at least sent: nothing left for the operator. */
    allSent: reviewed.every((entry) => entry.health !== "attention"),
    firstNeedingAttention: health.find((entry) => entry.health === "attention")?.slug ?? null,
  };
}

/* --------------------------------------------------------------------------
 * Actions
 * ----------------------------------------------------------------------- */

export type SettingsAction =
  | { type: "save_section"; section: ReviewedKey; values: unknown; submit: boolean }
  | { type: "save_profile"; values: ProfileValues }
  | { type: "change_email"; email: string }
  | { type: "invite_member"; email: string; name: string; role: Role }
  | { type: "resend_invite"; memberId: string }
  | { type: "revoke_invite"; memberId: string }
  | { type: "change_role"; memberId: string; role: Role }
  | { type: "remove_member"; memberId: string };

export type ActionContext = {
  now: Date;
  actorName: string;
  newId: () => string;
};

export type ActionResult =
  | { ok: true; state: SettingsState; message: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const fail = (error: string, fieldErrors?: Record<string, string>): ActionResult => ({
  ok: false,
  error,
  fieldErrors,
});

/** Zod issues keyed by dotted path — "certificates.0.validUntil". */
export function issuesByPath(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

export function applySettingsAction(state: SettingsState, action: SettingsAction, ctx: ActionContext): ActionResult {
  switch (action.type) {
    case "save_section":
      return saveSection(state, action.section, action.values, action.submit, ctx);
    case "save_profile":
      return saveProfile(state, action.values, ctx);
    case "change_email":
      return changeEmail(state, action.email);
    case "invite_member":
      return inviteMember(state, action, ctx);
    case "resend_invite":
      return resendInvite(state, action.memberId, ctx);
    case "revoke_invite":
      return revokeInvite(state, action.memberId);
    case "change_role":
      return changeRole(state, action.memberId, action.role);
    case "remove_member":
      return removeMember(state, action.memberId);
  }
}

const SUBMITTED_MESSAGE: Record<ReviewedKey, string> = {
  basicInfo: "Basic info sent to GoDND for verification.",
  compliance: "Compliance details sent to GoDND for verification.",
  financial: "Bank details sent to GoDND for verification.",
  certifications: "Certifications sent to GoDND for verification.",
  operations: "Operational details sent to GoDND for verification.",
};

function saveSection(
  state: SettingsState,
  key: ReviewedKey,
  raw: unknown,
  submit: boolean,
  ctx: ActionContext,
): ActionResult {
  if (!canEditSection(state.viewer.role, key)) {
    return fail(key === "financial" ? "Only owners, admins and finance can change bank details" : "Only owners and admins can change the business profile");
  }

  const current = state[key] as ReviewedSection<ReviewedValues[ReviewedKey]>;
  if (!submit && (current.status === "submitted" || current.status === "verified")) {
    // A verified section keeps one version: edits to it are submitted or
    // cancelled, never parked as a draft that would shadow what GoDND checked.
    return fail("Submit your changes or cancel them — a sent section can’t hold a draft");
  }

  const shape = draftSchemas[key].safeParse(raw);
  if (!shape.success) return fail("Some of these values couldn’t be saved", issuesByPath(shape.error.issues));

  const values = normaliseSection(key, shape.data as ReviewedValues[typeof key]);

  if (submit) {
    const businessType =
      key === "basicInfo" ? (values as ReviewedValues["basicInfo"]).businessType : state.basicInfo.values.businessType;
    if (key === "compliance" && !businessType) {
      return fail("Choose your form of business in Basic Info first — it decides which registration GoDND needs");
    }
    const full = submitSchemaFor(key, businessType).safeParse(values);
    if (!full.success) {
      const fieldErrors = issuesByPath(full.error.issues);
      const count = Object.keys(fieldErrors).length;
      return fail(`${count} field${count === 1 ? " needs" : "s need"} attention before this can be sent`, fieldErrors);
    }
  }

  const iso = ctx.now.toISOString();
  const next: ReviewedSection<ReviewedValues[typeof key]> = {
    ...current,
    values,
    status: submit ? "submitted" : current.status === "changes_requested" ? "changes_requested" : "draft",
    savedAt: iso,
    submittedAt: submit ? iso : current.submittedAt,
    verifiedAt: submit ? null : current.verifiedAt,
    // The operator has answered the reviewer once they resubmit; until then
    // the note stays on screen beside the fields it names.
    reviewerNote: submit ? null : current.reviewerNote,
    flaggedFields: submit ? [] : current.flaggedFields,
    updatedBy: ctx.actorName,
  };

  return {
    ok: true,
    state: { ...state, [key]: next },
    message: submit ? SUBMITTED_MESSAGE[key] : "Draft saved. It isn’t sent to GoDND until you submit it.",
  };
}

/** Canonical forms, so the same PAN typed two ways is stored one way. */
function normaliseSection<K extends ReviewedKey>(key: K, values: ReviewedValues[K]): ReviewedValues[K] {
  const upper = (value: string) => value.replace(/\s+/g, "").toUpperCase();
  switch (key) {
    case "basicInfo": {
      const v = values as ReviewedValues["basicInfo"];
      return {
        ...v,
        email: normaliseEmail(v.email),
        phone: v.phone ? formatPhone(v.phone) : "",
        website: normaliseWebsite(v.website),
      } as ReviewedValues[K];
    }
    case "compliance": {
      const v = values as ReviewedValues["compliance"];
      const registered = v.gstRegistered === "yes";
      return {
        ...v,
        pan: upper(v.pan),
        gstin: registered ? upper(v.gstin) : "",
        gstDocument: registered ? v.gstDocument : null,
        registrationNumber: upper(v.registrationNumber),
      } as ReviewedValues[K];
    }
    case "financial": {
      const v = values as ReviewedValues["financial"];
      return { ...v, ifsc: upper(v.ifsc), accountNumber: v.accountNumber.replace(/\s+/g, "") } as ReviewedValues[K];
    }
    case "certifications": {
      const v = values as ReviewedValues["certifications"];
      return {
        certificates: v.certificates.map((certificate) => ({ ...certificate, number: certificate.number.trim() })),
      } as ReviewedValues[K];
    }
    default:
      return values;
  }
}

function saveProfile(state: SettingsState, raw: ProfileValues, ctx: ActionContext): ActionResult {
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return fail("Check the highlighted fields", issuesByPath(parsed.error.issues));
  const values = { ...parsed.data, phone: formatPhone(parsed.data.phone) };
  return {
    ok: true,
    state: {
      ...state,
      profile: { ...state.profile, values, savedAt: ctx.now.toISOString() },
      team: state.team.map((member) =>
        member.id === state.viewer.memberId ? { ...member, name: values.fullName } : member,
      ),
    },
    message: "Profile saved.",
  };
}

function changeEmail(state: SettingsState, raw: string): ActionResult {
  const email = normaliseEmail(raw);
  if (!isValidEmail(email)) return fail("Enter an address like name@company.com", { email: "Enter an address like name@company.com" });
  if (email === state.profile.email) return fail("That’s already your sign-in address", { email: "That’s already your sign-in address" });
  if (state.team.some((member) => member.email === email && member.id !== state.viewer.memberId)) {
    return fail("That address belongs to someone on your team", { email: "That address belongs to someone on your team" });
  }
  return {
    ok: true,
    state: {
      ...state,
      profile: { ...state.profile, email },
      viewer: { ...state.viewer, email },
      team: state.team.map((member) => (member.id === state.viewer.memberId ? { ...member, email } : member)),
    },
    message: `You now sign in with ${email}.`,
  };
}

const plusDays = (now: Date, days: number) => new Date(now.getTime() + days * 86_400_000).toISOString();

const memberName = (member: TeamMemberRecord) => member.name ?? member.email;

function inviteMember(
  state: SettingsState,
  input: { email: string; name: string; role: Role },
  ctx: ActionContext,
): ActionResult {
  if (!can(state.viewer.role, "manage_team")) return fail("Only owners and admins can invite people");
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields", issuesByPath(parsed.error.issues));

  const email = normaliseEmail(parsed.data.email);
  const existing = state.team.find((member) => member.email === email);
  if (existing?.status === "active") {
    return fail(`${memberName(existing)} is already on your team`, { email: "Already on your team" });
  }
  if (existing?.status === "invited") {
    return fail(`${email} already has an invite — resend it from the list instead`, {
      email: "Already invited — resend it from the list",
    });
  }

  const member: TeamMemberRecord = {
    id: ctx.newId(),
    userId: null,
    name: parsed.data.name.trim() || null,
    email,
    role: parsed.data.role as Role,
    status: "invited",
    invitedAt: ctx.now.toISOString(),
    inviteExpiresAt: plusDays(ctx.now, INVITE_VALID_DAYS),
    invitedBy: ctx.actorName,
    joinedAt: null,
  };
  return {
    ok: true,
    state: { ...state, team: [...state.team, member] },
    message: `Invite sent to ${email}. It’s valid for ${INVITE_VALID_DAYS} days.`,
  };
}

function findMember(state: SettingsState, memberId: string) {
  return state.team.find((member) => member.id === memberId) ?? null;
}

function resendInvite(state: SettingsState, memberId: string, ctx: ActionContext): ActionResult {
  if (!can(state.viewer.role, "manage_team")) return fail("Only owners and admins can resend invites");
  const member = findMember(state, memberId);
  if (!member || member.status !== "invited") return fail("That invite no longer exists");
  return {
    ok: true,
    state: {
      ...state,
      team: state.team.map((entry) =>
        entry.id === memberId
          ? { ...entry, invitedAt: ctx.now.toISOString(), inviteExpiresAt: plusDays(ctx.now, INVITE_VALID_DAYS), invitedBy: ctx.actorName }
          : entry,
      ),
    },
    message: `Invite sent again to ${member.email}.`,
  };
}

function revokeInvite(state: SettingsState, memberId: string): ActionResult {
  if (!can(state.viewer.role, "manage_team")) return fail("Only owners and admins can withdraw invites");
  const member = findMember(state, memberId);
  if (!member || member.status !== "invited") return fail("That invite no longer exists");
  return {
    ok: true,
    state: { ...state, team: state.team.filter((entry) => entry.id !== memberId) },
    message: `Invite to ${member.email} withdrawn. The link in their email no longer works.`,
  };
}

function changeRole(state: SettingsState, memberId: string, role: Role): ActionResult {
  const member = findMember(state, memberId);
  if (!member) return fail("That person is no longer on your team");
  const blocked = teamActionBlock(state, member, "change_role");
  if (blocked) return fail(blocked);
  if (role === "owner") return fail("Ownership is transferred, not granted");
  if (member.role === role) return { ok: true, state, message: `${memberName(member)} is already ${roleLabel(role)}.` };
  return {
    ok: true,
    state: { ...state, team: state.team.map((entry) => (entry.id === memberId ? { ...entry, role } : entry)) },
    message: `${memberName(member)} is now ${roleLabel(role)}.`,
  };
}

function removeMember(state: SettingsState, memberId: string): ActionResult {
  const member = findMember(state, memberId);
  if (!member) return fail("That person is no longer on your team");
  const blocked = teamActionBlock(state, member, "remove");
  if (blocked) return fail(blocked);
  return {
    ok: true,
    state: { ...state, team: state.team.filter((entry) => entry.id !== memberId) },
    message: `${memberName(member)} no longer has access to this workspace.`,
  };
}

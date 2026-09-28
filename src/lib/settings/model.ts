import type { BusinessType, CertificateType, Role } from "@/lib/settings/options";

/**
 * Settings — the vendor profile (handoff: frames named "Vendor Admin - …").
 *
 * Seven sections in the file's order. The first five describe the business
 * and are checked by GoDND before the operator can list on the marketplace
 * ("All fields mandatory to start listing experiences at GoDND"); the last
 * two are about the person signed in and their team, and save directly.
 */

export const SETTINGS_SECTIONS = [
  {
    slug: "basic-info",
    key: "basicInfo",
    label: "Basic Info",
    reviewed: true,
    pending: "Your basic info is yet to be submitted.",
    description: "Who you are on paper: legal name, form of business and registered address.",
  },
  {
    slug: "compliance",
    key: "compliance",
    label: "Compliance",
    reviewed: true,
    pending: "Your compliance details are yet to be submitted.",
    description: "PAN, GST and registration — what GoDND needs to pay you and invoice guests.",
  },
  {
    slug: "financial",
    key: "financial",
    label: "Financial Details",
    reviewed: true,
    pending: "Your bank details are yet to be submitted.",
    description: "The account your payouts go to.",
  },
  {
    slug: "certifications",
    key: "certifications",
    label: "Certifications & Accreditations",
    reviewed: true,
    pending: "Your certifications are yet to be submitted.",
    description: "Licences and memberships travellers and GoDND can rely on.",
  },
  {
    slug: "operations",
    key: "operations",
    label: "Operational Details",
    reviewed: true,
    pending: "Your operational details are yet to be submitted.",
    description: "How you present yourself and where you run trips.",
  },
  {
    slug: "profile",
    key: "profile",
    label: "My Profile",
    reviewed: false,
    pending: null,
    description: "Your own details. Travellers see your name on trips you captain.",
  },
  {
    slug: "team",
    key: "team",
    label: "My Team",
    reviewed: false,
    pending: null,
    description: "Everyone who can sign in to this workspace, and what they can do.",
  },
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];
export type SectionSlug = SettingsSection["slug"];
export type ReviewedSlug = Extract<SettingsSection, { reviewed: true }>["slug"];
export type ReviewedKey = Extract<SettingsSection, { reviewed: true }>["key"];

export const REVIEWED_SLUGS = SETTINGS_SECTIONS.filter((section) => section.reviewed).map(
  (section) => section.slug,
) as ReviewedSlug[];

export const getSection = (slug: string) =>
  SETTINGS_SECTIONS.find((section) => section.slug === slug) ?? null;

export const isSectionSlug = (value: string): value is SectionSlug =>
  SETTINGS_SECTIONS.some((section) => section.slug === value);

export const isReviewedSlug = (value: string): value is ReviewedSlug =>
  (REVIEWED_SLUGS as string[]).includes(value);

export const sectionIndex = (slug: SectionSlug) =>
  SETTINGS_SECTIONS.findIndex((section) => section.slug === slug);

export function adjacentSections(slug: SectionSlug) {
  const index = sectionIndex(slug);
  return {
    previous: SETTINGS_SECTIONS[index - 1] ?? null,
    next: SETTINGS_SECTIONS[index + 1] ?? null,
  };
}

/* --------------------------------------------------------------------------
 * Values
 * ----------------------------------------------------------------------- */

/**
 * An uploaded file. `path` is its object in the agency-documents bucket;
 * `previewUrl` is a blob URL for a file picked in this tab, so the operator
 * can open what they just attached before anything has been stored.
 */
export type DocumentRef = {
  id: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
  uploadedAt: string;
  path: string | null;
  previewUrl?: string | null;
};

export type BasicInfoValues = {
  logo: DocumentRef | null;
  legalName: string;
  businessType: BusinessType | "";
  establishedYear: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  email: string;
  phone: string;
  website: string;
};

export type ComplianceValues = {
  pan: string;
  panDocument: DocumentRef | null;
  gstRegistered: "yes" | "no" | "";
  gstin: string;
  gstDocument: DocumentRef | null;
  registrationNumber: string;
  registrationDocument: DocumentRef | null;
  termsAccepted: boolean;
};

export type FinancialValues = {
  accountHolder: string;
  accountNumber: string;
  ifsc: string;
  accountType: "current" | "savings" | "";
  proof: DocumentRef | null;
};

export type Certificate = {
  id: string;
  type: CertificateType;
  /** Required for "other"; otherwise the type's label is the name. */
  name: string;
  number: string;
  issuer: string;
  /** ISO date; null when the certificate doesn't expire. */
  validUntil: string | null;
  document: DocumentRef | null;
};

export type CertificationsValues = {
  certificates: Certificate[];
};

export type OperationsValues = {
  brandName: string;
  mission: string;
  regions: string[];
  categories: string[];
  activities: string[];
  languages: string[];
  otherDocuments: DocumentRef[];
};

export type ReviewedValues = {
  basicInfo: BasicInfoValues;
  compliance: ComplianceValues;
  financial: FinancialValues;
  certifications: CertificationsValues;
  operations: OperationsValues;
};

/**
 * Where a reviewed section stands with GoDND. `null` is "never saved" — the
 * handoff file's Empty state.
 */
export type ReviewStatus = "draft" | "submitted" | "verified" | "changes_requested";

export type ReviewedSection<T> = {
  values: T;
  status: ReviewStatus | null;
  savedAt: string | null;
  submittedAt: string | null;
  verifiedAt: string | null;
  /** GoDND's reason, when it asks for changes. */
  reviewerNote: string | null;
  /** Field names the reviewer pointed at. */
  flaggedFields: string[];
  /** Who last saved it, for "Submitted by …". */
  updatedBy: string | null;
};

export type ProfileValues = {
  fullName: string;
  phone: string;
  designation: string;
  avatar: DocumentRef | null;
};

export type MemberStatus = "active" | "invited";

export type TeamMemberRecord = {
  id: string;
  userId: string | null;
  name: string | null;
  email: string;
  role: Role;
  status: MemberStatus;
  invitedAt: string | null;
  inviteExpiresAt: string | null;
  invitedBy: string | null;
  joinedAt: string | null;
};

export type Viewer = {
  userId: string;
  memberId: string;
  role: Role;
  email: string;
  /** Uploads go under this folder in the agency-documents bucket. */
  agencyId: string;
};

export type SettingsState = {
  basicInfo: ReviewedSection<BasicInfoValues>;
  compliance: ReviewedSection<ComplianceValues>;
  /** Values are blanked for a role that may not see bank details. */
  financial: ReviewedSection<FinancialValues>;
  certifications: ReviewedSection<CertificationsValues>;
  operations: ReviewedSection<OperationsValues>;
  profile: { values: ProfileValues; email: string; savedAt: string | null };
  team: TeamMemberRecord[];
  viewer: Viewer;
};

export const EMPTY_VALUES: ReviewedValues = {
  basicInfo: {
    logo: null,
    legalName: "",
    businessType: "",
    establishedYear: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    pincode: "",
    email: "",
    phone: "",
    website: "",
  },
  compliance: {
    pan: "",
    panDocument: null,
    gstRegistered: "",
    gstin: "",
    gstDocument: null,
    registrationNumber: "",
    registrationDocument: null,
    termsAccepted: false,
  },
  financial: {
    accountHolder: "",
    accountNumber: "",
    ifsc: "",
    accountType: "",
    proof: null,
  },
  certifications: { certificates: [] },
  operations: {
    brandName: "",
    mission: "",
    regions: [],
    categories: [],
    activities: [],
    languages: [],
    otherDocuments: [],
  },
};

export function emptySection<K extends ReviewedKey>(key: K): ReviewedSection<ReviewedValues[K]> {
  return {
    values: structuredClone(EMPTY_VALUES[key]),
    status: null,
    savedAt: null,
    submittedAt: null,
    verifiedAt: null,
    reviewerNote: null,
    flaggedFields: [],
    updatedBy: null,
  };
}

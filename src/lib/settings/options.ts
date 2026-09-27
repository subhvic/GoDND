/**
 * Reference lists for Settings. Each one is a fact about India or about the
 * product's roles, not a design choice, so they live apart from the forms
 * that use them and the server validates against the same lists.
 */

/** Every state and UT with its GST state code, alphabetical. */
export const INDIA_STATES = [
  { value: "AN", label: "Andaman and Nicobar Islands", gst: "35" },
  { value: "AP", label: "Andhra Pradesh", gst: "37" },
  { value: "AR", label: "Arunachal Pradesh", gst: "12" },
  { value: "AS", label: "Assam", gst: "18" },
  { value: "BR", label: "Bihar", gst: "10" },
  { value: "CH", label: "Chandigarh", gst: "04" },
  { value: "CG", label: "Chhattisgarh", gst: "22" },
  { value: "DN", label: "Dadra and Nagar Haveli and Daman and Diu", gst: "26" },
  { value: "DL", label: "Delhi", gst: "07" },
  { value: "GA", label: "Goa", gst: "30" },
  { value: "GJ", label: "Gujarat", gst: "24" },
  { value: "HR", label: "Haryana", gst: "06" },
  { value: "HP", label: "Himachal Pradesh", gst: "02" },
  { value: "JK", label: "Jammu and Kashmir", gst: "01" },
  { value: "JH", label: "Jharkhand", gst: "20" },
  { value: "KA", label: "Karnataka", gst: "29" },
  { value: "KL", label: "Kerala", gst: "32" },
  { value: "LA", label: "Ladakh", gst: "38" },
  { value: "LD", label: "Lakshadweep", gst: "31" },
  { value: "MP", label: "Madhya Pradesh", gst: "23" },
  { value: "MH", label: "Maharashtra", gst: "27" },
  { value: "MN", label: "Manipur", gst: "14" },
  { value: "ML", label: "Meghalaya", gst: "17" },
  { value: "MZ", label: "Mizoram", gst: "15" },
  { value: "NL", label: "Nagaland", gst: "13" },
  { value: "OD", label: "Odisha", gst: "21" },
  { value: "PY", label: "Puducherry", gst: "34" },
  { value: "PB", label: "Punjab", gst: "03" },
  { value: "RJ", label: "Rajasthan", gst: "08" },
  { value: "SK", label: "Sikkim", gst: "11" },
  { value: "TN", label: "Tamil Nadu", gst: "33" },
  { value: "TS", label: "Telangana", gst: "36" },
  { value: "TR", label: "Tripura", gst: "16" },
  { value: "UP", label: "Uttar Pradesh", gst: "09" },
  { value: "UK", label: "Uttarakhand", gst: "05" },
  { value: "WB", label: "West Bengal", gst: "19" },
] as const;

export const stateLabel = (value: string) =>
  INDIA_STATES.find((state) => state.value === value)?.label ?? value;

export const stateForGstCode = (code: string) =>
  INDIA_STATES.find((state) => state.gst === code) ?? null;

/**
 * The legal forms a travel operator takes. `panHolder` is the fourth letter
 * of a PAN issued to that form of entity — the Income Tax Department's own
 * scheme — so a company that types its director's personal PAN is caught
 * before verification bounces it. Trusts and societies are issued more than
 * one letter, so they aren't checked.
 */
export const BUSINESS_TYPES = [
  { value: "sole_proprietorship", label: "Sole proprietorship", panHolder: "P", registration: "udyam" },
  { value: "partnership", label: "Partnership firm", panHolder: "F", registration: "udyam" },
  { value: "llp", label: "Limited liability partnership (LLP)", panHolder: "F", registration: "llpin" },
  { value: "private_limited", label: "Private limited company", panHolder: "C", registration: "cin" },
  { value: "opc", label: "One person company (OPC)", panHolder: "C", registration: "cin" },
  { value: "trust_society", label: "Trust or society", panHolder: null, registration: "udyam" },
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number]["value"];

export const businessTypeInfo = (value: string) =>
  BUSINESS_TYPES.find((type) => type.value === value) ?? null;

export const PAN_HOLDER_LABELS: Record<string, string> = {
  P: "an individual",
  C: "a company",
  F: "a firm or LLP",
  H: "a Hindu undivided family",
  A: "an association of persons",
  T: "a trust",
  B: "a body of individuals",
  L: "a local authority",
  J: "an artificial juridical person",
  G: "a government body",
};

/** What the business registration number is called, by legal form. */
export const REGISTRATION_LABELS = {
  cin: { label: "Corporate Identification Number (CIN)", placeholder: "U63030ML2019PTC012345", required: true },
  llpin: { label: "LLP Identification Number (LLPIN)", placeholder: "AAB-1234", required: true },
  udyam: { label: "Udyam registration number", placeholder: "UDYAM-ML-01-0012345", required: false },
} as const;

export const ACCOUNT_TYPES = [
  { value: "current", label: "Current account" },
  { value: "savings", label: "Savings account" },
] as const;

/**
 * Bank from the first four letters of an IFSC. The prefix is the bank's
 * code in the RBI's scheme, so this is exact for the banks listed and says
 * nothing about the rest — an unknown prefix shows no name rather than a
 * guess.
 */
const IFSC_BANKS: Record<string, string> = {
  SBIN: "State Bank of India",
  HDFC: "HDFC Bank",
  ICIC: "ICICI Bank",
  UTIB: "Axis Bank",
  PUNB: "Punjab National Bank",
  BARB: "Bank of Baroda",
  UBIN: "Union Bank of India",
  CNRB: "Canara Bank",
  KKBK: "Kotak Mahindra Bank",
  YESB: "Yes Bank",
  IDIB: "Indian Bank",
  IOBA: "Indian Overseas Bank",
  UCBA: "UCO Bank",
  BKID: "Bank of India",
  CBIN: "Central Bank of India",
  MAHB: "Bank of Maharashtra",
  IDFB: "IDFC FIRST Bank",
  INDB: "IndusInd Bank",
  FDRL: "Federal Bank",
  KARB: "Karnataka Bank",
  PSIB: "Punjab & Sind Bank",
  AUBL: "AU Small Finance Bank",
  BDBL: "Bandhan Bank",
  IBKL: "IDBI Bank",
  RATN: "RBL Bank",
  SIBL: "South Indian Bank",
  KVBL: "Karur Vysya Bank",
  JAKA: "Jammu & Kashmir Bank",
  CITI: "Citibank",
  HSBC: "HSBC",
  SCBL: "Standard Chartered",
  DBSS: "DBS Bank India",
};

export const bankForIfsc = (ifsc: string) => IFSC_BANKS[ifsc.slice(0, 4).toUpperCase()] ?? null;

/**
 * Accreditations an Indian adventure or tour operator is likely to hold.
 * `issuer` pre-fills the issuing body where there is only one.
 */
export const CERTIFICATE_TYPES = [
  { value: "state_tourism", label: "State tourism registration", issuer: "" },
  { value: "mot_approval", label: "Ministry of Tourism approval", issuer: "Ministry of Tourism, Government of India" },
  { value: "atoai", label: "ATOAI membership", issuer: "Adventure Tour Operators Association of India" },
  { value: "iato", label: "IATO membership", issuer: "Indian Association of Tour Operators" },
  { value: "adtoi", label: "ADTOI membership", issuer: "Association of Domestic Tour Operators of India" },
  { value: "adventure_licence", label: "Adventure activity licence", issuer: "" },
  { value: "first_aid", label: "Wilderness first aid", issuer: "" },
  { value: "other", label: "Other", issuer: "" },
] as const;

export type CertificateType = (typeof CERTIFICATE_TYPES)[number]["value"];

export const certificateTypeLabel = (value: string) =>
  CERTIFICATE_TYPES.find((type) => type.value === value)?.label ?? value;

/**
 * The five workspace roles from 0001_foundation.sql. The handoff file draws
 * My Team but no role picker or permission matrix, so what each role may do
 * is decided here — and said in one line wherever a role is chosen, because
 * a role name alone doesn't tell anyone what they are granting.
 */
export const ROLES = [
  { value: "owner", label: "Owner", description: "Everything, including who owns the workspace. One per workspace." },
  { value: "admin", label: "Admin", description: "Everything except transferring ownership." },
  { value: "sales", label: "Sales", description: "Enquiries, bookings and experiences. No bank details or team." },
  { value: "ops", label: "Operations", description: "Bookings, trip days and crew. No bank details or team." },
  { value: "finance", label: "Finance", description: "Transactions, payouts and bank details. No team." },
] as const;

export type Role = (typeof ROLES)[number]["value"];

export const roleLabel = (role: string) => ROLES.find((item) => item.value === role)?.label ?? role;

/** Roles an admin can hand out. Owner is transferred, never granted. */
export const ASSIGNABLE_ROLES = ROLES.filter((role) => role.value !== "owner");

export const DOCUMENT_LIMITS = {
  maxBytes: 5 * 1024 * 1024,
  types: ["application/pdf", "image/jpeg", "image/png"],
  accept: "application/pdf,image/jpeg,image/png",
  label: "PDF, JPG or PNG, up to 5 MB",
} as const;

export const IMAGE_LIMITS = {
  maxBytes: 2 * 1024 * 1024,
  types: ["image/jpeg", "image/png", "image/webp"],
  accept: "image/jpeg,image/png,image/webp",
  label: "JPG, PNG or WebP, up to 2 MB",
} as const;

export const INVITE_VALID_DAYS = 7;

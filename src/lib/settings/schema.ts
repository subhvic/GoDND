import { z } from "zod";

import { isValidEmail, normaliseEmail } from "@/lib/auth/config";
import {
  ACTIVITY_OPTIONS,
  CATEGORY_OPTIONS,
  LANGUAGE_OPTIONS,
  REGION_OPTIONS,
} from "@/lib/experience-wizard/options";
import {
  ASSIGNABLE_ROLES,
  BUSINESS_TYPES,
  CERTIFICATE_TYPES,
  DOCUMENT_LIMITS,
  INDIA_STATES,
  PAN_HOLDER_LABELS,
  REGISTRATION_LABELS,
  businessTypeInfo,
  stateForGstCode,
} from "@/lib/settings/options";

/**
 * Validation for Settings, shared by the forms and the server actions.
 *
 * "Save draft" stores whatever has been typed; these schemas run when a
 * section is submitted to GoDND, and again on the server, which trusts
 * nothing the browser already checked. Messages name the fix, not the rule:
 * "PAN has 10 characters" rather than "Invalid format".
 */

const required = (label: string) => z.string().trim().min(1, `${label} is required`);

const text = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters`);

export const documentSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  sizeBytes: z.number().int().min(0).max(DOCUMENT_LIMITS.maxBytes),
  mimeType: z.string().max(100),
  uploadedAt: z.string().max(40),
  path: z.string().max(400).nullable(),
  previewUrl: z.string().max(2000).nullable().optional(),
});

const requiredDocument = (message: string) =>
  documentSchema.nullable().refine((value) => value !== null, message);

/* --------------------------------------------------------------------------
 * Indian identifiers
 * ----------------------------------------------------------------------- */

export const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GSTIN_PATTERN = /^(\d{2})([A-Z]{5}\d{4}[A-Z])([1-9A-Z])Z([0-9A-Z])$/;
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const CIN_PATTERN = /^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/;
const LLPIN_PATTERN = /^[A-Z]{3}-\d{4}$/;
const UDYAM_PATTERN = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/;

export const cleanId = (value: string) => value.replace(/\s+/g, "").toUpperCase();

export function panError(raw: string, businessType: string): string | null {
  const pan = cleanId(raw);
  if (!pan) return "PAN is required";
  if (pan.length !== 10) return "PAN has 10 characters, like AAHFW4821K";
  if (!PAN_PATTERN.test(pan)) return "PAN is five letters, four digits, then a letter";
  const expected = businessTypeInfo(businessType)?.panHolder;
  if (expected && pan[3] !== expected) {
    const got = PAN_HOLDER_LABELS[pan[3]] ?? "another kind of holder";
    const want = PAN_HOLDER_LABELS[expected];
    return `This PAN belongs to ${got} — the business’s own PAN is issued to ${want} (4th letter ${expected})`;
  }
  return null;
}

const GSTIN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** The GSTN check digit: a Luhn mod-36 over the first 14 characters. */
function gstinCheckDigit(gstin: string): string {
  let factor = 1;
  let sum = 0;
  for (let index = 0; index < 14; index += 1) {
    const product = factor * GSTIN_CHARS.indexOf(gstin[index]);
    factor = factor === 2 ? 1 : 2;
    sum += Math.floor(product / 36) + (product % 36);
  }
  return GSTIN_CHARS[(36 - (sum % 36)) % 36];
}

export function gstinError(raw: string, rawPan: string): string | null {
  const gstin = cleanId(raw);
  if (!gstin) return "GSTIN is required";
  if (gstin.length !== 15) return "GSTIN has 15 characters, like 17AAHFW4821K1ZU";
  const match = GSTIN_PATTERN.exec(gstin);
  if (!match) return "That doesn’t look like a GSTIN — check each character against your certificate";
  if (!stateForGstCode(match[1])) return `${match[1]} isn’t a state code — a GSTIN starts with its state’s two digits`;
  if (gstinCheckDigit(gstin) !== gstin[14]) {
    return "The last character doesn’t check out, so one character is likely mistyped";
  }
  const pan = cleanId(rawPan);
  if (PAN_PATTERN.test(pan) && match[2] !== pan) {
    return `Characters 3 to 12 of a GSTIN are the PAN — this one carries ${match[2]}, not ${pan}`;
  }
  return null;
}

export function ifscError(raw: string): string | null {
  const ifsc = cleanId(raw);
  if (!ifsc) return "IFSC is required";
  if (ifsc.length !== 11) return "IFSC has 11 characters, like SBIN0001234";
  if (ifsc[4] !== "0") return "The fifth character of an IFSC is always zero";
  if (!IFSC_PATTERN.test(ifsc)) return "IFSC is four letters, a zero, then six letters or digits";
  return null;
}

/**
 * An Indian number as ten digits, whatever it was typed with: +91, a
 * leading 0, spaces, dashes or brackets. Null when it isn't one.
 */
export function phoneDigits(raw: string): string | null {
  let digits = raw.replace(/[\s\-().]/g, "");
  if (digits.startsWith("+91")) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[1-9]\d{9}$/.test(digits) ? digits : null;
}

/** "+91 98640 11223" — mobile grouping; landlines read fine in it too. */
export function formatPhone(raw: string): string {
  const digits = phoneDigits(raw);
  return digits ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` : raw.trim();
}

const phoneSchema = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine((value) => phoneDigits(value) !== null, "Enter a 10-digit Indian number");

const emailSchema = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine((value) => isValidEmail(normaliseEmail(value)), "Enter an address like name@company.com");

export function normaliseWebsite(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function isWebsite(raw: string): boolean {
  try {
    const url = new URL(normaliseWebsite(raw));
    return /^https?:$/.test(url.protocol) && /\.[a-z]{2,}$/i.test(url.hostname);
  } catch {
    return false;
  }
}

/* --------------------------------------------------------------------------
 * Sections
 * ----------------------------------------------------------------------- */

const STATE_VALUES = INDIA_STATES.map((state) => state.value) as [string, ...string[]];
const TYPE_VALUES = BUSINESS_TYPES.map((type) => type.value) as [string, ...string[]];

export const basicInfoSchema = z.object({
  logo: requiredDocument("Upload your logo — it sits beside your name on every listing"),
  legalName: required("Legal name").pipe(text(120)),
  businessType: z.enum(TYPE_VALUES, { error: "Choose how your business is registered" }),
  establishedYear: z
    .string()
    .trim()
    .min(1, "Year established is required")
    .refine((value) => {
      const year = Number(value);
      return /^\d{4}$/.test(value) && year >= 1900 && year <= new Date().getFullYear();
    }, "Enter a four-digit year, not in the future"),
  addressLine1: required("Address").pipe(text(120)),
  addressLine2: text(120),
  city: required("City").pipe(text(60)),
  state: z.enum(STATE_VALUES, { error: "Choose a state" }),
  pincode: z
    .string()
    .trim()
    .min(1, "PIN code is required")
    .regex(/^[1-9]\d{5}$/, "PIN code is six digits and doesn’t start with 0"),
  email: emailSchema("Business email"),
  phone: phoneSchema("Business phone"),
  website: z
    .string()
    .trim()
    .max(200)
    .refine((value) => !value || isWebsite(value), "Enter a web address like wanderbeyond.in"),
});

/** Compliance depends on the legal form chosen in Basic Info. */
export function complianceSchema(businessType: string) {
  const registration = REGISTRATION_LABELS[businessTypeInfo(businessType)?.registration ?? "udyam"];
  const kind = businessTypeInfo(businessType)?.registration ?? "udyam";

  return z
    .object({
      pan: z.string(),
      panDocument: requiredDocument("Upload a copy of the PAN card"),
      gstRegistered: z.enum(["yes", "no"], { error: "Tell us whether you’re registered for GST" }),
      gstin: z.string(),
      gstDocument: documentSchema.nullable(),
      registrationNumber: z.string(),
      registrationDocument: documentSchema.nullable(),
      termsAccepted: z.boolean().refine((value) => value, "Accept the vendor terms to continue"),
    })
    .superRefine((values, ctx) => {
      const pan = panError(values.pan, businessType);
      if (pan) ctx.addIssue({ code: "custom", path: ["pan"], message: pan });

      if (values.gstRegistered === "yes") {
        const gstin = gstinError(values.gstin, values.pan);
        if (gstin) ctx.addIssue({ code: "custom", path: ["gstin"], message: gstin });
        if (!values.gstDocument) {
          ctx.addIssue({ code: "custom", path: ["gstDocument"], message: "Upload your GST registration certificate" });
        }
      }

      const number = cleanId(values.registrationNumber);
      if (!number) {
        if (registration.required) {
          ctx.addIssue({ code: "custom", path: ["registrationNumber"], message: `${registration.label} is required` });
        }
      } else {
        const pattern = kind === "cin" ? CIN_PATTERN : kind === "llpin" ? LLPIN_PATTERN : UDYAM_PATTERN;
        if (!pattern.test(number)) {
          ctx.addIssue({
            code: "custom",
            path: ["registrationNumber"],
            message: `That doesn’t match the format, e.g. ${registration.placeholder}`,
          });
        }
      }
      if (registration.required && !values.registrationDocument) {
        ctx.addIssue({
          code: "custom",
          path: ["registrationDocument"],
          message: "Upload your certificate of incorporation",
        });
      }
    });
}

export const financialSchema = z.object({
  accountHolder: required("Account holder name").pipe(text(120)),
  accountNumber: z
    .string()
    .trim()
    .min(1, "Account number is required")
    .regex(/^\d{9,18}$/, "Account numbers are 9 to 18 digits, with no spaces"),
  ifsc: z.string().superRefine((value, ctx) => {
    const message = ifscError(value);
    if (message) ctx.addIssue({ code: "custom", message });
  }),
  accountType: z.enum(["current", "savings"], { error: "Choose the account type" }),
  proof: requiredDocument("Upload a cancelled cheque or a recent bank statement"),
});

/**
 * The form adds a confirmation field, shown only when the account number
 * is new — retyping an unchanged number proves nothing.
 */
export function financialFormSchema(savedAccountNumber: string) {
  return financialSchema
    .extend({ confirmAccountNumber: z.string() })
    .superRefine((values, ctx) => {
      if (values.accountNumber.trim() === savedAccountNumber) return;
      if (!values.confirmAccountNumber.trim()) {
        ctx.addIssue({ code: "custom", path: ["confirmAccountNumber"], message: "Re-enter the account number" });
      } else if (values.confirmAccountNumber.trim() !== values.accountNumber.trim()) {
        ctx.addIssue({ code: "custom", path: ["confirmAccountNumber"], message: "The two account numbers don’t match" });
      }
    });
}

const CERT_VALUES = CERTIFICATE_TYPES.map((type) => type.value) as [string, ...string[]];

/** "YYYY-MM-DD" in India time — the day a certificate is judged against. */
export function todayInIndia(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
}

export const certificateSchema = z
  .object({
    id: z.string().min(1).max(64),
    type: z.enum(CERT_VALUES, { error: "Choose what kind of certificate this is" }),
    name: text(120),
    number: required("Certificate or registration number").pipe(text(60)),
    issuer: required("Issuing body").pipe(text(120)),
    validUntil: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the expiry date")
      .nullable(),
    document: requiredDocument("Upload the certificate"),
  })
  .superRefine((values, ctx) => {
    if (values.type === "other" && !values.name.trim()) {
      ctx.addIssue({ code: "custom", path: ["name"], message: "Name the certificate" });
    }
  });

export const certificationsSchema = z.object({
  certificates: z
    .array(certificateSchema)
    .min(1, "Add at least one — your state tourism registration is usually enough to start")
    .max(20)
    .superRefine((certificates, ctx) => {
      const today = todayInIndia();
      certificates.forEach((certificate, index) => {
        if (certificate.validUntil && certificate.validUntil < today) {
          ctx.addIssue({
            code: "custom",
            path: [index, "validUntil"],
            message: "Expired — upload the renewed certificate or remove it",
          });
        }
      });
    }),
});

const optionValues = (options: { value: string }[]) => options.map((option) => option.value) as [string, ...string[]];

export const MISSION_MIN = 40;
export const MISSION_MAX = 600;

export const operationsSchema = z.object({
  brandName: required("Company name").pipe(text(80)),
  mission: z
    .string()
    .trim()
    .min(1, "Tell travellers what you stand for")
    .min(MISSION_MIN, `A sentence or two, at least ${MISSION_MIN} characters`)
    .max(MISSION_MAX, `Keep it under ${MISSION_MAX} characters`),
  regions: z.array(z.enum(optionValues(REGION_OPTIONS))).min(1, "Select at least one state"),
  categories: z.array(z.enum(optionValues(CATEGORY_OPTIONS))).min(1, "Select at least one category"),
  activities: z.array(z.enum(optionValues(ACTIVITY_OPTIONS))).min(1, "Select at least one activity"),
  languages: z.array(z.enum(optionValues(LANGUAGE_OPTIONS))).min(1, "Select at least one language"),
  otherDocuments: z.array(documentSchema).max(5, "Attach up to five files"),
});

export const profileSchema = z.object({
  fullName: required("Your name").pipe(text(80)),
  phone: phoneSchema("Phone number"),
  designation: text(60),
  avatar: documentSchema.nullable(),
});

export const inviteSchema = z.object({
  email: emailSchema("Email address"),
  name: text(80),
  role: z.enum(ASSIGNABLE_ROLES.map((role) => role.value) as [string, ...string[]], {
    error: "Choose a role",
  }),
});

/**
 * What a draft may hold: anything the section's fields accept, with limits
 * on size so a draft can't be used to store arbitrary blobs. Shape only —
 * completeness is the submit schema's job.
 */
const draftDocuments = z.array(documentSchema).max(20);

export const draftSchemas = {
  basicInfo: z.object({
    logo: documentSchema.nullable(),
    legalName: text(120),
    businessType: z.union([z.enum(TYPE_VALUES), z.literal("")]),
    establishedYear: text(4),
    addressLine1: text(120),
    addressLine2: text(120),
    city: text(60),
    state: z.union([z.enum(STATE_VALUES), z.literal("")]),
    pincode: text(6),
    email: text(254),
    phone: text(20),
    website: text(200),
  }),
  compliance: z.object({
    pan: text(10),
    panDocument: documentSchema.nullable(),
    gstRegistered: z.enum(["yes", "no", ""]),
    gstin: text(15),
    gstDocument: documentSchema.nullable(),
    registrationNumber: text(21),
    registrationDocument: documentSchema.nullable(),
    termsAccepted: z.boolean(),
  }),
  financial: z.object({
    accountHolder: text(120),
    accountNumber: text(18),
    ifsc: text(11),
    accountType: z.enum(["current", "savings", ""]),
    proof: documentSchema.nullable(),
  }),
  certifications: z.object({
    certificates: z
      .array(
        z.object({
          id: z.string().min(1).max(64),
          type: z.enum(CERT_VALUES),
          name: text(120),
          number: text(60),
          issuer: text(120),
          validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
          document: documentSchema.nullable(),
        }),
      )
      .max(20),
  }),
  operations: z.object({
    brandName: text(80),
    mission: text(MISSION_MAX),
    regions: z.array(z.enum(optionValues(REGION_OPTIONS))),
    categories: z.array(z.enum(optionValues(CATEGORY_OPTIONS))),
    activities: z.array(z.enum(optionValues(ACTIVITY_OPTIONS))),
    languages: z.array(z.enum(optionValues(LANGUAGE_OPTIONS))),
    otherDocuments: draftDocuments,
  }),
} as const;

/** The submit schema for a section, given the business type it depends on. */
export function submitSchemaFor(key: keyof typeof draftSchemas, businessType: string) {
  switch (key) {
    case "basicInfo":
      return basicInfoSchema;
    case "compliance":
      return complianceSchema(businessType);
    case "financial":
      return financialSchema;
    case "certifications":
      return certificationsSchema;
    case "operations":
      return operationsSchema;
  }
}

import { z } from "zod";

import { ENQUIRY_STATUSES } from "@/lib/types";

/*
 * Validation shared by the forms (instant, inline errors) and the server
 * actions (the authority). One schema, so the two can never disagree about
 * what a valid enquiry or quote is.
 */

export const MESSAGE_MAX_LENGTH = 4000;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date");

const quoteAttachment = z.object({
  kind: z.literal("quote"),
  experienceId: z.string().nullable(),
  experienceTitle: z.string().trim().min(1).max(200),
  startDate: isoDate.nullable(),
  adults: z.number().int().min(1).max(99),
  children: z.number().int().min(0).max(99),
  infants: z.number().int().min(0).max(99),
  totalMinor: z.number().int().positive().max(10_000_000_000),
  currency: z.string().length(3),
  validUntil: isoDate.nullable(),
  note: z.string().trim().max(500).nullable(),
});

const fileAttachment = z.object({
  kind: z.literal("file"),
  url: z.string().min(1).max(2000),
  name: z.string().min(1).max(200),
  sizeBytes: z.number().int().nonnegative().nullable(),
  mimeType: z.string().max(120).nullable(),
});

const imageAttachment = z.object({
  kind: z.literal("image"),
  url: z.string().min(1).max(2000),
  name: z.string().min(1).max(200),
});

export const sendMessageSchema = z
  .object({
    id: z.uuid(),
    enquiryId: z.string().min(1).max(64),
    body: z.string().trim().max(MESSAGE_MAX_LENGTH).nullable(),
    isInternal: z.boolean(),
    attachments: z.array(z.union([quoteAttachment, fileAttachment, imageAttachment])).max(10),
  })
  .refine((value) => Boolean(value.body) || value.attachments.length > 0, {
    message: "A message needs text or an attachment",
  });

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const stageSchema = z.object({
  enquiryId: z.string().min(1).max(64),
  status: z.enum(ENQUIRY_STATUSES),
  lostReason: z.string().trim().max(200).nullable(),
  systemMessageId: z.uuid(),
});

export type StageInput = z.infer<typeof stageSchema>;

export const assignSchema = z.object({
  enquiryId: z.string().min(1).max(64),
  assigneeId: z.string().min(1).max(64).nullable(),
  systemMessageId: z.uuid(),
});

export const prioritySchema = z.object({
  enquiryId: z.string().min(1).max(64),
  priority: z.enum(["low", "normal", "high"]),
});

/**
 * The "Log enquiry" form. Whole rupees in the form; paise in the database.
 * A phone number or an email is required — the schema's
 * enquiries_has_contact check says the same thing one layer down.
 */
export const newEnquirySchema = z
  .object({
    contactName: z.string().trim().min(1, "Enter the traveller's name").max(120),
    contactPhone: z
      .string()
      .trim()
      .max(32)
      .refine((value) => !value || /^[+\d][\d\s-]{6,}$/.test(value), "Enter a valid phone number"),
    contactEmail: z
      .string()
      .trim()
      .max(160)
      .refine((value) => !value || z.email().safeParse(value).success, "Enter a valid email"),
    source: z.enum(["phone", "whatsapp", "manual", "referral"]),
    experienceId: z.string().max(64),
    preferredStart: z.union([isoDate, z.literal("")]),
    flexibleDates: z.boolean(),
    adults: z.number({ error: "Enter a number" }).int().min(1, "At least one adult").max(99),
    children: z.number({ error: "Enter a number" }).int().min(0).max(99),
    infants: z.number({ error: "Enter a number" }).int().min(0).max(99),
    budget: z.union([
      z.literal(""),
      z.string().regex(/^\d{1,9}$/, "Whole rupees, digits only"),
    ]),
    message: z.string().trim().max(MESSAGE_MAX_LENGTH),
  })
  .refine((value) => Boolean(value.contactPhone || value.contactEmail), {
    message: "Add a phone number or an email so you can reply",
    path: ["contactPhone"],
  });

export type NewEnquiryInput = z.infer<typeof newEnquirySchema>;

export const newEnquiryDefaults: NewEnquiryInput = {
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  source: "phone",
  experienceId: "",
  preferredStart: "",
  flexibleDates: false,
  adults: 2,
  children: 0,
  infants: 0,
  budget: "",
  message: "",
};

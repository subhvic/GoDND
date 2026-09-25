import type { EnquiryRow } from "@/lib/types";

/**
 * Saved replies. Most first replies to a travel enquiry are one of a handful
 * of sentences; typing them from scratch forty times a week is where response
 * time goes. A template drops into the composer as editable text — it is a
 * head start, never an auto-send — with the traveller's name and trip filled
 * in.
 *
 * Kept in code for now; per-agency saved replies belong in Settings once that
 * module exists.
 */
export type ReplyTemplate = { id: string; label: string; body: string };

export const REPLY_TEMPLATES: ReplyTemplate[] = [
  {
    id: "dates-open",
    label: "Dates are available",
    body: "Hi {first_name}, good news — {trip} is available on your dates. Shall I hold them for you for 48 hours while you decide?",
  },
  {
    id: "quote-coming",
    label: "Quote on its way",
    body: "Thanks {first_name}! I'm putting together a quote for your group of {group} and will send it within the hour.",
  },
  {
    id: "ask-details",
    label: "Ask for dates and group",
    body: "Hi {first_name}, happy to help! Which dates are you looking at, and how many of you are travelling (and any children)?",
  },
  {
    id: "follow-up",
    label: "Follow up on a quote",
    body: "Hi {first_name}, just checking in on the quote I sent for {trip}. Happy to adjust the dates or the plan if that would help.",
  },
  {
    id: "call-me",
    label: "Offer a call",
    body: "Hi {first_name}, it might be quicker to talk this through — what's a good time to call you?",
  },
];

export function fillTemplate(template: ReplyTemplate, row: EnquiryRow): string {
  const firstName = row.contactName.trim().split(/\s+/)[0] ?? "";
  const guests = row.adults + row.children + row.infants;
  return template.body
    .replaceAll("{first_name}", firstName)
    .replaceAll("{trip}", row.experienceTitle ?? "the trip")
    .replaceAll("{group}", String(guests));
}

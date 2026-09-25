import {
  CLOSED_ENQUIRY_STATUSES,
  type EnquiryMessage,
  type EnquiryPreview,
  type EnquiryRow,
  type EnquiryViewKey,
} from "@/lib/types";

/*
 * Inbox logic shared by the server (first render) and the browser (every
 * update after it). Pure functions over rows, so an optimistic send, a
 * realtime message and a server refresh all re-derive the same list.
 */

export function viewForEnquiry(row: Pick<EnquiryRow, "status" | "awaitingReplySince">): EnquiryViewKey {
  if (CLOSED_ENQUIRY_STATUSES.includes(row.status)) return "closed";
  return row.awaitingReplySince ? "needs_reply" : "replied";
}

/**
 * Needs reply: longest-waiting first — the traveller who has waited 26 hours
 * leads, not the one who wrote a minute ago (design rule 03). Everything else
 * by latest activity, like any inbox.
 */
export function sortForView(
  rows: EnquiryRow[],
  view: EnquiryViewKey,
  /** Frozen sort keys by id — keeps a row that just changed views in place. */
  keyOverrides?: Record<string, number>,
): EnquiryRow[] {
  const key = (row: EnquiryRow) => {
    const override = keyOverrides?.[row.id];
    if (override !== undefined) return override;
    return view === "needs_reply"
      ? Date.parse(row.awaitingReplySince ?? row.createdAt)
      : Date.parse(row.lastMessageAt ?? row.createdAt);
  };

  // Oldest wait first in Needs reply; newest activity first everywhere else.
  return [...rows].sort((a, b) =>
    view === "needs_reply" ? key(a) - key(b) : key(b) - key(a),
  );
}

export function matchesSearch(row: EnquiryRow, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const digits = needle.replace(/\D/g, "");
  return (
    row.contactName.toLowerCase().includes(needle) ||
    row.reference.toLowerCase().includes(needle) ||
    (row.contactEmail?.toLowerCase().includes(needle) ?? false) ||
    (digits.length >= 4 && (row.contactPhone?.replace(/\D/g, "").includes(digits) ?? false)) ||
    (row.experienceTitle?.toLowerCase().includes(needle) ?? false) ||
    (row.lastMessage?.body?.toLowerCase().includes(needle) ?? false) ||
    (row.message?.toLowerCase().includes(needle) ?? false)
  );
}

export function countByView(rows: EnquiryRow[]): Record<EnquiryViewKey, number> {
  const counts: Record<EnquiryViewKey, number> = { needs_reply: 0, replied: 0, closed: 0 };
  for (const row of rows) counts[viewForEnquiry(row)] += 1;
  return counts;
}

/**
 * Derive the list-facing summary of a thread from its messages. Internal
 * notes and system events never count: a note is not a reply, and "stage
 * changed" is not the traveller speaking.
 */
export function summariseThread(
  createdAt: string,
  messages: EnquiryMessage[],
): { lastMessage: EnquiryPreview | null; awaitingReplySince: string | null } {
  const spoken = messages.filter(
    (message) => !message.isInternal && message.senderKind !== "system",
  );

  let lastAgent = -1;
  for (let i = spoken.length - 1; i >= 0; i -= 1) {
    if (spoken[i].senderKind === "agent") {
      lastAgent = i;
      break;
    }
  }

  const awaitingReplySince =
    lastAgent === -1
      ? createdAt
      : (spoken.slice(lastAgent + 1).find((message) => message.senderKind === "traveller")
          ?.createdAt ?? null);

  const last = spoken.at(-1);
  return {
    awaitingReplySince,
    lastMessage: last ? toPreview(last) : null,
  };
}

export function toPreview(message: EnquiryMessage): EnquiryPreview {
  return {
    body: message.body,
    senderKind: message.senderKind === "agent" ? "agent" : "traveller",
    senderId: message.senderId,
    senderName: message.senderName,
    createdAt: message.createdAt,
    attachmentKind: message.attachments[0]?.kind ?? null,
  };
}

/**
 * The one-line preview under a row's name. Your own replies read "You:",
 * a teammate's carry their first name, so a shared inbox shows who answered.
 */
export function previewText(row: EnquiryRow, youId: string | null): string {
  const preview = row.lastMessage;
  if (!preview) return row.message?.trim() || "No message — logged by your team";

  const body = preview.body?.trim().replace(/\s+/g, " ");
  const attachment =
    preview.attachmentKind === "quote"
      ? "Quote sent"
      : preview.attachmentKind === "image"
        ? "Photo"
        : preview.attachmentKind === "file"
          ? "Attachment"
          : null;

  const text = body || attachment || "";
  if (preview.senderKind !== "agent") return text;
  const who =
    preview.senderId && preview.senderId === youId
      ? "You"
      : (preview.senderName?.split(" ")[0] ?? "You");
  return `${who}: ${text}`;
}

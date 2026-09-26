"use server";

import { DEMO_TEAM, getEnquiry, isEnquiryDemo } from "@/lib/data/enquiries";
import { summariseThread } from "@/lib/enquiries/views";
import {
  assignSchema,
  newEnquirySchema,
  prioritySchema,
  sendMessageSchema,
  stageSchema,
  type NewEnquiryInput,
  type SendMessageInput,
  type StageInput,
} from "@/lib/enquiries/schema";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  ENQUIRY_STATUS_LABELS,
  type EnquiryAttachment,
  type EnquiryDetail,
  type EnquiryMessage,
  type EnquiryPriority,
  type EnquiryStatus,
} from "@/lib/types";

/*
 * Mutations for the enquiry inbox.
 *
 * The browser generates every message id (a v4 uuid) and the insert uses it.
 * That one decision keeps the optimistic UI honest: the message drawn the
 * instant Send is pressed, the row the server confirms, and the copy that
 * arrives over Realtime all share an id, so the thread never shows a
 * message twice and a retry can never create a duplicate.
 *
 * With Supabase unconfigured, each action validates its input exactly as it
 * would live and echoes a result without persisting — the inbox keeps the
 * change in the tab, and the UI says so.
 */

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

async function session() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

type MessageRow = {
  id: string;
  sender_kind: EnquiryMessage["senderKind"];
  sender_id: string | null;
  body: string | null;
  attachments: EnquiryAttachment[] | null;
  is_internal: boolean;
  read_at: string | null;
  created_at: string;
};

function toMessage(row: MessageRow, senderName: string | null): EnquiryMessage {
  return {
    id: row.id,
    senderKind: row.sender_kind,
    senderId: row.sender_id,
    senderName,
    body: row.body,
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    isInternal: row.is_internal,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

async function displayName(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();
  return (data?.full_name as string | null) ?? (data?.email as string | null) ?? "You";
}

/* ------------------------------------------------------------------------ */

export async function sendEnquiryMessage(
  input: SendMessageInput,
): Promise<ActionResult<EnquiryMessage>> {
  const parsed = sendMessageSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "That message can't be sent");
  const value = parsed.data;

  if (isEnquiryDemo()) {
    const you = DEMO_TEAM[0];
    return {
      ok: true,
      data: {
        id: value.id,
        senderKind: "agent",
        senderId: you.id,
        senderName: you.name,
        body: value.body || null,
        attachments: value.attachments,
        isInternal: value.isInternal,
        readAt: null,
        createdAt: new Date().toISOString(),
      },
    };
  }

  const { supabase, user } = await session();
  if (!user) return fail("Your session has ended. Sign in again to reply.");

  const { data, error } = await supabase
    .from("enquiry_messages")
    .insert({
      id: value.id,
      enquiry_id: value.enquiryId,
      sender_kind: "agent",
      sender_id: user.id,
      body: value.body || null,
      attachments: value.attachments,
      is_internal: value.isInternal,
    })
    .select("id, sender_kind, sender_id, body, attachments, is_internal, read_at, created_at")
    .single();

  if (error) {
    // A retry after a timeout that actually landed: the row is already there.
    if (error.code === "23505") {
      const { data: existing } = await supabase
        .from("enquiry_messages")
        .select("id, sender_kind, sender_id, body, attachments, is_internal, read_at, created_at")
        .eq("id", value.id)
        .maybeSingle();
      if (existing) {
        return { ok: true, data: toMessage(existing as MessageRow, await displayName(supabase, user.id)) };
      }
    }
    return fail(`Not sent: ${error.message}`);
  }

  return { ok: true, data: toMessage(data as MessageRow, await displayName(supabase, user.id)) };
}

/* ------------------------------------------------------------------------ */

function stageEventText(status: EnquiryStatus, lostReason: string | null): string {
  if (status === "lost") return lostReason ? `Marked as lost — ${lostReason}` : "Marked as lost";
  if (status === "spam") return "Marked as spam";
  if (status === "won") return "Marked as won";
  return `Stage changed to ${ENQUIRY_STATUS_LABELS[status]}`;
}

export async function updateEnquiryStage(
  input: StageInput,
): Promise<ActionResult<{ status: EnquiryStatus; lostReason: string | null; event: EnquiryMessage }>> {
  const parsed = stageSchema.safeParse(input);
  if (!parsed.success) return fail("That stage change isn't valid");
  const { enquiryId, status, systemMessageId } = parsed.data;
  const lostReason = status === "lost" ? parsed.data.lostReason || null : null;
  const body = stageEventText(status, lostReason);

  if (isEnquiryDemo()) {
    const you = DEMO_TEAM[0];
    return {
      ok: true,
      data: {
        status,
        lostReason,
        event: {
          id: systemMessageId,
          senderKind: "system",
          senderId: you.id,
          senderName: you.name,
          body,
          attachments: [],
          isInternal: true,
          readAt: null,
          createdAt: new Date().toISOString(),
        },
      },
    };
  }

  const { supabase, user } = await session();
  if (!user) return fail("Your session has ended. Sign in again.");

  const { error: updateError } = await supabase
    .from("enquiries")
    .update({ status, lost_reason: lostReason })
    .eq("id", enquiryId);
  if (updateError) return fail(`Couldn't change the stage: ${updateError.message}`);

  // The audit line is internal: the traveller's side has no business
  // reading "Marked as lost — price too high".
  const { data, error } = await supabase
    .from("enquiry_messages")
    .insert({
      id: systemMessageId,
      enquiry_id: enquiryId,
      sender_kind: "system",
      sender_id: user.id,
      body,
      is_internal: true,
    })
    .select("id, sender_kind, sender_id, body, attachments, is_internal, read_at, created_at")
    .single();
  if (error) return fail(`Stage changed, but the history line failed: ${error.message}`);

  return {
    ok: true,
    data: { status, lostReason, event: toMessage(data as MessageRow, await displayName(supabase, user.id)) },
  };
}

/* ------------------------------------------------------------------------ */

export async function assignEnquiry(input: {
  enquiryId: string;
  assigneeId: string | null;
  systemMessageId: string;
}): Promise<ActionResult<{ event: EnquiryMessage }>> {
  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) return fail("That assignment isn't valid");
  const { enquiryId, assigneeId, systemMessageId } = parsed.data;

  if (isEnquiryDemo()) {
    const you = DEMO_TEAM[0];
    const member = DEMO_TEAM.find((entry) => entry.id === assigneeId);
    if (assigneeId && !member) return fail("That teammate isn't on this workspace");
    return {
      ok: true,
      data: {
        event: {
          id: systemMessageId,
          senderKind: "system",
          senderId: you.id,
          senderName: you.name,
          body: member ? `Assigned to ${member.name}` : "Unassigned",
          attachments: [],
          isInternal: true,
          readAt: null,
          createdAt: new Date().toISOString(),
        },
      },
    };
  }

  const { supabase, user } = await session();
  if (!user) return fail("Your session has ended. Sign in again.");

  const { error: updateError } = await supabase
    .from("enquiries")
    .update({ assigned_to: assigneeId })
    .eq("id", enquiryId);
  if (updateError) return fail(`Couldn't assign: ${updateError.message}`);

  const assigneeName = assigneeId ? await displayName(supabase, assigneeId) : null;
  const { data, error } = await supabase
    .from("enquiry_messages")
    .insert({
      id: systemMessageId,
      enquiry_id: enquiryId,
      sender_kind: "system",
      sender_id: user.id,
      body: assigneeName ? `Assigned to ${assigneeName}` : "Unassigned",
      is_internal: true,
    })
    .select("id, sender_kind, sender_id, body, attachments, is_internal, read_at, created_at")
    .single();
  if (error) return fail(`Assigned, but the history line failed: ${error.message}`);

  return { ok: true, data: { event: toMessage(data as MessageRow, await displayName(supabase, user.id)) } };
}

export async function setEnquiryPriority(input: {
  enquiryId: string;
  priority: EnquiryPriority;
}): Promise<ActionResult<null>> {
  const parsed = prioritySchema.safeParse(input);
  if (!parsed.success) return fail("That priority isn't valid");
  if (isEnquiryDemo()) return { ok: true, data: null };

  const { supabase } = await session();
  const { error } = await supabase
    .from("enquiries")
    .update({ priority: parsed.data.priority })
    .eq("id", parsed.data.enquiryId);
  return error ? fail(`Couldn't change priority: ${error.message}`) : { ok: true, data: null };
}

/* ------------------------------------------------------------------------ */

/**
 * Called by the thread once it is on screen — never during render, because
 * a prefetch of the thread route would otherwise mark it read before anyone
 * looked at it.
 */
export async function markEnquiryRead(enquiryId: string): Promise<ActionResult<null>> {
  if (typeof enquiryId !== "string" || !enquiryId) return fail("Unknown enquiry");
  if (isEnquiryDemo()) return { ok: true, data: null };

  const { supabase } = await session();
  const { error } = await supabase.rpc("mark_enquiry_read", { p_enquiry: enquiryId });
  return error ? fail(error.message) : { ok: true, data: null };
}

export async function markEnquiryUnread(enquiryId: string): Promise<ActionResult<null>> {
  if (typeof enquiryId !== "string" || !enquiryId) return fail("Unknown enquiry");
  if (isEnquiryDemo()) return { ok: true, data: null };

  const { supabase } = await session();
  const { error } = await supabase
    .from("enquiries")
    .update({ unread_for_agent: 1 })
    .eq("id", enquiryId)
    .eq("unread_for_agent", 0);
  return error ? fail(error.message) : { ok: true, data: null };
}

/** Full thread for a conversation that arrived over Realtime. */
export async function fetchEnquiry(enquiryId: string): Promise<EnquiryDetail | null> {
  if (typeof enquiryId !== "string" || !enquiryId) return null;
  return getEnquiry(enquiryId);
}

/* ------------------------------------------------------------------------ */

/**
 * Log an enquiry that came in by phone, WhatsApp or in person, so it lives in
 * the same inbox as the ones that arrived online.
 */
export async function createEnquiry(
  input: NewEnquiryInput,
): Promise<ActionResult<EnquiryDetail>> {
  const parsed = newEnquirySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the form and try again");
  const value = parsed.data;

  const budgetMinor = value.budget ? Number(value.budget) * 100 : null;

  if (isEnquiryDemo()) {
    const now = new Date().toISOString();
    const base = {
      id: `enq-new-${crypto.randomUUID().slice(0, 8)}`,
      // The tab numbers new sample enquiries after the ones it already holds.
      reference: "",
      status: "new" as const,
      priority: "normal" as const,
      source: value.source,
      contactName: value.contactName,
      contactEmail: value.contactEmail || null,
      contactPhone: value.contactPhone || null,
      hasAccount: false,
      experienceId: value.experienceId || null,
      experienceTitle: null,
      adults: value.adults,
      children: value.children,
      infants: value.infants,
      preferredStart: value.preferredStart || null,
      flexibleDates: value.flexibleDates,
      budgetMinor,
      currency: "INR",
      message: value.message || null,
      assignee: DEMO_TEAM[0],
      createdAt: now,
      lastMessageAt: now,
      unreadCount: 0,
    };
    return {
      ok: true,
      data: {
        ...base,
        ...summariseThread(now, []),
        lostReason: null,
        messages: [],
        booking: null,
      },
    };
  }

  const { supabase, user } = await session();
  if (!user) return fail("Your session has ended. Sign in again.");

  const { data: agencyId, error: agencyError } = await supabase.rpc("current_agency_id");
  if (agencyError || !agencyId) return fail("You're not a member of an agency yet.");

  const { data, error } = await supabase
    .from("enquiries")
    .insert({
      agency_id: agencyId,
      source: value.source,
      contact_name: value.contactName,
      contact_email: value.contactEmail || null,
      contact_phone: value.contactPhone || null,
      experience_id: value.experienceId || null,
      preferred_start: value.preferredStart || null,
      flexible_dates: value.flexibleDates,
      adults: value.adults,
      children: value.children,
      infants: value.infants,
      budget_minor: budgetMinor,
      message: value.message || null,
      assigned_to: user.id,
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) return fail(`Couldn't log the enquiry: ${error.message}`);

  const detail = await getEnquiry(data.id as string);
  return detail ? { ok: true, data: detail } : fail("Logged, but it couldn't be loaded. Refresh the inbox.");
}

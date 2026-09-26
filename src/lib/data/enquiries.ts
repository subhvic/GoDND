import "server-only";

import { connection } from "next/server";

import { listExperienceOptions, type ExperienceOption } from "@/lib/data/experiences";
import { dayKey } from "@/lib/enquiries/format";
import { summariseThread } from "@/lib/enquiries/views";
import { createServerSupabase } from "@/lib/supabase/server";
import type {
  EnquiryAttachment,
  EnquiryDetail,
  EnquiryMessage,
  EnquiryPriority,
  EnquiryRow,
  EnquirySenderKind,
  EnquirySource,
  EnquiryStatus,
  TeamMember,
} from "@/lib/types";

/*
 * Data access for the Enquiries module. Same contract as the other data
 * files: reads run under the caller's Supabase session so RLS scopes them to
 * the tenant, and the fixture below is used only when Supabase is not
 * configured — never as a fallback for a failed query.
 *
 * Unlike Bookings, the inbox is loaded whole rather than a page at a time.
 * It is a live working set (open conversations and recent closes), the
 * client filters and re-sorts it on every message, and a paginated inbox
 * would hide the one thread that just moved.
 */

export const isEnquiryDemo = () =>
  !(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/** How far back the inbox reaches for closed conversations. */
const CLOSED_WINDOW_DAYS = 90;
/** Recent public messages fetched per row — enough to find the last reply. */
const PREVIEW_DEPTH = 20;

export type InboxData = {
  rows: EnquiryRow[];
  team: TeamMember[];
  you: TeamMember | null;
  experiences: ExperienceOption[];
  isDemoData: boolean;
  /** The server's clock at render time; the client starts from it to hydrate cleanly. */
  now: string;
};

export async function loadInbox(): Promise<InboxData> {
  // The inbox is per-request by nature — waiting times are measured from
  // now. Without this the sample inbox (which reads no cookies) would be
  // prerendered at build time and its clock frozen there.
  await connection();
  const now = new Date();
  const experiences = await listExperienceOptions();

  if (isEnquiryDemo()) {
    const demo = buildDemo(now);
    return {
      rows: demo.map(({ row }) => row),
      team: DEMO_TEAM,
      you: DEMO_TEAM[0],
      experiences,
      isDemoData: true,
      now: now.toISOString(),
    };
  }

  const supabase = await createServerSupabase();
  const [{ data: auth }, team] = await Promise.all([
    supabase.auth.getUser(),
    loadTeam(),
  ]);
  const youId = auth.user?.id ?? null;

  const since = new Date(now.getTime() - CLOSED_WINDOW_DAYS * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("enquiries")
    .select(
      `${ENQUIRY_COLUMNS},
       recent:enquiry_messages ( id, sender_kind, sender_id, body, attachments, is_internal, read_at, created_at )`,
    )
    .eq("recent.is_internal", false)
    .neq("recent.sender_kind", "system")
    .order("created_at", { referencedTable: "recent", ascending: false })
    .limit(PREVIEW_DEPTH, { referencedTable: "recent" })
    .or(`status.in.(new,open,quoted,negotiating),updated_at.gte."${since}"`)
    .order("last_message_at", { ascending: false, nullsFirst: false });

  if (error) throw new Error(`Failed to load enquiries: ${error.message}`);

  const rows = (data ?? []).map((record) => {
    const typed = record as unknown as EnquiryRecord & { recent: MessageRecord[] | null };
    const messages = (typed.recent ?? [])
      .map((message) => toMessage(message, typed, team))
      .reverse();
    return toRow(typed, messages, team);
  });

  return {
    rows,
    team,
    you: team.find((member) => member.id === youId) ?? null,
    experiences,
    isDemoData: false,
    now: now.toISOString(),
  };
}

export async function getEnquiry(id: string): Promise<EnquiryDetail | null> {
  await connection();
  if (isEnquiryDemo()) {
    const match = buildDemo(new Date()).find(({ row }) => row.id === id);
    return match ? match.detail : null;
  }

  // Ids are uuids in the database; anything else is a mistyped URL, not an error.
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;

  const supabase = await createServerSupabase();
  const team = await loadTeam();
  const { data, error } = await supabase
    .from("enquiries")
    .select(
      `${ENQUIRY_COLUMNS}, lost_reason,
       messages:enquiry_messages ( id, sender_kind, sender_id, body, attachments, is_internal, read_at, created_at ),
       booking:bookings ( id, reference )`,
    )
    .eq("id", id)
    .order("created_at", { referencedTable: "messages", ascending: true })
    .maybeSingle();

  if (error) throw new Error(`Failed to load enquiry: ${error.message}`);
  if (!data) return null;

  const record = data as unknown as EnquiryRecord & {
    lost_reason: string | null;
    messages: MessageRecord[] | null;
    booking: { id: string; reference: string }[] | null;
  };
  const messages = (record.messages ?? []).map((message) => toMessage(message, record, team));

  return {
    ...toRow(record, messages, team),
    lostReason: record.lost_reason,
    messages,
    booking: record.booking?.[0] ?? null,
  };
}

/** Active members of the caller's agency, for assignment and sender names. */
async function loadTeam(): Promise<TeamMember[]> {
  const supabase = await createServerSupabase();
  const [{ data: auth }, { data, error }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("agency_members")
      .select("user_id, role, profile:profiles!agency_members_user_id_fkey ( full_name, email )")
      .eq("status", "active")
      .not("user_id", "is", null),
  ]);
  if (error) return [];

  const youId = auth.user?.id ?? null;
  return (data ?? []).map((member) => {
    const profile = member.profile as unknown as { full_name: string | null; email: string } | null;
    return {
      id: member.user_id as string,
      name: profile?.full_name ?? profile?.email ?? "Team member",
      role: titleCase(member.role as string),
      isYou: member.user_id === youId,
    };
  });
}

/* ------------------------------------------------------------------------ */
/* Row mapping                                                              */
/* ------------------------------------------------------------------------ */

const ENQUIRY_COLUMNS = `id, reference, source, status, priority, traveller_id,
  contact_name, contact_email, contact_phone, adults, children, infants,
  preferred_start, flexible_dates, budget_minor, currency, message,
  assigned_to, created_at, last_message_at, unread_for_agent, experience_id,
  experience:experiences ( title )`;

type EnquiryRecord = {
  id: string;
  reference: string;
  source: EnquirySource;
  status: EnquiryStatus;
  priority: EnquiryPriority;
  traveller_id: string | null;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  adults: number;
  children: number;
  infants: number;
  preferred_start: string | null;
  flexible_dates: boolean;
  budget_minor: number | null;
  currency: string;
  message: string | null;
  assigned_to: string | null;
  created_at: string;
  last_message_at: string | null;
  unread_for_agent: number;
  experience_id: string | null;
  experience: { title: string } | null;
};

type MessageRecord = {
  id: string;
  sender_kind: EnquirySenderKind;
  sender_id: string | null;
  body: string | null;
  attachments: EnquiryAttachment[] | null;
  is_internal: boolean;
  read_at: string | null;
  created_at: string;
};

function toMessage(
  message: MessageRecord,
  enquiry: EnquiryRecord,
  team: TeamMember[],
): EnquiryMessage {
  const senderName =
    message.sender_kind === "traveller"
      ? enquiry.contact_name
      : message.sender_kind === "agent"
        ? (team.find((member) => member.id === message.sender_id)?.name ?? "Your team")
        : null;

  return {
    id: message.id,
    senderKind: message.sender_kind,
    senderId: message.sender_id,
    senderName,
    body: message.body,
    attachments: Array.isArray(message.attachments) ? message.attachments : [],
    isInternal: message.is_internal,
    readAt: message.read_at,
    createdAt: message.created_at,
  };
}

function toRow(
  record: EnquiryRecord,
  messages: EnquiryMessage[],
  team: TeamMember[],
): EnquiryRow {
  const summary = summariseThread(record.created_at, messages);
  return {
    id: record.id,
    reference: record.reference,
    status: record.status,
    priority: record.priority,
    source: record.source,
    contactName: record.contact_name,
    contactEmail: record.contact_email,
    contactPhone: record.contact_phone,
    hasAccount: Boolean(record.traveller_id),
    experienceId: record.experience_id,
    experienceTitle: record.experience?.title ?? null,
    adults: record.adults,
    children: record.children,
    infants: record.infants,
    preferredStart: record.preferred_start,
    flexibleDates: record.flexible_dates,
    budgetMinor: record.budget_minor,
    currency: record.currency || "INR",
    message: record.message,
    assignee: team.find((member) => member.id === record.assigned_to) ?? null,
    createdAt: record.created_at,
    lastMessageAt: record.last_message_at,
    unreadCount: record.unread_for_agent,
    lastMessage: summary.lastMessage,
    awaitingReplySince: summary.awaitingReplySince,
  };
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/* ------------------------------------------------------------------------ */
/* Demo fixture                                                             */
/* ------------------------------------------------------------------------ */

/*
 * Timestamps are relative to the request, so the sample inbox always reads
 * as a live morning — a lead waiting 26 hours, one from ten minutes ago —
 * rather than a snapshot that ages into "6 months ago" everywhere. Closed
 * conversations that tie to the Bookings fixture keep that fixture's dates.
 *
 * Each conversation exercises one real situation the UI has to get right:
 * an overdue honeymoon lead, a phone-only walk-in who cannot be reached by
 * chat, a quote being negotiated with an internal note, a teammate's thread.
 */

export const DEMO_TEAM: TeamMember[] = [
  { id: "u-dipendu", name: "Dipendu", role: "Admin", isYou: true },
  { id: "u-riya", name: "Riya Das", role: "Sales" },
  { id: "u-arjun", name: "Arjun Gogoi", role: "Ops" },
];

const [YOU, RIYA, ARJUN] = DEMO_TEAM;

type DemoEntry = { row: EnquiryRow; detail: EnquiryDetail };

type DemoSeed = Omit<
  EnquiryRow,
  "lastMessage" | "awaitingReplySince" | "lastMessageAt"
> & {
  lostReason?: string | null;
  booking?: { id: string; reference: string } | null;
  messages: EnquiryMessage[];
};

function buildDemo(now: Date): DemoEntry[] {
  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
  const H = 60;
  const D = 24 * H;
  const inDays = (days: number) => dayKey(new Date(now.getTime() + days * D * 60_000));

  let seq = 0;
  const say = (
    who: TeamMember | "traveller" | "system",
    minutesAgo: number,
    body: string | null,
    extra: Partial<EnquiryMessage> = {},
  ): EnquiryMessage => {
    seq += 1;
    const isTeam = typeof who === "object";
    return {
      id: `msg-${String(seq).padStart(3, "0")}`,
      senderKind: who === "traveller" ? "traveller" : who === "system" ? "system" : "agent",
      senderId: isTeam ? who.id : null,
      senderName: isTeam ? who.name : null,
      body,
      attachments: [],
      // History lines are team-only, as the stage actions write them.
      isInternal: who === "system",
      readAt: null,
      createdAt: ago(minutesAgo),
      ...extra,
    };
  };

  const seeds: DemoSeed[] = [
    {
      id: "enq-148",
      reference: "ENQ-000148",
      status: "new",
      priority: "high",
      source: "marketplace",
      contactName: "Ananya Kapoor",
      contactEmail: "ananya.kapoor@example.com",
      contactPhone: "+91 98200 41177",
      hasAccount: true,
      experienceId: "demo-1",
      experienceTitle: "7 Day Immersive Experience in Meghalaya",
      adults: 2,
      children: 0,
      infants: 0,
      preferredStart: inDays(23),
      flexibleDates: true,
      budgetMinor: 14000000,
      currency: "INR",
      message:
        "Hi! We're planning our honeymoon in Meghalaya in late October. Is the 7-day trip available from the 18th? And could the stays be upgraded to something more private — a cottage rather than a homestay room?",
      assignee: null,
      createdAt: ago(26 * H + 10),
      unreadCount: 2,
      messages: [
        say("traveller", 3 * H, "Just following up — we need to book flights by this weekend, so a quick yes or no on the dates would really help 🙏", { senderName: "Ananya Kapoor" }),
      ],
    },
    {
      id: "enq-147",
      reference: "ENQ-000147",
      status: "new",
      priority: "normal",
      source: "website",
      contactName: "Rohan Mehta",
      contactEmail: "rohan.mehta@example.com",
      contactPhone: null,
      hasAccount: false,
      experienceId: "demo-2",
      experienceTitle: "Cycling & Camping Expedition in Arunachal",
      adults: 4,
      children: 0,
      infants: 0,
      preferredStart: inDays(48),
      flexibleDates: false,
      budgetMinor: null,
      currency: "INR",
      message:
        "Hey — four of us, all decent cyclists. Is the Arunachal ride doable in mid-November? Do you provide bikes, or should we bring our own?",
      assignee: RIYA,
      createdAt: ago(3 * H + 5),
      unreadCount: 1,
      messages: [],
    },
    {
      id: "enq-146",
      reference: "ENQ-000146",
      status: "open",
      priority: "normal",
      source: "whatsapp",
      contactName: "Farah Sheikh",
      contactEmail: "farah.sheikh@example.com",
      contactPhone: "+91 99300 18842",
      hasAccount: false,
      experienceId: "demo-4",
      experienceTitle: "Raw Experience in Meghalaya",
      adults: 2,
      children: 1,
      infants: 0,
      preferredStart: inDays(16),
      flexibleDates: true,
      budgetMinor: 6000000,
      currency: "INR",
      message:
        "Salaam! Looking at the Raw Experience for my husband, me and our son over the Diwali week. What's included, and is it okay with a kid?",
      assignee: YOU,
      createdAt: ago(2 * D + 3 * H),
      unreadCount: 2,
      messages: [
        say(YOU, 2 * D + 2 * H, "Hi Farah, thanks for reaching out! Stays, all meals, the guide and every transfer from Shillong are included — you'd only pay for flights to Guwahati and anything personal. Kids are very welcome; we pace the walks to the slowest walker in the group.", { readAt: ago(2 * D + H) }),
        say("traveller", 2 * D + H, "That sounds perfect, thank you!", { senderName: "Farah Sheikh", readAt: ago(2 * D + 50) }),
        say(YOU, 2 * D + 40, "Shall I pencil you in for the 12th? I can hold the dates for 48 hours while you decide.", { readAt: ago(D) }),
        say("traveller", 36, "Sorry for the slow reply! One more thing — our son is 6. Is the walk down to the double-decker root bridge okay for him? I read it's around 3,000 steps.", { senderName: "Farah Sheikh" }),
        say("traveller", 35, "This is the one we saw on Instagram 😍", {
          senderName: "Farah Sheikh",
          attachments: [{ kind: "image", url: "/demo/enquiries/root-bridge.svg", name: "root-bridge.jpg" }],
        }),
      ],
    },
    {
      id: "enq-145",
      reference: "ENQ-000145",
      status: "quoted",
      priority: "normal",
      source: "marketplace",
      contactName: "Vikram Rao",
      contactEmail: "vikram.rao@example.com",
      contactPhone: "+91 98450 77120",
      hasAccount: true,
      experienceId: "demo-3",
      experienceTitle: "Rafting, Camping & Cycling in Upper Assam",
      adults: 6,
      children: 0,
      infants: 0,
      preferredStart: inDays(34),
      flexibleDates: false,
      budgetMinor: 60000000,
      currency: "INR",
      message:
        "Office offsite for six of us. We'd like the full Upper Assam trip in early November. Can you send a quote with transfers from Dibrugarh airport included?",
      assignee: RIYA,
      createdAt: ago(4 * D + 2 * H),
      unreadCount: 0,
      messages: [
        say(RIYA, 4 * D + H, "Hi Vikram — happy to put this together. Early November is a great window; the river has settled after the monsoon. Let me confirm the camp for your dates and I'll send a full quote today.", { readAt: ago(4 * D) }),
        say(RIYA, 3 * D + 20 * H, "Here's the quote for your group. Airport transfers from Dibrugarh are included both ways.", {
          readAt: ago(3 * D + 10 * H),
          attachments: [
            {
              kind: "quote",
              experienceId: "demo-3",
              experienceTitle: "Rafting, Camping & Cycling in Upper Assam",
              startDate: inDays(34),
              adults: 6,
              children: 0,
              infants: 0,
              totalMinor: 58800000,
              currency: "INR",
              validUntil: inDays(3),
              note: "Includes Dibrugarh airport transfers both ways, all meals and river gear.",
            },
          ],
        }),
        say("traveller", 5 * H + 20, "Thanks Riya. Is there any flexibility on price if we pay the full amount upfront? Also — could we swap the cycling day for a second rafting session? Half the group isn't keen on cycling.", { senderName: "Vikram Rao", readAt: ago(4 * H + 10) }),
        say(RIYA, 4 * H, "Can offer 5% off for full payment upfront. Checked with Arjun — the day-3 rafting slot is free, so the swap is fine. Dipendu, can you reply? I'm on site visits till evening.", { isInternal: true }),
      ],
    },
    {
      id: "enq-144",
      reference: "ENQ-000144",
      status: "quoted",
      priority: "normal",
      source: "website",
      contactName: "Sneha Pillai",
      contactEmail: "sneha.pillai@example.com",
      contactPhone: "+91 90040 11235",
      hasAccount: false,
      experienceId: "demo-1",
      experienceTitle: "7 Day Immersive Experience in Meghalaya",
      adults: 2,
      children: 0,
      infants: 0,
      preferredStart: inDays(55),
      flexibleDates: true,
      budgetMinor: 14000000,
      currency: "INR",
      message: "Is the Meghalaya trip good for first-timers in the northeast? Thinking of mid-November.",
      assignee: YOU,
      createdAt: ago(2 * D + 6 * H),
      unreadCount: 0,
      messages: [
        say(YOU, 2 * D + 5 * H, "Absolutely — it's our most popular first trip to the northeast. Mid-November is dry and clear, which is perfect for the Dawki river and the living root bridges.", { readAt: ago(2 * D + 3 * H) }),
        say(YOU, D + 22 * H, "Here's a quote for your dates. I can hold them until Friday.", {
          readAt: ago(D + 2 * H),
          attachments: [
            {
              kind: "quote",
              experienceId: "demo-1",
              experienceTitle: "7 Day Immersive Experience in Meghalaya",
              startDate: inDays(55),
              adults: 2,
              children: 0,
              infants: 0,
              totalMinor: 13400000,
              currency: "INR",
              validUntil: inDays(2),
              note: null,
            },
          ],
        }),
        say("traveller", 21 * H, "Looks great! Will confirm with my husband tonight.", { senderName: "Sneha Pillai", readAt: ago(20 * H + 30) }),
        say(YOU, 20 * H, "Perfect, no rush — the dates are held until Friday 🙂", { readAt: ago(18 * H) }),
      ],
    },
    {
      id: "enq-143",
      reference: "ENQ-000143",
      status: "negotiating",
      priority: "normal",
      source: "phone",
      contactName: "Nikhil Bora",
      contactEmail: "nikhil.bora@example.com",
      contactPhone: "+91 94350 66210",
      hasAccount: false,
      experienceId: "demo-2",
      experienceTitle: "Cycling & Camping Expedition in Arunachal",
      adults: 3,
      children: 0,
      infants: 0,
      preferredStart: inDays(20),
      flexibleDates: true,
      budgetMinor: 5000000,
      currency: "INR",
      message: null,
      assignee: ARJUN,
      createdAt: ago(5 * D),
      unreadCount: 0,
      messages: [
        say(ARJUN, 5 * D - 2, "Called in from Jorhat. Wants a shorter version of the Arunachal ride — 3 days instead of 4. Budget around ₹50k for three.", { isInternal: true }),
        say(ARJUN, 4 * D + 22 * H, "Hi Nikhil, Arjun from Wander Beyond — thanks for the call earlier. I've sketched a 3-day version of the ride that skips the Mechuka leg. Would the 14th to 16th of next month work for your group?", { readAt: ago(4 * D + 20 * H) }),
        say("traveller", 3 * D, "14–16 works. Can we do ₹15,000 per person?", { senderName: "Nikhil Bora", readAt: ago(2 * D + 6 * H) }),
        say(ARJUN, 2 * D + 4 * H, "We can do ₹16,500 per person with the same stays — permits and the support vehicle don't scale down with the shorter route. Say the word and I'll send the quote.", { readAt: null }),
      ],
    },
    {
      id: "enq-149",
      reference: "ENQ-000149",
      status: "new",
      priority: "normal",
      source: "phone",
      contactName: "Tenzin Dorjee",
      contactEmail: null,
      contactPhone: "+91 94361 20457",
      hasAccount: false,
      experienceId: null,
      experienceTitle: null,
      adults: 2,
      children: 2,
      infants: 0,
      preferredStart: inDays(78),
      flexibleDates: true,
      budgetMinor: null,
      currency: "INR",
      message: null,
      assignee: YOU,
      createdAt: ago(52),
      unreadCount: 0,
      messages: [
        say(YOU, 50, "Called from Tawang. Family of four with two kids (8 and 11), wants a slow trip in December — nothing with long drives. Asked us to WhatsApp two or three options.", { isInternal: true }),
      ],
    },
    {
      id: "enq-142",
      reference: "ENQ-000142",
      status: "won",
      priority: "normal",
      source: "marketplace",
      contactName: "Priya Sengupta",
      contactEmail: "priya.sengupta@example.com",
      contactPhone: "+91 98301 55621",
      hasAccount: true,
      experienceId: "demo-1",
      experienceTitle: "7 Day Immersive Experience in Meghalaya",
      adults: 2,
      children: 0,
      infants: 0,
      preferredStart: "2026-05-15",
      flexibleDates: false,
      budgetMinor: null,
      currency: "INR",
      message: "Hi, is 15 May available for two? We'd love to do the Dawki boat ride as well.",
      assignee: YOU,
      createdAt: "2026-03-18T11:02:00+05:30",
      unreadCount: 0,
      booking: { id: "bkg-01", reference: "BKG-000142" },
      messages: [
        { ...say(YOU, 0, "Hi Priya! Yes, 15–21 May is open, and the Dawki boat ride is part of day 4. Two spots left on that departure.", { readAt: "2026-03-18T13:40:00+05:30" }), createdAt: "2026-03-18T12:10:00+05:30" },
        { ...say("traveller", 0, "Brilliant — booking it now!", { senderName: "Priya Sengupta", readAt: "2026-03-19T19:30:00+05:30" }), createdAt: "2026-03-19T19:02:00+05:30" },
        { ...say("system", 0, "Booking BKG-000142 created from the marketplace"), createdAt: "2026-03-20T09:20:00+05:30" },
        { ...say("system", 0, "Stage changed to Won"), createdAt: "2026-03-20T09:21:00+05:30" },
      ],
    },
    {
      id: "enq-139",
      reference: "ENQ-000139",
      status: "lost",
      priority: "normal",
      source: "website",
      contactName: "Aditya Verma",
      contactEmail: "aditya.v@example.com",
      contactPhone: null,
      hasAccount: false,
      experienceId: "demo-3",
      experienceTitle: "Rafting, Camping & Cycling in Upper Assam",
      adults: 2,
      children: 0,
      infants: 0,
      preferredStart: inDays(-2),
      flexibleDates: false,
      budgetMinor: null,
      currency: "INR",
      message: "Price for two in late September?",
      assignee: RIYA,
      createdAt: ago(12 * D + 4 * H),
      unreadCount: 0,
      lostReason: "Booked with someone else",
      messages: [
        say(RIYA, 12 * D, "Hi Aditya — for two in late September it's ₹98,000 all-in. Want me to hold the 23rd for you?", { readAt: ago(11 * D) }),
        say("traveller", 9 * D + 2 * H, "Thanks, but we've gone with a shorter trip elsewhere this time.", { senderName: "Aditya Verma", readAt: ago(9 * D) }),
        say("system", 9 * D, "Marked as lost — Booked with someone else"),
      ],
    },
    {
      id: "enq-137",
      reference: "ENQ-000137",
      status: "spam",
      priority: "low",
      source: "website",
      contactName: "Rankboost Digital",
      contactEmail: "offers@rankboost.example",
      contactPhone: null,
      hasAccount: false,
      experienceId: null,
      experienceTitle: null,
      adults: 1,
      children: 0,
      infants: 0,
      preferredStart: null,
      flexibleDates: false,
      budgetMinor: null,
      currency: "INR",
      message: "Get your website on Google page 1 in 7 days!!! Guaranteed 10x bookings. Reply for a FREE audit.",
      assignee: null,
      createdAt: ago(15 * D),
      unreadCount: 0,
      messages: [say("system", 15 * D - 30, "Marked as spam")],
    },
  ];

  return seeds.map((seed) => {
    const { messages, lostReason = null, booking = null, ...base } = seed;
    const summary = summariseThread(base.createdAt, messages);
    const lastSpoken = [...messages].reverse().find((message) => message.senderKind !== "system");
    const row: EnquiryRow = {
      ...base,
      lastMessage: summary.lastMessage,
      awaitingReplySince: summary.awaitingReplySince,
      lastMessageAt: lastSpoken?.createdAt ?? messages.at(-1)?.createdAt ?? base.createdAt,
    };
    return { row, detail: { ...row, lostReason, booking, messages } };
  });
}

import "server-only";

import { connection } from "next/server";

import { demoInsightFacts } from "@/lib/insights/demo";
import {
  buildReport,
  periodWindow,
  type BookingFact,
  type EnquiryFact,
  type ExperienceFact,
  type InsightsReport,
  type ReviewFact,
} from "@/lib/insights/report";
import { createServerSupabase } from "@/lib/supabase/server";
import type { BookingStatus, EnquirySource, EnquiryStatus } from "@/lib/types";

/**
 * The Insights page's data: four reads run together and reduced in memory,
 * the trade Home already makes. The longest comparison is a year against
 * the year before, so nothing older than two years is fetched — except
 * reviews still waiting for a reply, which are owed one however old.
 */
export async function getInsightsReport(): Promise<InsightsReport> {
  await connection();
  const now = Date.now();

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return buildReport(demoInsightFacts(now), now, true);
  }

  const supabase = await createServerSupabase();
  const since = new Date(periodWindow("12m", now).previousStart).toISOString();

  const [bookings, reviews, enquiries, experiences] = await Promise.all([
    supabase
      .from("bookings")
      .select("experience_id, status, is_marketplace, adults, children, infants, total_minor, created_at")
      .neq("status", "draft")
      .gte("created_at", since),
    supabase
      .from("reviews")
      .select("experience_id, rating, created_at, replied_at")
      .or(`created_at.gte."${since}",replied_at.is.null`),
    supabase.from("enquiries").select("created_at, status, source").gte("created_at", since),
    supabase.from("experiences").select("id, title, status, approved_at, created_at"),
  ]);

  // An error surfaces as an error: a report of silent zeros would read as a
  // business that stopped trading.
  for (const result of [bookings, reviews, enquiries, experiences]) {
    if (result.error) throw new Error(`Failed to load Insights: ${result.error.message}`);
  }

  type BookingRow = {
    experience_id: string | null;
    status: BookingStatus;
    is_marketplace: boolean;
    adults: number;
    children: number;
    infants: number;
    total_minor: number;
    created_at: string;
  };
  type ReviewRow = { experience_id: string | null; rating: number; created_at: string; replied_at: string | null };
  type EnquiryRow = { created_at: string; status: EnquiryStatus; source: EnquirySource };
  type ExperienceRow = { id: string; title: string; status: string; approved_at: string | null; created_at: string };

  const facts = {
    bookings: ((bookings.data ?? []) as BookingRow[]).map<BookingFact>((row) => ({
      experienceId: row.experience_id,
      status: row.status,
      isMarketplace: row.is_marketplace,
      guests: row.adults + row.children + row.infants,
      totalMinor: row.total_minor,
      createdAt: row.created_at,
    })),
    reviews: ((reviews.data ?? []) as ReviewRow[]).map<ReviewFact>((row) => ({
      experienceId: row.experience_id,
      rating: row.rating,
      createdAt: row.created_at,
      replied: row.replied_at !== null,
    })),
    enquiries: ((enquiries.data ?? []) as EnquiryRow[]).map<EnquiryFact>((row) => ({
      createdAt: row.created_at,
      status: row.status,
      source: row.source,
    })),
    experiences: ((experiences.data ?? []) as ExperienceRow[]).map<ExperienceFact>((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      liveSince: row.approved_at ?? row.created_at,
    })),
  };

  return buildReport(facts, now, false);
}

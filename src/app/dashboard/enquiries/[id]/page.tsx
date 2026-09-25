import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { EnquiryThread } from "@/components/enquiries/enquiry-thread";
import { getEnquiry, isEnquiryDemo } from "@/lib/data/enquiries";

// generateMetadata and the page both need the enquiry; one request, one read.
const load = cache(getEnquiry);

export async function generateMetadata(
  props: PageProps<"/dashboard/enquiries/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const detail = await load(decodeURIComponent(id));
  return { title: detail ? `${detail.contactName} · Enquiries` : "Enquiries" };
}

export default async function EnquiryPage(
  props: PageProps<"/dashboard/enquiries/[id]">,
) {
  const { id: rawId } = await props.params;
  const id = decodeURIComponent(rawId);
  const detail = await load(id);

  // A sample workspace can hold enquiries logged in this tab that the
  // server has never seen, so an unknown id is resolved by the client there.
  if (!detail && !isEnquiryDemo()) notFound();

  return <EnquiryThread key={id} id={id} initial={detail} />;
}

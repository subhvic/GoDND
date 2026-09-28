import { NextResponse, type NextRequest } from "next/server";

import { isSettingsDemo } from "@/lib/data/settings";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Opens an uploaded document: a redirect to a one-minute signed link.
 *
 * The link is signed with the caller's session, so the bucket's policies
 * decide — a teammate without access to bank details can't open the
 * cancelled cheque even with its path. Only paths the uploader could have
 * written are accepted: {agency uuid}/{section}/{file}.
 */
const PATH = /^[0-9a-f-]{36}\/[a-z-]+\/[\w.-]+$/i;

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path") ?? "";
  if (isSettingsDemo() || !PATH.test(path)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const supabase = await createServerSupabase();
  const { data } = await supabase.storage.from("agency-documents").createSignedUrl(path, 60);
  if (!data?.signedUrl) return new NextResponse("Not found", { status: 404 });

  return NextResponse.redirect(data.signedUrl);
}

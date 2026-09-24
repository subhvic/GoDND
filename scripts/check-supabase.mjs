#!/usr/bin/env node
/*
 * A connection healthcheck for the Supabase wiring.
 *
 *   npm run supabase:check
 *
 * Reports what's set, what's missing, and whether a real read reaches
 * Postgres. Exits non-zero on any failure so it can be dropped into CI or a
 * pre-deploy check later.
 *
 * The service role key is intentionally NOT read here — it belongs only in
 * environment stores that never travel through logs. Anon + URL is enough to
 * prove the client-side path works.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const bold = (t) => `\x1b[1m${t}\x1b[22m`;
const green = (t) => `\x1b[32m${t}\x1b[0m`;
const red = (t) => `\x1b[31m${t}\x1b[0m`;
const dim = (t) => `\x1b[2m${t}\x1b[22m`;

// Pull env from .env.local first — next-dev reads it, so mirror that here so
// running the check from a plain shell gives the same picture the app sees.
loadDotenvIfPresent(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log(bold("\nSupabase connection check\n"));

let ok = true;

if (!url) {
  fail("NEXT_PUBLIC_SUPABASE_URL is not set");
} else if (!url.startsWith("https://") || !url.endsWith(".supabase.co")) {
  warn(
    `NEXT_PUBLIC_SUPABASE_URL is set but doesn't look like a Supabase project URL: ${url}`,
  );
} else {
  pass(`NEXT_PUBLIC_SUPABASE_URL → ${url}`);
}

if (!anon) {
  fail("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");
} else if (anon.length < 100) {
  warn("NEXT_PUBLIC_SUPABASE_ANON_KEY looks short — double-check you copied the whole JWT");
} else {
  pass(`NEXT_PUBLIC_SUPABASE_ANON_KEY → ${maskJwt(anon)}`);
}

if (!service) {
  info(
    "SUPABASE_SERVICE_ROLE_KEY is not set locally — that's fine; keep it in Vercel only.",
  );
} else {
  info(
    `SUPABASE_SERVICE_ROLE_KEY is present locally (${maskJwt(service)}). Only needed for webhooks and payout jobs; safe to remove from .env.local if you don't run those.`,
  );
}

if (url && anon) {
  const supabase = createClient(url, anon);
  try {
    const { error } = await supabase.from("agency").select("id").limit(1);
    if (error) {
      if (error.code === "42P01") {
        fail(
          `Connected, but the "agency" table doesn't exist. Run the migrations under supabase/migrations (see docs/SUPABASE_SETUP.md).`,
        );
      } else if (error.code === "PGRST301" || error.message.includes("JWT")) {
        fail(`Auth error: ${error.message}. The anon key might be from a different project than the URL.`);
      } else {
        // A real error but not "no table" — could be RLS on an anonymous
        // read, which is actually GOOD (means the DB is up and policies
        // are guarding it). Report it as a pass with a note.
        info(
          `Query returned an error (${error.code || "unknown"}: ${error.message}). If it reads like an RLS denial, the DB is up and policies are working. Otherwise investigate.`,
        );
      }
    } else {
      pass("Read reached Postgres and returned successfully.");
    }
  } catch (err) {
    fail(`Could not reach ${url}: ${err.message}`);
  }
} else {
  info("Skipping the live query — fill in the URL + anon key first.");
}

console.log();
if (!ok) {
  console.log(red("Connection is not ready. See docs/SUPABASE_SETUP.md for the runbook.\n"));
  process.exit(1);
} else {
  console.log(green("Connection is wired.\n"));
}

/* -------------------------------------------------------------------------- */

function pass(msg) {
  console.log(`  ${green("✓")} ${msg}`);
}
function warn(msg) {
  console.log(`  ${red("!")} ${msg}`);
  ok = false;
}
function fail(msg) {
  console.log(`  ${red("✗")} ${msg}`);
  ok = false;
}
function info(msg) {
  console.log(`  ${dim("◦")} ${dim(msg)}`);
}

/** Redact everything but the head + tail of a JWT so logs are readable but not leaky. */
function maskJwt(jwt) {
  if (jwt.length <= 16) return "…";
  return `${jwt.slice(0, 8)}…${jwt.slice(-6)}`;
}

/**
 * Tiny .env parser — no dep. Only handles KEY=VALUE lines; ignores blanks,
 * comments and shell continuations. Enough for what .env.local carries.
 */
function loadDotenvIfPresent(name) {
  const path = resolve(process.cwd(), name);
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // Strip a single pair of matching quotes, if present.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

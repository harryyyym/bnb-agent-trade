// Shared guard for the quote / x402 route handlers: params → shelf row
// (allowlist — the endpoint is always the row's, never the request's), rail
// and reachability checks, a per-agent cooldown and body sanitising.
import "server-only";

import { NextResponse } from "next/server";
import { isReachable, parseAgentParams, railsOf } from "./format";
import { probeFor } from "./live";
import { getRow } from "./shelf";
import { QUOTE_DEFAULT_TASK, QUOTE_TASK_MAX } from "./site";
import type { Rail, ShelfRow } from "./types";

export const COOLDOWN_MS = 15_000;

const NO_STORE = { "Cache-Control": "no-store" } as const;

export type Params = Promise<{ chain: string; id: string }>;

export function fail(status: number, reason: string): NextResponse {
  return NextResponse.json({ ok: false, reason }, { status, headers: NO_STORE });
}

export function ok(body: unknown): NextResponse {
  return NextResponse.json(body, { headers: NO_STORE });
}

/**
 * Resolves the row for `/api/agents/[chain]/[id]/…`. Refuses unknown ids,
 * agents that do not declare `rail`, and endpoints that failed the last probe
 * (the profile only renders the panel when they passed it).
 */
export async function resolveAgent(params: Params, rail: Rail): Promise<{ row: ShelfRow } | NextResponse> {
  const { chain, id } = await params;
  const p = parseAgentParams(chain, id);
  const row = p ? getRow(p.chain, p.id) : undefined;
  if (!row) return fail(404, "No such agent");
  if (!railsOf(row).includes(rail)) {
    return fail(400, rail === "erc8183" ? "This agent does not declare ERC-8183" : "This agent does not declare x402");
  }
  if (!row.endpoint || !/^https?:\/\//.test(row.endpoint)) return fail(409, "No public endpoint");
  const probe = probeFor(row);
  if (!isReachable(probe.word)) return fail(409, "The endpoint did not answer the last check");
  return { row };
}

const LAST = new Map<string, number>();

/** One call per agent per rail every COOLDOWN_MS. Records the hit when allowed. */
export function underCooldown(key: string, now = Date.now()): boolean {
  if (LAST.size > 1000) {
    for (const [k, t] of LAST) if (now - t >= COOLDOWN_MS) LAST.delete(k);
  }
  const last = LAST.get(key);
  if (last !== undefined && now - last < COOLDOWN_MS) return true;
  LAST.set(key, now);
  return false;
}

// Control, format and zero-width characters (kept as escapes: ES2017 target).
const NON_PRINTABLE = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2028\u2029\u2060-\u2069\ufeff]/g;

/** Printable text only, whitespace collapsed, ≤ QUOTE_TASK_MAX chars; `fallback` when empty. */
export function sanitiseTask(v: unknown, fallback = QUOTE_DEFAULT_TASK): string {
  if (typeof v !== "string") return fallback;
  const s = v.replace(NON_PRINTABLE, " ").replace(/\s+/g, " ").trim().slice(0, QUOTE_TASK_MAX).trim();
  return s || fallback;
}

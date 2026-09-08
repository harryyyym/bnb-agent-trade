// POST /api/agents/[chain]/[id]/quote — asks the agent's ERC-8183 `negotiate`
// skill for a signed quote on explicit user action. The endpoint comes from
// the shelf row; the request only supplies a short task text.
import type { NextRequest } from "next/server";
import { requestQuote } from "@/lib/live";
import { rowKey } from "@/lib/format";
import { fail, ok, resolveAgent, sanitiseTask, underCooldown, type Params } from "@/lib/quote-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The panel sends ~230 bytes; route handlers have no body limit of their own. */
const BODY_MAX = 4096;

export async function POST(req: NextRequest, ctx: { params: Params }) {
  const resolved = await resolveAgent(ctx.params, "erc8183");
  if (!("row" in resolved)) return resolved;
  const { row } = resolved;

  // Refuse oversized bodies before buffering them; a declared length is
  // checked first, the read text is capped again in case none was declared.
  const declared = req.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > BODY_MAX)) return fail(413, "Body too large");
  let body: unknown = null;
  try {
    const text = await req.text();
    if (text.length > BODY_MAX) return fail(413, "Body too large");
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  const task = sanitiseTask(body && typeof body === "object" ? (body as { task?: unknown }).task : undefined);

  if (underCooldown(`quote:${rowKey(row)}`)) return fail(429, "Try again in a few seconds");

  try {
    return ok(await requestQuote(row.chain, row.id, task));
  } catch {
    return fail(502, "The agent did not answer");
  }
}

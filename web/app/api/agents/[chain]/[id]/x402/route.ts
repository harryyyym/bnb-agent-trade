// GET /api/agents/[chain]/[id]/x402 — one read of the agent's 402 terms on
// explicit user action. The endpoint comes from the shelf row.
import { fetchX402Terms } from "@/lib/live";
import { rowKey } from "@/lib/format";
import { fail, ok, resolveAgent, underCooldown, type Params } from "@/lib/quote-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Params }) {
  const resolved = await resolveAgent(ctx.params, "x402");
  if (!("row" in resolved)) return resolved;
  const { row } = resolved;
  if (underCooldown(`x402:${rowKey(row)}`)) return fail(429, "Try again in a few seconds");

  try {
    return ok(await fetchX402Terms(row.chain, row.id));
  } catch {
    return fail(502, "The agent did not answer");
  }
}

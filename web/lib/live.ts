// Live-data interface. Signatures are the contract with the page builders;
// keep them exact. Bodies: probe loop snapshot (lib/probe-store), BSC reads
// (lib/chain), A2A quote (lib/a2a) and 402 terms (lib/x402). Every function
// degrades to build-time data — never throws, never blocks past its budget.
import "server-only";

import { requestQuoteFor } from "./a2a";
import { getCompletedJobsCached, getRegistryCountCached, type RawJob } from "./chain";
import { fmtU, rowKey } from "./format";
import { withTimeout } from "./probe";
import { getLoopSnapshot } from "./probe-store";
import { getChainRows, getChainStats, getRow, getRows } from "./shelf";
import type {
  Chain,
  ProbeResult,
  ProbeSnapshot,
  ProbeWord,
  QuoteResult,
  SettledJob,
  ShelfRow,
  X402Result,
} from "./types";
import { fetchX402TermsFor } from "./x402";

export type { ProbeWord, ProbeResult, ProbeSnapshot, SettledJob, QuoteResult, X402Result };

/** Whole-flow cap for the two user-triggered calls (several 8 s requests each). */
const FLOW_BUDGET_MS = 20_000;

let BUILD_SNAPSHOT: ProbeSnapshot | null = null;

function buildSnapshot(): ProbeSnapshot {
  if (BUILD_SNAPSHOT) return BUILD_SNAPSHOT;
  const results: Record<string, ProbeResult> = {};
  let latest: string | null = null;
  for (const r of getRows()) {
    const res: ProbeResult = {
      word: r.probe.word,
      code: r.probe.code,
      latencyMs: r.probe.latencyMs,
      checkedAt: r.probe.checkedAt,
      ...(r.probe.path ? { path: r.probe.path } : {}),
    };
    results[`${r.chain}:${r.id}`] = res;
    if (r.probe.word !== "no-public" && (!latest || r.probe.checkedAt > latest)) latest = r.probe.checkedAt;
  }
  BUILD_SNAPSHOT = { checkedAt: latest, source: "build", results };
  return BUILD_SNAPSHOT;
}

/**
 * Synchronous; never waits on the network. The latest probe-loop sweep when
 * one has completed, else the build-time row.probe values with source "build"
 * and checkedAt = the latest row.probe.checkedAt.
 */
export function getProbeSnapshot(): ProbeSnapshot {
  return getLoopSnapshot() ?? buildSnapshot();
}

/** Probe result for one row: the loop's latest word once it has run, the build-time probe otherwise. */
export function probeFor(row: Pick<ShelfRow, "chain" | "id" | "probe">): ProbeResult {
  const live = getProbeSnapshot().results[rowKey(row)];
  if (live) return live;
  const p = row.probe;
  return { word: p.word, code: p.code, latencyMs: p.latencyMs, checkedAt: p.checkedAt, ...(p.path ? { path: p.path } : {}) };
}

/**
 * Total ERC-8004 registrations on a chain: the highest minted id, read live
 * (60 s cache, 8 s budget). Falls back to shelf-stats for that chain; null
 * when the chain was never built and the read failed.
 */
export async function getRegistryCount(
  chain: 56 | 97,
): Promise<{ count: number; block: number; at: string } | null> {
  const s = getChainStats(chain);
  const live = await getRegistryCountCached(chain, s?.registered ?? 0);
  if (live) return live;
  return s ? { count: s.registered, block: s.block, at: s.builtAt } : null;
}

const lc = (a: string | null | undefined) => (a ? a.toLowerCase() : "");

/**
 * Provider address → shelf row on the same chain; wallet matches beat owner
 * matches, rank order breaks ties. Chain rows only: this attributes a REAL
 * settled job read from the commerce contract to a listing, so a seeded row
 * must never be the thing it names, whatever its synthetic wallet happens to be.
 */
function providerIndex(): (chain: Chain, provider: string) => ShelfRow | undefined {
  const byWallet = new Map<string, ShelfRow>();
  const byOwner = new Map<string, ShelfRow>();
  for (const r of getChainRows()) {
    const w = `${r.chain}:${lc(r.wallet)}`;
    const o = `${r.chain}:${lc(r.owner)}`;
    if (r.wallet && !byWallet.has(w)) byWallet.set(w, r);
    if (r.owner && !byOwner.has(o)) byOwner.set(o, r);
  }
  return (chain, provider) => byWallet.get(`${chain}:${provider}`) ?? byOwner.get(`${chain}:${provider}`);
}

function fromChain(j: RawJob, row: ShelfRow | undefined): SettledJob {
  const u = fmtU(j.budget);
  return {
    chain: j.chain,
    jobId: j.id,
    provider: j.provider,
    client: j.client,
    budgetU: u === "–" ? "" : u.replace(/ U$/, ""),
    // ERC-8183 keeps no completion time; submittedAt is the last state change the struct records.
    completedAt: j.submittedAt ? new Date(j.submittedAt * 1000).toISOString() : null,
    agent: row ? { id: row.id, chain: row.chain, name: row.name } : null,
    selfHire: row ? [lc(row.owner), lc(row.wallet)].includes(j.client) : j.client === j.provider,
  };
}

/**
 * Build-time stand-in for one chain: one entry per row with completed jobs.
 * Chain rows only — this feeds the landing's "Recent settlements", which is
 * presented as on-chain events. No seeded row carries completedJobIds today, so
 * none can reach it; iterating the chain rows keeps that true by construction
 * rather than by luck.
 */
function fallbackJobs(chain: Chain): SettledJob[] {
  const jobs: SettledJob[] = [];
  for (const r of getChainRows()) {
    if (r.chain !== chain) continue;
    const c = r.commerce;
    if (!c || c.completed < 1 || c.completedJobIds.length === 0) continue;
    jobs.push({
      chain: r.chain,
      jobId: Math.max(...c.completedJobIds),
      provider: lc(r.wallet || r.owner),
      client: c.completedClients.length === 1 ? c.completedClients[0] : "",
      budgetU: c.completed === 1 ? c.completedVolumeU.toFixed(2) : "",
      completedAt: c.lastCompletedAt ? new Date(c.lastCompletedAt * 1000).toISOString() : null,
      agent: { id: r.id, chain: r.chain, name: r.name },
      selfHire: r.commerceSelfHire,
    });
  }
  return jobs;
}

/**
 * Most recent COMPLETED ERC-8183 jobs across both chains: the latest 200 job
 * ids per contract, read live (30 s cache, 8 s budget per chain), joined to
 * shelf rows by provider address. A chain whose read is unavailable falls
 * back to the rows' build-time commerce summaries.
 */
export async function getRecentSettledJobs(limit = 10): Promise<SettledJob[]> {
  const chains: Chain[] = [97, 56];
  const lists = await Promise.all(chains.map((c) => getCompletedJobsCached(c)));
  const rowFor = providerIndex();
  const jobs: SettledJob[] = [];
  chains.forEach((chain, i) => {
    const live = lists[i];
    if (live) for (const j of live) jobs.push(fromChain(j, rowFor(chain, j.provider)));
    else jobs.push(...fallbackJobs(chain));
  });
  const seen = new Set<string>();
  return jobs
    .filter((j) => {
      const k = `${j.chain}:${j.jobId}`;
      return seen.has(k) ? false : (seen.add(k), true);
    })
    // The landing's feed is the site's live proof, and it led with a zero-value
    // job to a provider that is not listed here — a hex string a reader could
    // not follow anywhere on this site. A settlement in the feed names an agent
    // on the shelf and moved a non-zero amount; a budget the fallback does not
    // know per job ("") is allowed through. The whole list is still read, so
    // the feed fills from further back rather than showing fewer rows.
    .filter((j) => j.agent !== null && (j.budgetU === "" || Number(j.budgetU) > 0))
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "") || b.jobId - a.jobId)
    .slice(0, Math.max(0, limit));
}

/**
 * In-site quote request: agent card → `negotiate` skill → one A2A
 * `message/send`. Read-only; nothing is signed or funded. Only rows on the
 * shelf can be called, by chain + id.
 */
export async function requestQuote(chain: number, id: number, task: string): Promise<QuoteResult> {
  const row = getRow(chain, id);
  if (!row) return { ok: false, reason: "Unknown agent" };
  if (!row.endpoint) return { ok: false, reason: "No public endpoint" };
  return withTimeout(
    requestQuoteFor(
      { endpoint: row.endpoint, cardUrl: row.cardUrl, docUrl: row.doc?.url, docRaw: row.doc?.raw },
      task,
    ),
    FLOW_BUDGET_MS,
    () => ({ ok: false, reason: "Timed out" }),
  );
}

/** One GET against the agent's paid endpoint to read its 402 terms. Read-only. */
export async function fetchX402Terms(chain: number, id: number): Promise<X402Result> {
  const row = getRow(chain, id);
  if (!row) return { ok: false, reason: "Unknown agent" };
  if (!row.endpoint && row.services.every((s) => !/^https?:\/\//i.test(s.endpoint))) {
    return { ok: false, reason: "No public endpoint" };
  }
  return withTimeout(
    fetchX402TermsFor({ endpoint: row.endpoint, path: row.probe.path, services: row.services }),
    FLOW_BUDGET_MS,
    () => ({ ok: false, reason: "Timed out" }),
  );
}

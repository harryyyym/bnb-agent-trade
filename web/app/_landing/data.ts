// Server-only data for the landing, hiring and payments pages. Every number
// here binds to shelf.json / shelf-stats.json / lib/live; nothing is typed in.
import "server-only";

import { getProbeSnapshot, getRegistryCount } from "@/lib/live";
import { getChainRows, getFeatured, getRows, getStats } from "@/lib/shelf";
import { GITHUB_URL } from "@/lib/site";
import {
  AUTHORITY_LABEL,
  authorityOf,
  chainLabel,
  explorerBase,
  fmtInt,
  footerLine,
  isChain,
  railsOf,
  type ChainBlock,
} from "@/lib/format";
import type { Authority, Chain, ChainStats, ShelfRow, TeamPrice } from "@/lib/types";

// ---------------------------------------------------------------- hero

export interface HeroCount {
  count: number;
  /** The brand-highlight line under the number. */
  highlight: string;
  /** Provenance tooltip on the number. */
  title: string;
}

/**
 * Every id registered on the ERC-8004 registry: the live mainnet count when the
 * chain answers, otherwise the registered total in shelf-stats, labelled with
 * its chain. It is the first cell of the landing funnel, not the headline —
 * a number that changes between page loads has no business being the largest
 * thing on the page, and one click later the marketplace contradicted it.
 */
export async function getHeroCount(): Promise<HeroCount> {
  const live = await getRegistryCount(56);
  if (live) {
    return {
      count: live.count,
      highlight: "on BNB Chain.",
      title: `chain, read from ${chainLabel(56)} 56 at block ${fmtInt(live.block)}`,
    };
  }
  const stats = getStats();
  const built = Object.keys(stats.chains).map(Number).filter(isChain);
  const only = built.length === 1 ? built[0] : null;
  const s = only ? stats.chains[String(only) as "56" | "97"] : undefined;
  return {
    count: stats.registered,
    highlight: only ? `on ${chainLabel(only)}.` : "on BNB Chain.",
    title: s
      ? `chain, read from ${chainLabel(s.chain)} ${s.chain} at block ${fmtInt(s.block)}`
      : `chain, registered ids across ${built.map((c) => chainLabel(c)).join(" and ")}`,
  };
}

// ---------------------------------------------------------------- hiring counts

export interface HiringCounts {
  escrow: number;
  x402: number;
  settled: number;
  byAuthority: Record<Authority, number>;
}

/** Rail and authority counts over every listed row (all chains). */
export function getHiringCounts(): HiringCounts {
  // Chain rows only. This was the one count on the site that did not filter
  // provenance, and all eight seeded rows carry tier "SETTLED ON CHAIN" and an
  // erc8183 rail — so /hiring claimed 51 agents had settled a paid job while
  // the landing, which does filter, said 43 on the same click. A seeded row is
  // never part of an on-chain total (docs/marketplace/design.md §3).
  const rows = getChainRows();
  const byAuthority: Record<Authority, number> = {
    advice: 0,
    session: 0,
    contract: 0,
    "operator-run": 0,
    none: 0,
  };
  let escrow = 0;
  let x402 = 0;
  let settled = 0;
  for (const r of rows) {
    const rails = railsOf(r);
    if (rails.includes("erc8183")) escrow++;
    if (rails.includes("x402")) x402++;
    if (r.tier === "SETTLED ON CHAIN") settled++;
    byAuthority[authorityOf(r)]++;
  }
  return { escrow, x402, settled, byAuthority };
}

export const AUTHORITY_ORDER: readonly Authority[] = ["advice", "session", "contract", "operator-run", "none"];
export { AUTHORITY_LABEL };

/** "1 agent" / "24 agents". */
export function agentsWord(n: number): string {
  return `${fmtInt(n)} ${n === 1 ? "agent" : "agents"}`;
}

// ---------------------------------------------------------------- the settled job

export interface ShowcaseJob {
  row: ShelfRow;
  jobId: number;
  /** "2.00 U" when the evidence label states it; null otherwise. */
  amount: string | null;
  /** BscScan link from the evidence entry. */
  url: string;
  /** Deliverable manifest in the public repository. */
  manifestUrl: string;
  /** Unix seconds, when the job is the row's latest completed one. */
  completedAt: number | null;
  /** Commerce contract on the row's chain, when built. */
  contract: { address: string; url: string } | null;
}

/*
 * Deliverable manifests live at the ROOT of the public repo, under
 * `deliverables/` — not `agents/deliverables/`, which is where they sit in the
 * private working repo. Checked: 736, 853, 1026 and 1027 all resolve.
 */
const MANIFEST_PATH = (jobId: number) => `${GITHUB_URL}/blob/main/deliverables/manifest-job-${jobId}.json`;

/**
 * The one settled ERC-8183 job walked through on /hiring: the first featured
 * row whose evidence names a job. Every figure is read from that row.
 */
export function getShowcaseJob(): ShowcaseJob | null {
  for (const row of getFeatured()) {
    const ev = row.team?.evidence.find((e) => /\bjob \d+/i.test(e.label));
    if (!ev) continue;
    const jobId = Number(/\bjob (\d+)/i.exec(ev.label)?.[1]);
    if (!Number.isInteger(jobId)) continue;
    const amt = /(\d+(?:\.\d+)?)\s*U\b/.exec(ev.label);
    const c = row.commerce;
    const latest = c && c.completedJobIds.length ? Math.max(...c.completedJobIds) : null;
    const cs = getStats().chains[String(row.chain) as "56" | "97"];
    return {
      row,
      jobId,
      amount: amt ? `${Number(amt[1]).toFixed(2)} U` : null,
      url: ev.url,
      manifestUrl: MANIFEST_PATH(jobId),
      completedAt: latest === jobId ? c?.lastCompletedAt ?? null : null,
      contract: cs?.commerce
        ? { address: cs.commerce.contract, url: `${explorerBase(row.chain)}/address/${cs.commerce.contract}` }
        : null,
    };
  }
  return null;
}

// ---------------------------------------------------------------- payments

export interface PricedRow {
  row: ShelfRow;
  price: TeamPrice;
  settlementTx: string | null;
}

/** The row whose operator captured a 402 (price on file); Pancake Ranger today. */
export function getPricedRow(): PricedRow | null {
  const row = getFeatured().find((r) => r.team?.price);
  if (!row?.team?.price) return null;
  return { row, price: row.team.price, settlementTx: row.team.settlementTx ?? null };
}

/**
 * Rows whose agent card or operator declares x402 pay per call. Chain rows
 * only: /payments has no seeded toggle, so a seeded row reaching this list
 * would be an unlabelled synthetic record in a section about real payment
 * rails. None declares x402 today; this keeps that true by construction.
 */
export function getX402Rows(): ShelfRow[] {
  return getChainRows().filter((r) => railsOf(r).includes("x402"));
}

/** Chains with a built AgenticCommerce contract: "BSC mainnet and BSC testnet". */
export function commerceChainsLabel(): string {
  const stats = getStats();
  const names = ([56, 97] as Chain[])
    .map((c) => stats.chains[String(c) as "56" | "97"])
    .filter((s): s is ChainStats => Boolean(s?.commerce))
    .map((s) => chainLabel(s.chain));
  return names.length ? names.join(" and ") : "BNB Chain";
}

// ---------------------------------------------------------------- footer

/** The one footer line for site-wide pages: every built chain with its block, plus probe freshness. */
export function siteFooterLine(now: number = Date.now()): string {
  const snap = getProbeSnapshot();
  const stats = getStats();
  const chains: ChainBlock[] = ([56, 97] as Chain[])
    .map((c) => stats.chains[String(c) as "56" | "97"])
    .filter((s): s is ChainStats => Boolean(s))
    .map((s) => ({ chain: s.chain, block: s.block }));
  return footerLine({ chains, checkedAt: snap.checkedAt, source: snap.source, now });
}

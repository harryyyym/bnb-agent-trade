// The ask box's answers, computed on the server from the shelf. One answer per
// official category: the denominator, what the category holds, the row with the
// most settlement, the row that has both settlement and a live endpoint, and
// what the rest of the category is.
//
// Nothing here is written by a language model. The question is matched to a
// category by keyword (lib/intents.ts, pure and shared with the client), and
// the answer is these numbers in a fixed order, each linked to the row it came
// from. A number that is not in the shelf cannot appear in an answer.
//
// Seeded demo rows never enter a count: `provenance === "chain"` is the filter
// on every aggregate below, and the seeded lane is reported separately so the
// reader can see it was set aside rather than folded in.
import "server-only";

import { INTENTS, type Intent } from "./intents";
import { isReachable } from "./format";
import { getChainRows, getSeededRows, getStats } from "./shelf";
import type { Category, ShelfRow } from "./types";

/** One agent named in an answer, with the facts the sentence about it uses. */
export interface AskRow {
  key: string;
  chain: number;
  id: number;
  name: string;
  jobs: number;
  outside: number;
  volumeU: number | null;
  answers: boolean;
  latencyMs: number | null;
  selfHire: boolean;
}

export interface Ask extends Intent {
  category: Category;
  /** Chain rows in the category. Seeded rows are counted apart. */
  shelved: number;
  seeded: number;
  settled: number;
  outsidePaid: number;
  answering: number;
  /** Most settled jobs. Null when nothing in the category has been paid. */
  top: AskRow | null;
  /** Most settled among the rows whose endpoint also answers. */
  live: AskRow | null;
  /** Answer their endpoint and have never been paid on chain. */
  answeringUnpaid: number;
}

export interface AskDenominator {
  registered: number;
  eligible: number;
  shelved: number;
}

function toAskRow(row: ShelfRow): AskRow {
  const c = row.commerce;
  return {
    key: `${row.chain}:${row.id}`,
    chain: row.chain,
    id: row.id,
    name: row.name,
    jobs: c?.completed ?? 0,
    outside: row.commerceOutsideClients,
    volumeU: c?.completedVolumeU ?? null,
    answers: isReachable(row.probe.word),
    latencyMs: row.probe.latencyMs ?? null,
    selfHire: row.commerceSelfHire,
  };
}

/** Most settled first; a tie goes to the one with more buyers that are not the operator. */
function bySettlement(a: ShelfRow, b: ShelfRow): number {
  const jobs = (b.commerce?.completed ?? 0) - (a.commerce?.completed ?? 0);
  return jobs !== 0 ? jobs : b.commerceOutsideClients - a.commerceOutsideClients;
}

export function getAskDenominator(): AskDenominator {
  const s = getStats();
  return { registered: s.registered, eligible: s.eligible, shelved: s.shelved };
}

export function getAsks(): Ask[] {
  const chain = getChainRows();
  const seededAll = getSeededRows();

  return INTENTS.map((intent) => {
    const rows = chain.filter((r) => r.category === intent.category);
    const paid = rows.filter((r) => (r.commerce?.completed ?? 0) > 0).sort(bySettlement);
    const answering = rows.filter((r) => isReachable(r.probe.word));
    const both = paid.filter((r) => isReachable(r.probe.word));
    const top = paid[0] ?? null;
    const live = both[0] ?? null;

    return {
      ...intent,
      shelved: rows.length,
      seeded: seededAll.filter((r) => r.category === intent.category).length,
      settled: paid.length,
      outsidePaid: rows.filter((r) => r.commerceOutsideClients > 0).length,
      answering: answering.length,
      top: top ? toAskRow(top) : null,
      // Only worth naming when it is a different row from the top one; when the
      // most settled row also answers, one name carries both facts.
      live: live && top && live.id === top.id && live.chain === top.chain ? null : live ? toAskRow(live) : null,
      answeringUnpaid: answering.filter((r) => (r.commerce?.completed ?? 0) === 0).length,
    };
  });
}

// The ask box's answers, computed on the server from the shelf. One answer per
// official category: four counts, and the three best-evidenced rows in it.
//
// Nothing here is written by a language model. The question is matched to a
// category by keyword (lib/intents.ts, pure and shared with the client), and
// the answer is these figures plus real marketplace rows, so the reader sees
// the same identicons, proof badges and status words the list uses.
//
// Seeded demo rows never enter a count or a row: `provenance === "chain"` is
// the filter on every aggregate below, and the seeded lane is reported apart so
// the reader can see it was set aside rather than folded in.
import "server-only";

import { sortRows } from "@/app/marketplace/filters";
import { isReachable } from "./format";
import { INTENTS, type Intent } from "./intents";
import { getChainRows, getSeededRows, getStats, toLite } from "./shelf";
import type { Category, LiteRow } from "./types";

/** Rows shown under an answer. Three fits the fold without a scroll. */
const SHOWN = 3;

export interface Ask extends Intent {
  category: Category;
  /** Chain rows in the category. Seeded rows are counted apart. */
  shelved: number;
  seeded: number;
  settled: number;
  outsidePaid: number;
  answering: number;
  /** The best evidenced, in the order the marketplace itself ranks them. */
  rows: LiteRow[];
}

export interface AskDenominator {
  registered: number;
  eligible: number;
  shelved: number;
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
    return {
      ...intent,
      shelved: rows.length,
      seeded: seededAll.filter((r) => r.category === intent.category).length,
      settled: rows.filter((r) => (r.commerce?.completed ?? 0) > 0).length,
      outsidePaid: rows.filter((r) => r.commerceOutsideClients > 0).length,
      answering: rows.filter((r) => isReachable(r.probe.word)).length,
      rows: sortRows(rows.map(toLite), "evidence").slice(0, SHOWN),
    };
  });
}

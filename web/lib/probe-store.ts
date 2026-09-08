// The 5-minute probe loop and its in-memory snapshot. Started once from
// instrumentation.ts; state lives on globalThis because the instrumentation
// bundle and the route bundles each get their own copy of this module.
import { PROBE_INTERVAL_MS } from "./site";
import { getRows } from "./shelf";
import { rowKey } from "./format";
import { PROBE_CONCURRENCY, pool, probeEndpoint, probeStatusUrl, safeUrl } from "./probe";
import type { ProbeResult, ProbeSnapshot, ProbeWord, ShelfRow } from "./types";

interface Store {
  snapshot: ProbeSnapshot | null;
  sweeps: number;
  started: boolean;
  sweeping: boolean;
  timer: ReturnType<typeof setInterval> | null;
  lastError: string | null;
}

const KEY = Symbol.for("bnb-agent-marketplace.probe-store");

function store(): Store {
  const g = globalThis as unknown as { [KEY]?: Store };
  if (!g[KEY]) g[KEY] = { snapshot: null, sweeps: 0, started: false, sweeping: false, timer: null, lastError: null };
  return g[KEY];
}

/** Latest completed sweep, or null before the first one finishes. */
export function getLoopSnapshot(): ProbeSnapshot | null {
  return store().snapshot;
}

export function getLoopStats(): { sweeps: number; started: boolean; sweeping: boolean; lastError: string | null } {
  const s = store();
  return { sweeps: s.sweeps, started: s.started, sweeping: s.sweeping, lastError: s.lastError };
}

function buildTimeResult(row: ShelfRow): ProbeResult {
  return {
    word: row.probe.word,
    code: row.probe.code,
    latencyMs: row.probe.latencyMs,
    checkedAt: row.probe.checkedAt,
    ...(row.probe.path ? { path: row.probe.path } : {}),
  };
}

type Target =
  | { kind: "status"; url: string }
  | { kind: "endpoint"; url: string; path: string | null }
  | { kind: "none" }
  | { kind: "skip" };

function targetOf(row: ShelfRow): Target {
  const status = row.operator === "team" ? row.team?.statusUrl : undefined;
  if (status && safeUrl(status)) return { kind: "status", url: status };
  if (!row.endpoint) return { kind: "none" };
  // Hosts the security rule refuses (IP literals, localhost, .local/.internal)
  // keep their build-time result; the loop never touches them.
  if (!safeUrl(row.endpoint)) return { kind: "skip" };
  return { kind: "endpoint", url: row.endpoint, path: row.probe.path ?? null };
}

/**
 * One full sweep over every shelf row. Endpoints shared by several rows are
 * probed once. Never throws; returns the snapshot it installed.
 */
export async function sweep(rows: readonly ShelfRow[] = getRows()): Promise<ProbeSnapshot> {
  // Never dial a seeded row. Its endpoint is a `.invalid` hostname that exists
  // only to fill the field, so a probe can only ever come back UNREACHABLE and
  // paint a demonstration row red for failing to be real.
  rows = rows.filter((r) => r.provenance !== "demo");
  const s = store();
  const t0 = Date.now();
  s.sweeping = true;
  const results: Record<string, ProbeResult> = {};
  const counts: Record<ProbeWord | "skipped", number> = { live: 0, responds: 0, gated: 0, unreachable: 0, "no-public": 0, skipped: 0 };
  try {
    const groups = new Map<string, { target: Target; rows: ShelfRow[] }>();
    for (const row of rows) {
      const target = targetOf(row);
      if (target.kind === "none") {
        results[rowKey(row)] = { word: "no-public", code: null, latencyMs: null, checkedAt: new Date().toISOString() };
        counts["no-public"]++;
        continue;
      }
      if (target.kind === "skip") {
        results[rowKey(row)] = buildTimeResult(row);
        counts.skipped++;
        continue;
      }
      const key = target.kind === "status" ? `s|${target.url}` : `e|${target.url}|${target.path ?? ""}`;
      const g = groups.get(key);
      if (g) g.rows.push(row);
      else groups.set(key, { target, rows: [row] });
    }
    const list = Array.from(groups.values());
    const probed = await pool(list, PROBE_CONCURRENCY, async ({ target }) => {
      try {
        if (target.kind === "status") return await probeStatusUrl(target.url);
        if (target.kind === "endpoint") return await probeEndpoint(target.url, { path: target.path });
      } catch {
        /* probeEndpoint never throws; belt and braces */
      }
      return { word: "unreachable" as const, code: null, latencyMs: null, checkedAt: new Date().toISOString() };
    });
    list.forEach((g, i) => {
      const r = probed[i];
      counts[r.word] += g.rows.length;
      for (const row of g.rows) results[rowKey(row)] = r;
    });
    const snapshot: ProbeSnapshot = { checkedAt: new Date().toISOString(), source: "loop", results };
    s.snapshot = snapshot;
    s.sweeps += 1;
    s.lastError = null;
    console.log(
      `[probe] sweep #${s.sweeps}: ${rows.length} rows, ${list.length} targets, live ${counts.live}, responds ${counts.responds}, ` +
        `gated ${counts.gated}, unreachable ${counts.unreachable}, no-public ${counts["no-public"]}, skipped ${counts.skipped}, ${(
          (Date.now() - t0) /
          1000
        ).toFixed(1)}s`,
    );
    return snapshot;
  } catch (e) {
    s.lastError = e instanceof Error ? e.message : String(e);
    console.warn(`[probe] sweep failed: ${s.lastError}`);
    return s.snapshot ?? { checkedAt: null, source: "build", results: {} };
  } finally {
    s.sweeping = false;
  }
}

/** Idempotent: one loop per process, whatever bundle calls this. */
export function startProbeLoop(intervalMs: number = PROBE_INTERVAL_MS): void {
  const s = store();
  if (s.started) return;
  s.started = true;
  const tick = () => {
    if (s.sweeping) return;
    void sweep();
  };
  tick();
  s.timer = setInterval(tick, intervalMs);
  s.timer.unref?.();
  console.log(`[probe] loop started, every ${Math.round(intervalMs / 60_000)} min`);
}

export function stopProbeLoop(): void {
  const s = store();
  if (s.timer) clearInterval(s.timer);
  s.timer = null;
  s.started = false;
}

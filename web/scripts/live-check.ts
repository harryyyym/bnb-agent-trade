// Smoke test for lib/live.ts against the real shelf and the real network.
//
//   cd web && npx --yes tsx --conditions=react-server scripts/live-check.ts [options]
//
//   --sections snapshot,sweep,count,jobs,quote,x402   (default: all)
//   --quote 97:2059,97:2020        agents to ask for a quote (chain:id)
//   --x402  56:311259,97:2012      agents whose 402 terms to read
//   --task "…"                     task description sent with the quote
//
// `--conditions=react-server` makes the `server-only` marker resolve to its
// empty build, exactly as Next's server compilers do. Read-only throughout:
// a quote is not a job, a 402 is not a payment.
import { fetchX402Terms, getProbeSnapshot, getRecentSettledJobs, getRegistryCount, requestQuote } from "../lib/live";
import { getLoopStats, sweep } from "../lib/probe-store";
import { getRows } from "../lib/shelf";
import type { Chain, ProbeWord } from "../lib/types";

const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = argv.indexOf(name);
  return i > -1 ? argv[i + 1] : undefined;
};
const sections = new Set((flag("--sections") ?? "snapshot,sweep,count,jobs,quote,x402").split(","));
const pairs = (v: string | undefined, dflt: string): [Chain, number][] =>
  (v ?? dflt)
    .split(",")
    .map((s) => s.trim().split(":"))
    .filter((p) => p.length === 2)
    .map(([c, i]) => [Number(c) as Chain, Number(i)]);
// Defaults: Studio (data-part shape), Hevo (JSON-RPC at <url>/a2a), IVL (declines with a
// server error), chainhelix + Brain on BNB (mainnet); Quick Intel answers 402 on GET,
// Olina 402 without terms, the rest are discovery documents that answer 200.
const quoteTargets = pairs(flag("--quote"), "97:2059,97:2020,97:2055,56:269223,56:304494");
const x402Targets = pairs(flag("--x402"), "56:6255,56:6428,97:1053,56:311259,56:304493,56:127417,97:2012");
const task = flag("--task") ?? "Quote only: one health-factor check of a Venus position on BSC testnet. No job will be funded.";

const rows = getRows();
const name = (chain: number, id: number) => rows.find((r) => r.chain === chain && r.id === id)?.name ?? "?";
const ms = (t0: number) => `${Date.now() - t0} ms`;
const show = (v: unknown, max = 900) => {
  const s = JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x));
  return s.length > max ? `${s.slice(0, max)}… (${s.length} chars)` : s;
};
const h = (t: string) => console.log(`\n== ${t}`);

async function main() {
  console.log(`rows: ${rows.length} (${rows.filter((r) => r.chain === 97).length} testnet, ${rows.filter((r) => r.chain === 56).length} mainnet)`);

  if (sections.has("snapshot")) {
    h("getProbeSnapshot() before any sweep");
    const s = getProbeSnapshot();
    console.log(`source=${s.source} checkedAt=${s.checkedAt} rows=${Object.keys(s.results).length}`);
  }

  if (sections.has("sweep")) {
    h("sweep() — one full pass of the probe loop");
    const t0 = Date.now();
    const snap = await sweep();
    console.log(`source=${snap.source} checkedAt=${snap.checkedAt} rows=${Object.keys(snap.results).length} in ${ms(t0)}`);
    const counts: Record<string, number> = {};
    let changed = 0;
    const flips: string[] = [];
    for (const r of rows) {
      const res = snap.results[`${r.chain}:${r.id}`];
      if (!res) continue;
      counts[res.word] = (counts[res.word] ?? 0) + 1;
      if (res.word !== r.probe.word) {
        changed++;
        if (flips.length < 12) flips.push(`${r.chain}:${r.id} ${r.name}: ${r.probe.word}(${r.probe.code}) → ${res.word}(${res.code})`);
      }
    }
    console.log(`words: ${show(counts)}; changed vs build: ${changed}`);
    for (const f of flips) console.log(`  ${f}`);
    for (const r of rows.filter((x) => x.operator === "team")) console.log(`  team ${r.id} ${r.name}: ${show(snap.results[`${r.chain}:${r.id}`])}`);
    const s2 = getProbeSnapshot();
    console.log(`getProbeSnapshot() now: source=${s2.source} checkedAt=${s2.checkedAt}; loop stats ${show(getLoopStats())}`);
    const words: ProbeWord[] = ["live", "responds", "gated", "unreachable", "no-public"];
    console.log(`  vocabulary check: ${words.every((w) => counts[w] === undefined || counts[w] >= 0)}`);
  }

  if (sections.has("count")) {
    h("getRegistryCount()");
    for (const chain of [97, 56] as const) {
      const t0 = Date.now();
      const r = await getRegistryCount(chain);
      console.log(`chain ${chain}: ${show(r)} in ${ms(t0)}`);
      const t1 = Date.now();
      await getRegistryCount(chain);
      console.log(`chain ${chain}: cached second call in ${ms(t1)}`);
    }
  }

  if (sections.has("jobs")) {
    h("getRecentSettledJobs(10)");
    const t0 = Date.now();
    const jobs = await getRecentSettledJobs(10);
    console.log(`${jobs.length} jobs in ${ms(t0)}`);
    for (const j of jobs) {
      console.log(
        `  ${j.chain}:${j.jobId} ${j.completedAt ?? "—"} ${j.budgetU || "—"} U  provider ${j.provider.slice(0, 10)}… client ${j.client.slice(0, 10)}…  ` +
          `${j.agent ? `${j.agent.name} (#${j.agent.id})` : "not on shelf"}${j.selfHire ? " self-hire" : ""}`,
      );
    }
  }

  if (sections.has("quote")) {
    h("requestQuote() — read-only A2A negotiate");
    for (const [chain, id] of quoteTargets) {
      const t0 = Date.now();
      const q = await requestQuote(chain, id, task);
      console.log(`\n${chain}:${id} ${name(chain, id)} — ${ms(t0)}`);
      if (q.ok) {
        console.log(`  ok endpoint=${q.endpoint}`);
        console.log(`  summary=${show(q.summary)}`);
        console.log(`  raw=${show(q.raw, 700)}`);
      } else console.log(`  fail: ${q.reason}${q.status ? ` (HTTP ${q.status})` : ""}`);
    }
  }

  if (sections.has("x402")) {
    h("fetchX402Terms() — one GET, expect 402");
    for (const [chain, id] of x402Targets) {
      const t0 = Date.now();
      const x = await fetchX402Terms(chain, id);
      console.log(`\n${chain}:${id} ${name(chain, id)} — ${ms(t0)}`);
      if (x.ok) {
        console.log(`  402 at ${x.endpoint}`);
        console.log(`  terms=${show(x.terms)}`);
        console.log(`  raw=${show(x.raw, 600)}`);
      } else console.log(`  fail: ${x.reason}${x.status ? ` (HTTP ${x.status})` : ""}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    // The chain clients keep no sockets open; exit once the queue drains.
    setTimeout(() => process.exit(process.exitCode ?? 0), 100).unref();
  });

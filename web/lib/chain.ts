// BSC reads behind the live counters: ERC-8004 registry size and the latest
// ERC-8183 jobs. Pure (no shelf import); caches live on globalThis so every
// server bundle shares them. Every public function has a hard time budget and
// degrades to the last good value or null.
import { createPublicClient, http, parseAbi, type Address, type PublicClient } from "viem";
import { bsc, bscTestnet } from "viem/chains";
import { IDENTITY_REGISTRY } from "./format";
import { withTimeout } from "./probe";
import type { Chain } from "./types";

export const RPC: Record<Chain, string> = {
  56: "https://bsc-rpc.publicnode.com",
  97: "https://bsc-testnet-rpc.publicnode.com",
};

/** ERC-8183 AgenticCommerce (BNB Agent Studio deployment). */
export const COMMERCE: Record<Chain, Address> = {
  56: "0xea4daa3100a767e86fded867729ae7446476eba6",
  97: "0xa206c0517b6371c6638cd9e4a42cc9f02a33b0de",
};

export const CHAIN_BUDGET_MS = 8_000;
const COUNT_TTL_MS = 60_000;
const JOBS_TTL_MS = 30_000;
const DECISION_TTL_MS = 10 * 60_000;
export const JOB_SPAN = 200;

/** ERC-8183 job.status. */
export const JOB_COMPLETED = 3;

const identityAbi = parseAbi(["function ownerOf(uint256 tokenId) view returns (address)"]);
const commerceAbi = parseAbi([
  "function jobCounter() view returns (uint256)",
  "function getJob(uint256 jobId) view returns ((uint256 id, address client, address provider, address evaluator, string description, uint256 budget, uint256 expiredAt, uint8 status, address hook, uint256 submittedAt, bytes32 deliverable))",
]);

export interface RegistryCount {
  count: number;
  block: number;
  at: string;
}

export interface RawJob {
  chain: Chain;
  id: number;
  client: string;
  provider: string;
  budget: bigint;
  expiredAt: number;
  status: number;
  submittedAt: number;
  description: string;
}

interface Cached<T> {
  value: T | null;
  fetchedAt: number;
  inflight: Promise<T | null> | null;
}

interface ChainStore {
  clients: Partial<Record<Chain, PublicClient>>;
  counts: Partial<Record<Chain, Cached<RegistryCount>>>;
  jobs: Partial<Record<Chain, Cached<RawJob[]>>>;
  /** Whether the commerce contract answered; false is re-tested after DECISION_TTL_MS. */
  commerceUp: Partial<Record<Chain, { ok: boolean; at: number }>>;
}

const KEY = Symbol.for("bnb-agent-marketplace.chain-store");

function store(): ChainStore {
  const g = globalThis as unknown as { [KEY]?: ChainStore };
  if (!g[KEY]) g[KEY] = { clients: {}, counts: {}, jobs: {}, commerceUp: {} };
  return g[KEY];
}

export function publicClient(chain: Chain): PublicClient {
  const s = store();
  let c = s.clients[chain];
  if (!c) {
    c = createPublicClient({
      chain: chain === 56 ? bsc : bscTestnet,
      transport: http(RPC[chain], { timeout: 6_000, retryCount: 1 }),
    }) as PublicClient;
    s.clients[chain] = c;
  }
  return c;
}

function cached<T>(slot: Partial<Record<Chain, Cached<T>>>, chain: Chain): Cached<T> {
  let c = slot[chain];
  if (!c) {
    c = { value: null, fetchedAt: 0, inflight: null };
    slot[chain] = c;
  }
  return c;
}

/**
 * TTL cache with in-flight dedupe and a hard time budget: a miss waits at
 * most `budgetMs`, then hands back the last good value (or null) while the
 * read keeps running in the background and lands for the next caller.
 */
async function through<T>(c: Cached<T>, ttlMs: number, budgetMs: number, read: () => Promise<T>): Promise<T | null> {
  const now = Date.now();
  if (c.value !== null && now - c.fetchedAt < ttlMs) return c.value;
  if (!c.inflight) {
    c.inflight = read()
      .then((v) => {
        c.value = v;
        c.fetchedAt = Date.now();
        return v;
      })
      .catch((e: unknown) => {
        console.warn(`[chain] read failed: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`);
        return c.value;
      })
      .finally(() => {
        c.inflight = null;
      });
  }
  return withTimeout(c.inflight, budgetMs, () => c.value);
}

// ---------------------------------------------------------------- registry size

async function existsMany(chain: Chain, ids: number[]): Promise<boolean[]> {
  if (ids.length === 0) return [];
  const registry = IDENTITY_REGISTRY[chain] as Address;
  const res = await publicClient(chain).multicall({
    contracts: ids.map((id) => ({ address: registry, abi: identityAbi, functionName: "ownerOf", args: [BigInt(id)] }) as const),
    allowFailure: true,
  });
  return res.map((r) => r.status === "success");
}

/**
 * Highest minted ERC-8004 id, found with a 16-ary search over ownerOf around
 * `hint` (the last known count): one multicall to bracket, then ~log16 rounds.
 * Ids are minted contiguously and never burned, so "exists" is monotone.
 */
export async function findMaxId(chain: Chain, hint: number): Promise<number> {
  const steps = [0, 64, 256, 1024, 4096, 16384, 65536, 262144];
  let lo = 0; // largest id known to exist
  let hi = Number.POSITIVE_INFINITY; // smallest id known not to exist
  let base = Math.max(1, Math.floor(hint));
  for (let round = 0; round < 3 && hi === Number.POSITIVE_INFINITY; round++) {
    const ids = steps.map((s) => base + s);
    const ex = await existsMany(chain, ids);
    if (round === 0 && !ex[0]) {
      hi = base; // the hint itself is gone from under us: search downward
      break;
    }
    ids.forEach((id, i) => {
      if (ex[i]) lo = Math.max(lo, id);
      else hi = Math.min(hi, id);
    });
    base = lo + steps[steps.length - 1];
  }
  if (hi === Number.POSITIVE_INFINITY) return lo;
  for (let round = 0; round < 8 && hi - lo > 1; round++) {
    const step = (hi - lo) / 16;
    const ids = Array.from(new Set(Array.from({ length: 15 }, (_, i) => Math.round(lo + step * (i + 1))))).filter(
      (id) => id > lo && id < hi,
    );
    if (ids.length === 0) break;
    const ex = await existsMany(chain, ids);
    ids.forEach((id, i) => {
      if (ex[i]) lo = Math.max(lo, id);
      else hi = Math.min(hi, id);
    });
  }
  return lo;
}

async function readRegistryCount(chain: Chain, hint: number): Promise<RegistryCount> {
  const client = publicClient(chain);
  const [count, block] = await Promise.all([findMaxId(chain, hint), client.getBlockNumber()]);
  return { count, block: Number(block), at: new Date().toISOString() };
}

/** Cached 60 s per chain; never blocks longer than the budget. */
export function getRegistryCountCached(chain: Chain, hint: number, budgetMs = CHAIN_BUDGET_MS): Promise<RegistryCount | null> {
  const c = cached(store().counts, chain);
  return through(c, COUNT_TTL_MS, budgetMs, () => readRegistryCount(chain, Math.max(hint, c.value?.count ?? 0)));
}

// ---------------------------------------------------------------- jobs

async function readRecentJobs(chain: Chain, span: number): Promise<RawJob[]> {
  const client = publicClient(chain);
  const address = COMMERCE[chain];
  const counter = Number(await client.readContract({ address, abi: commerceAbi, functionName: "jobCounter" }));
  if (!Number.isFinite(counter) || counter < 1) return [];
  const from = Math.max(1, counter - span + 1);
  const ids = Array.from({ length: counter - from + 1 }, (_, i) => BigInt(from + i));
  const res = await client.multicall({
    contracts: ids.map((id) => ({ address, abi: commerceAbi, functionName: "getJob", args: [id] }) as const),
    allowFailure: true,
    batchSize: 2048,
  });
  const out: RawJob[] = [];
  res.forEach((r) => {
    if (r.status !== "success") return;
    const j = r.result;
    out.push({
      chain,
      id: Number(j.id),
      client: j.client.toLowerCase(),
      provider: j.provider.toLowerCase(),
      budget: j.budget,
      expiredAt: Number(j.expiredAt),
      status: Number(j.status),
      submittedAt: Number(j.submittedAt),
      description: j.description,
    });
  });
  return out;
}

/** Does the commerce contract answer on this chain? Cached; a `false` is re-tested after 10 min. */
export async function commerceResponds(chain: Chain): Promise<boolean> {
  const s = store();
  const d = s.commerceUp[chain];
  if (d && (d.ok || Date.now() - d.at < DECISION_TTL_MS)) return d.ok;
  let ok = false;
  try {
    const n = await publicClient(chain).readContract({ address: COMMERCE[chain], abi: commerceAbi, functionName: "jobCounter" });
    ok = typeof n === "bigint";
  } catch {
    ok = false;
  }
  s.commerceUp[chain] = { ok, at: Date.now() };
  return ok;
}

/** Latest `span` jobs on a chain, COMPLETED only, cached 30 s. Null when nothing has ever loaded. */
export function getCompletedJobsCached(chain: Chain, span = JOB_SPAN, budgetMs = CHAIN_BUDGET_MS): Promise<RawJob[] | null> {
  const c = cached(store().jobs, chain);
  return through(c, JOBS_TTL_MS, budgetMs, async () => {
    if (!(await commerceResponds(chain))) throw new Error(`commerce contract on chain ${chain} did not answer`);
    const jobs = await readRecentJobs(chain, span);
    return jobs.filter((j) => j.status === JOB_COMPLETED);
  });
}

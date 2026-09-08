// In-site quote request: read the agent card, confirm a `negotiate` skill,
// POST one A2A `message/send` and lift the signed quote out of the reply.
// Read-only — a quote is not a job; nothing is signed or funded here. Pure
// (no shelf import): callers pass the row's endpoint / card fields.
import {
  BODY_CAP,
  CALL_TIMEOUT_MS,
  errorName,
  fetchManual,
  parseJson,
  readCapped,
  safeUrl,
  sameHost,
} from "./probe";
import type { QuoteResult } from "./types";
import { humanAmount } from "./x402";

export interface QuoteSource {
  endpoint: string;
  cardUrl?: string | null;
  /** Where the build fetched the agent card (row.doc.url). */
  docUrl?: string | null;
  /** Build-time card text (row.doc.raw), used only when the live card cannot be read. */
  docRaw?: string | null;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

const CARD_PATH = /\/(agent-card|agent)\.json$/i;
const WELL_KNOWN = "/.well-known/agent-card.json";

/** Card URLs to try, most specific first, deduped and filtered by safeUrl. */
export function cardCandidates(src: QuoteSource): string[] {
  const out: string[] = [];
  const push = (u: string | null | undefined) => {
    const s = safeUrl(u);
    if (s && !out.includes(s.toString())) out.push(s.toString());
  };
  push(src.cardUrl);
  push(src.docUrl);
  const ep = safeUrl(src.endpoint);
  if (ep) {
    if (CARD_PATH.test(ep.pathname)) push(ep.toString());
    const dir = ep.pathname.replace(/\/+$/, "");
    if (dir && !CARD_PATH.test(dir)) push(ep.origin + dir + WELL_KNOWN);
    push(ep.origin + WELL_KNOWN);
    push(ep.origin + "/.well-known/agent.json");
  }
  return out;
}

export interface CardSkill {
  id?: string;
  name?: string;
  description?: string;
  tags: string[];
}

export function skillsOf(card: unknown): CardSkill[] {
  if (!isObj(card)) return [];
  const raw = Array.isArray(card.skills)
    ? card.skills
    : isObj(card.capabilities) && Array.isArray(card.capabilities.skills)
      ? card.capabilities.skills
      : [];
  return raw.flatMap((s): CardSkill[] => {
    if (typeof s === "string") return [{ name: s, tags: [] }];
    if (!isObj(s)) return [];
    const tags = Array.isArray(s.tags) ? s.tags.filter((t): t is string => typeof t === "string") : [];
    return [{ id: str(s.id), name: str(s.name), description: str(s.description), tags }];
  });
}

export function negotiateSkill(skills: CardSkill[]): CardSkill | undefined {
  const hit = (v: string | undefined) => !!v && /negotiat/i.test(v);
  return skills.find((s) => hit(s.id) || hit(s.name) || s.tags.some(hit));
}

/** Prefer https on the card's host; move a foreign or private host onto the card's origin. */
function rehome(candidate: URL, cardUrl: URL): URL {
  let u = candidate;
  if (!sameHost(u, cardUrl)) u = new URL(u.pathname + u.search, cardUrl.origin);
  if (u.protocol === "http:" && cardUrl.protocol === "https:") u = new URL(u.toString().replace(/^http:/, "https:"));
  return u;
}

/** The JSON-RPC URL an A2A card points at, or a sensible base when it names none. */
export function postUrlOf(card: unknown, cardUrl: URL, endpoint: string): URL | null {
  const raw: string[] = [];
  if (isObj(card)) {
    if (str(card.url)) raw.push(card.url as string);
    for (const key of ["supportedInterfaces", "additionalInterfaces"] as const) {
      const list = card[key];
      if (!Array.isArray(list)) continue;
      for (const it of list) {
        if (!isObj(it)) continue;
        const binding = `${str(it.protocolBinding) ?? ""} ${str(it.transport) ?? ""}`.toLowerCase();
        if (str(it.url) && (binding.includes("jsonrpc") || binding.trim() === "")) raw.push(it.url as string);
      }
    }
    if (str(card.endpoint) && /^https?:\/\//i.test(card.endpoint as string)) raw.push(card.endpoint as string);
  }
  for (const r of raw) {
    let u: URL;
    try {
      u = new URL(r);
    } catch {
      continue;
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") continue;
    const homed = safeUrl(rehome(u, cardUrl).toString());
    if (homed) return homed;
  }
  // No usable url on the card: an endpoint that is not itself a card is the
  // JSON-RPC target; otherwise strip the well-known suffix from the card URL.
  const ep = safeUrl(endpoint);
  if (ep && !CARD_PATH.test(ep.pathname)) return ep;
  return safeUrl(cardUrl.toString().replace(/\/\.well-known\/(agent-card|agent)\.json$/i, "/"));
}

export type CardFetch =
  | { ok: true; url: URL; card: Obj; source: "live" | "build" }
  | { ok: false; reason: string; status?: number };

/** GET the first candidate that answers with a JSON object; build-time card as a last resort. */
export async function fetchCard(src: QuoteSource): Promise<CardFetch> {
  let lastStatus: number | undefined;
  let lastError = "no card URL";
  for (const c of cardCandidates(src)) {
    const url = safeUrl(c);
    if (!url) continue;
    try {
      const res = await fetchManual(url, {
        method: "GET",
        headers: { accept: "application/json" },
        timeoutMs: CALL_TIMEOUT_MS,
      });
      const body = await readCapped(res, BODY_CAP);
      lastStatus = res.status;
      if (res.status < 200 || res.status >= 300) {
        lastError = `HTTP ${res.status}`;
        continue;
      }
      const json = parseJson(body.text);
      if (isObj(json)) return { ok: true, url, card: json, source: "live" };
      lastError = "card is not a JSON object";
    } catch (e) {
      lastError = errorName(e);
    }
  }
  const built = src.docRaw ? parseJson(src.docRaw) : undefined;
  const first = cardCandidates(src)[0];
  if (isObj(built) && first && skillsOf(built).length) {
    return { ok: true, url: new URL(first), card: built, source: "build" };
  }
  return { ok: false, reason: `Agent card unavailable (${lastError})`, status: lastStatus };
}

// ---------------------------------------------------------------- message/send

export interface NegotiatePayload {
  skill: "negotiate";
  task_description: string;
  terms: Record<string, string>;
}

/** The data-part shape the Studio agents document: both `terms` keys are required by them. */
export function negotiatePayload(task: string): NegotiatePayload {
  return {
    skill: "negotiate",
    task_description: task,
    terms: { deliverables: task, quality_standards: "as described by the agent card" },
  };
}

export function buildMessage(task: string, variant: "data" | "text", rpcId: string): Obj {
  const payload = negotiatePayload(task);
  const part = variant === "data" ? { kind: "data", data: payload } : { kind: "text", text: JSON.stringify(payload) };
  return {
    jsonrpc: "2.0",
    id: rpcId,
    method: "message/send",
    params: { message: { role: "user", messageId: crypto.randomUUID(), kind: "message", parts: [part] } },
  };
}

type Summary = Extract<QuoteResult, { ok: true }>["summary"];

const KEYS = {
  price: ["price", "budget", "amount", "quote_price", "quotePrice", "price_wei", "budget_wei", "total"],
  token: ["token", "currency", "asset", "payment_token", "paymentToken", "symbol"],
  expiresAt: [
    "quote_expires_at",
    "quoteExpiresAt",
    "expires_at",
    "expiresAt",
    "expires",
    "expiry",
    "expiredAt",
    "expired_at",
    "valid_until",
    "validUntil",
    "deadline",
  ],
  provider: ["provider", "provider_address", "providerAddress", "seller", "payee", "wallet"],
  signature: ["provider_sig", "providerSig", "signature", "sig", "provider_signature"],
} as const;
const EXTRA = ["negotiation_hash", "negotiationHash", "quote_id", "quoteId", "job_id", "jobId", "nonce", "chain_id", "chainId", "deliverables", "quality_standards"];

function scalar(v: unknown): string | undefined {
  if (typeof v === "string") return v.trim() || undefined;
  if (typeof v === "number" || typeof v === "bigint" || typeof v === "boolean") return String(v);
  return undefined;
}

function isoFrom(v: string): string {
  if (/^\d+$/.test(v)) {
    const n = Number(v);
    const ms = n > 1e12 ? n : n * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? v : d.toISOString();
  }
  return v;
}

/** Objects that may carry the quote, most likely first: artifact data parts, status message parts, everything else. */
function quoteObjects(result: unknown): Obj[] {
  const out: Obj[] = [];
  const seen = new Set<unknown>();
  const addParts = (parts: unknown) => {
    if (!Array.isArray(parts)) return;
    for (const p of parts) {
      if (!isObj(p)) continue;
      if (isObj(p.data)) out.push(p.data);
      const text = str(p.text);
      if (text) {
        const j = parseJson(text);
        if (isObj(j)) out.push(j);
      }
    }
  };
  if (isObj(result)) {
    if (Array.isArray(result.artifacts)) for (const a of result.artifacts) if (isObj(a)) addParts(a.parts);
    if (isObj(result.status) && isObj(result.status.message)) addParts(result.status.message.parts);
    addParts(result.parts);
    out.push(result);
  }
  return out.filter((o) => (seen.has(o) ? false : (seen.add(o), true)));
}

function find(o: unknown, keys: readonly string[], depth = 0): unknown {
  if (depth > 8 || o === null || typeof o !== "object") return undefined;
  if (Array.isArray(o)) {
    for (const it of o) {
      const v = find(it, keys, depth + 1);
      if (v !== undefined) return v;
    }
    return undefined;
  }
  const obj = o as Obj;
  for (const k of keys) if (k in obj && obj[k] !== null && obj[k] !== undefined) return obj[k];
  for (const [k, v] of Object.entries(obj)) {
    if (k === "history") continue;
    const hit = find(v, keys, depth + 1);
    if (hit !== undefined) return hit;
  }
  return undefined;
}

/** Best-effort lift of price / token / expiry / provider / signature from wherever the agent put them. */
export function summarise(result: unknown): Summary {
  const summary: Summary = {};
  const terms: Record<string, unknown> = {};
  for (const o of quoteObjects(result)) {
    if (summary.price === undefined) {
      const p = find(o, KEYS.price);
      if (isObj(p)) {
        summary.price = scalar(p.amount ?? p.value ?? p.price);
        summary.token ??= scalar(p.currency ?? p.token ?? p.asset ?? p.symbol);
      } else summary.price = scalar(p);
    }
    summary.token ??= scalar(find(o, KEYS.token));
    if (summary.expiresAt === undefined) {
      const e = scalar(find(o, KEYS.expiresAt));
      if (e) summary.expiresAt = isoFrom(e);
    }
    summary.provider ??= scalar(find(o, KEYS.provider));
    summary.signature ??= scalar(find(o, KEYS.signature));
    for (const k of EXTRA) {
      const v = find(o, [k]);
      const s = scalar(v);
      if (s !== undefined && !(k in terms)) terms[k] = s;
    }
  }
  // Atomic units of a known token read as human units; the raw pair stays in terms.
  if (summary.price && /^\d+$/.test(summary.price) && summary.token) {
    const human = humanAmount(summary.price, summary.token, terms.chain_id !== undefined ? `eip155:${terms.chain_id}` : undefined);
    if (human.amount && human.amount !== summary.price) {
      terms.price_raw = summary.price;
      if (/^0x[0-9a-f]{40}$/i.test(summary.token)) terms.token_address = summary.token;
      summary.price = human.amount;
      summary.token = human.asset ?? summary.token;
    }
  }
  if (Object.keys(terms).length) summary.terms = terms;
  return summary;
}

/** Agents that answer 200 with `{ error: "…" }` in a data part declined rather than quoted. */
function declined(result: unknown): string | undefined {
  for (const o of quoteObjects(result)) {
    if (typeof o.error === "string" && o.error.trim()) return o.error.trim();
    if (isObj(o.error) && typeof o.error.message === "string") return o.error.message;
  }
  return undefined;
}

async function send(postUrl: URL, task: string, variant: "data" | "text"): Promise<
  { kind: "result"; result: unknown; status: number } | { kind: "rpc-error"; message: string; status: number } | { kind: "fail"; reason: string; status?: number }
> {
  const rpcId = crypto.randomUUID();
  try {
    const res = await fetchManual(postUrl, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify(buildMessage(task, variant, rpcId)),
      timeoutMs: CALL_TIMEOUT_MS,
    });
    const body = await readCapped(res, BODY_CAP);
    const json = parseJson(body.text);
    if (isObj(json) && isObj(json.error)) {
      const m = str(json.error.message) ?? `code ${scalar(json.error.code) ?? "?"}`;
      return { kind: "rpc-error", message: m, status: res.status };
    }
    if (res.status >= 400) return { kind: "fail", reason: `HTTP ${res.status}`, status: res.status };
    if (json === undefined) return { kind: "fail", reason: body.truncated ? "Reply larger than 64 KB" : "Reply is not JSON", status: res.status };
    // JSON-RPC result, or a bare payload from agents that skip the envelope.
    const result = isObj(json) && "result" in json ? json.result : json;
    const no = declined(result);
    if (no !== undefined && summarise(result).price === undefined) return { kind: "rpc-error", message: no, status: res.status };
    return { kind: "result", result, status: res.status };
  } catch (e) {
    return { kind: "fail", reason: `Endpoint unreachable (${errorName(e)})` };
  }
}

// ------------------------------------------------------------------- REST negotiate

// Some ERC-8183 runtimes serve no agent card at all and expose a plain REST
// route instead: POST <base>/negotiate with the task, receive an envelope whose
// `response.terms` carries the price and whose top level carries the signed
// negotiation hash. Verified 2026-09-06 against the reference runtimes at
// 103-195-188-198.sslip.io and ammlabs.fun; the five funded jobs in
// the hire artefacts were all quoted this way.
const REST_HINT = /(^|\/)erc-?8183(\/|$)/i;

/** `<endpoint>/negotiate`, plus `<origin>/erc8183/negotiate` when the path does not already say so. */
function restNegotiateUrls(endpoint: string): URL[] {
  const out: URL[] = [];
  const push = (u: string) => {
    const s = safeUrl(u);
    if (s && !out.some((o) => o.toString() === s.toString())) out.push(s);
  };
  const base = endpoint.replace(/\/+$/, "");
  push(`${base}/negotiate`);
  try {
    const u = new URL(endpoint);
    if (!REST_HINT.test(u.pathname)) push(`${u.origin}/erc8183/negotiate`);
  } catch {
    /* endpoint already rejected by safeUrl */
  }
  return out;
}

type RestReply =
  | { kind: "result"; result: unknown }
  | { kind: "declined"; reason: string; status: number }
  | { kind: "fail"; reason: string; status?: number };

async function restNegotiate(url: URL, task: string): Promise<RestReply> {
  // Both terms keys are required by these runtimes; omitting either is refused
  // with reason_code 0x04 naming the missing field.
  const body = JSON.stringify({
    task_description: task,
    terms: { deliverables: task, quality_standards: "as described by the agent card" },
  });
  try {
    const res = await fetchManual(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body,
      timeoutMs: CALL_TIMEOUT_MS,
    });
    const read = await readCapped(res, BODY_CAP);
    const json = parseJson(read.text);
    if (json === undefined)
      return { kind: "fail", reason: read.truncated ? "Reply larger than 64 KB" : "Reply is not JSON", status: res.status };
    if (res.status >= 400) return { kind: "fail", reason: `HTTP ${res.status}`, status: res.status };
    const envelope = isObj(json) ? json : {};
    const reply = isObj(envelope.response) ? envelope.response : {};
    if (reply.accepted === false) {
      const why = str(reply.reason) ?? str(reply.reason_code) ?? "no reason given";
      return { kind: "declined", reason: why, status: res.status };
    }
    if (!isObj(reply.terms) || !str(reply.terms.price)) return { kind: "fail", reason: "Reply carries no price", status: res.status };
    return { kind: "result", result: json };
  } catch (e) {
    return { kind: "fail", reason: `Endpoint unreachable (${errorName(e)})` };
  }
}

/** Try the REST route; undefined means "no REST route here, keep going". */
async function tryRest(src: QuoteSource, task: string): Promise<QuoteResult | undefined> {
  let declined: { reason: string; status: number } | undefined;
  for (const url of restNegotiateUrls(src.endpoint)) {
    const r = await restNegotiate(url, task);
    if (r.kind === "result")
      return {
        ok: true,
        rail: "erc8183",
        fetchedAt: new Date().toISOString(),
        endpoint: url.toString(),
        summary: summarise(r.result),
        raw: r.result,
      };
    if (r.kind === "declined") declined ??= { reason: r.reason, status: r.status };
  }
  return declined ? { ok: false, reason: `Agent declined: ${declined.reason}`, status: declined.status } : undefined;
}

/** The whole flow: card → negotiate skill → message/send (data part, then text part). */
export async function requestQuoteFor(src: QuoteSource, task: string): Promise<QuoteResult> {
  const clean = task.trim().slice(0, 2000);
  if (!clean) return { ok: false, reason: "Describe the task first" };
  // An endpoint that already names erc8183 is a REST runtime: one POST settles it
  // in ~140 ms, against three or four requests to discover a card that is not there.
  let restPath = false;
  try {
    restPath = REST_HINT.test(new URL(src.endpoint).pathname);
  } catch {
    /* safeUrl rejects it below */
  }
  if (restPath) {
    const early = await tryRest(src, clean);
    if (early) return early;
  }
  const card = await fetchCard(src);
  if (!card.ok) {
    const late = await tryRest(src, clean);
    return late ?? card;
  }
  const skill = negotiateSkill(skillsOf(card.card));
  if (!skill) {
    const late = await tryRest(src, clean);
    return late ?? { ok: false, reason: "Agent card declares no negotiate skill" };
  }
  const primary = postUrlOf(card.card, card.url, src.endpoint);
  if (!primary) return { ok: false, reason: "Agent card names no reachable JSON-RPC URL" };
  // Some cards name their base URL and serve JSON-RPC at `<base>/a2a`; one extra try on 404/405.
  const urls: URL[] = [primary];
  if (!/\/a2a\/?$/i.test(primary.pathname)) {
    const alt = safeUrl(primary.origin + primary.pathname.replace(/\/+$/, "") + "/a2a" + primary.search);
    if (alt) urls.push(alt);
  }

  let declinedFirst: { message: string; status: number } | null = null;
  let failure: { reason: string; status?: number } | null = null;
  for (const postUrl of urls) {
    let routeMissing = false;
    for (const variant of ["data", "text"] as const) {
      const r = await send(postUrl, clean, variant);
      if (r.kind === "result") {
        return {
          ok: true,
          rail: "erc8183",
          fetchedAt: new Date().toISOString(),
          endpoint: postUrl.toString(),
          summary: summarise(r.result),
          raw: r.result,
        };
      }
      if (r.kind === "rpc-error") {
        declinedFirst ??= { message: r.message, status: r.status };
        continue;
      }
      failure = { reason: r.reason, status: r.status };
      routeMissing = r.status === 404 || r.status === 405;
      break;
    }
    if (!routeMissing && (declinedFirst || failure)) break;
  }
  if (declinedFirst) return { ok: false, reason: `Agent declined: ${declinedFirst.message}`, status: declinedFirst.status };
  const late = await tryRest(src, clean);
  if (late) return late;
  return failure ? { ok: false, ...failure } : { ok: false, reason: "No reply" };
}

// Network primitives shared by the probe loop, the quote and the 402 readers.
// Pure: no shelf import, no server-only marker, so a tsx smoke test can drive
// them with real rows. Every outbound request goes through safeUrl() and
// fetchManual(): http(s) only, no IP literals / localhost / .local / .internal,
// the hostname is resolved first and refused when any answer is a non-public
// address, the socket is pinned to the vetted address, redirects are followed
// only on the same host and port, bodies capped. Node runtime only.
import { lookup } from "node:dns/promises";
import { request as httpRequest, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";
import { Readable, pipeline } from "node:stream";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import type { ProbeResult, ProbeWord } from "./types";

export const PROBE_TIMEOUT_MS = 5_000;
export const CALL_TIMEOUT_MS = 8_000;
export const BODY_CAP = 64 * 1024;
export const PROBE_CONCURRENCY = 8;
export const USER_AGENT = "bnb-agent-marketplace/1.0 (+https://github.com/harryyyym/bnb-agent-trade)";

/** The host answered but wants a different request (auth, method, params, Accept, rate limit). */
export const GATED = new Set([400, 401, 402, 403, 405, 406, 415, 422, 429]);

/** Same fallback paths the build used when the endpoint itself answered 404/410. */
export const FALLBACK_PATHS = ["/.well-known/agent-card.json", "/health", "/healthz"] as const;

export function wordFor(code: number | null): ProbeWord {
  if (code === null) return "unreachable";
  if (code < 400) return "responds";
  return GATED.has(code) ? "gated" : "unreachable";
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/** http(s) URL with a public-looking hostname, or null. Never throws. */
export function safeUrl(input: string | null | undefined): URL | null {
  if (!input || typeof input !== "string") return null;
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase();
  if (!host) return null;
  if (host === "localhost" || host.endsWith(".localhost")) return null;
  if (host.endsWith(".local") || host.endsWith(".internal")) return null;
  if (IPV4.test(host)) return null;
  if (host.startsWith("[") || host.includes(":")) return null; // IPv6 literal
  if (u.username || u.password) return null;
  return u;
}

/** Same hostname; a leading `www.` is not a different host. */
export function sameHost(a: URL, b: URL): boolean {
  const norm = (u: URL) => u.hostname.toLowerCase().replace(/^www\./, "");
  return norm(a) === norm(b);
}

const effectivePort = (u: URL) => Number(u.port) || (u.protocol === "https:" ? 443 : 80);

/**
 * A redirect may stay on the same host and port, or upgrade plain http on 80
 * to https on 443 — never hop to another service on the same box.
 */
export function redirectAllowed(from: URL, to: URL): boolean {
  if (!sameHost(from, to)) return false;
  const pf = effectivePort(from);
  const pt = effectivePort(to);
  return pf === pt || (from.protocol === "http:" && pf === 80 && to.protocol === "https:" && pt === 443);
}

// ---------------------------------------------------------------- addresses

/**
 * Addresses no listed endpoint may resolve to: unspecified, loopback, RFC 1918,
 * link-local (cloud metadata), CGNAT, multicast, reserved and documentation
 * ranges, plus the IPv6 equivalents and the transition prefixes that embed an
 * IPv4 address. BlockList matches IPv4-mapped IPv6 against the IPv4 rules.
 * 198.18/15 (RFC 2544) stays open: fake-IP DNS proxies on developer machines
 * answer every name from it, and nothing internal listens there.
 */
const PRIVATE = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  PRIVATE.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8],
] as const) {
  PRIVATE.addSubnet(net, prefix, "ipv6");
}

/** True for a routable public unicast address, v4 or v6. */
export function isPublicAddress(address: string): boolean {
  const fam = isIP(address);
  if (fam === 0) return false;
  return !PRIVATE.check(address, fam === 4 ? "ipv4" : "ipv6");
}

export class PrivateAddress extends Error {
  constructor(
    public readonly host: string,
    public readonly address: string,
  ) {
    super(`${host} resolves to a non-public address`);
    this.name = "PrivateAddress";
  }
}

export interface Resolved {
  address: string;
  family: 4 | 6;
}

const LOOKUP_TTL_MS = 60_000;
const LOOKUPS = new Map<string, { at: number; value: Promise<Resolved> }>();

/**
 * Resolves a hostname and refuses it when any answer is non-public (nip.io,
 * localtest.me, operator DNS pointing at the box). Successful lookups are
 * cached for a minute so a sweep resolves each host once; failures are not.
 * The caller connects to the returned address, never to the name again.
 */
export async function resolvePublic(hostname: string): Promise<Resolved> {
  const host = hostname.toLowerCase();
  const literal = isIP(host);
  if (literal) {
    if (!isPublicAddress(host)) throw new PrivateAddress(host, host);
    return { address: host, family: literal === 6 ? 6 : 4 };
  }
  const now = Date.now();
  const hit = LOOKUPS.get(host);
  if (hit && now - hit.at < LOOKUP_TTL_MS) return hit.value;
  if (LOOKUPS.size > 2000) LOOKUPS.clear();
  const value = (async (): Promise<Resolved> => {
    const answers = await lookup(host, { all: true });
    if (answers.length === 0) throw new PrivateAddress(host, "none");
    for (const a of answers) if (!isPublicAddress(a.address)) throw new PrivateAddress(host, a.address);
    const pick = answers.find((a) => a.family === 4) ?? answers[0];
    return { address: pick.address, family: pick.family === 6 ? 6 : 4 };
  })();
  LOOKUPS.set(host, { at: now, value });
  value.catch(() => LOOKUPS.delete(host));
  return value;
}

export class CrossHostRedirect extends Error {
  constructor(
    public readonly status: number,
    public readonly location: string,
  ) {
    super(`redirect to another host (${status})`);
    this.name = "CrossHostRedirect";
  }
}

export interface ManualInit {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  maxRedirects?: number;
}

const REDIRECT = new Set([301, 302, 303, 307, 308]);

function timeoutError(): Error {
  const e = new Error("timeout");
  e.name = "TimeoutError";
  return e;
}

/** Bodies are requested uncompressed; a server that compresses anyway is decoded here. */
function decodedBody(res: IncomingMessage): Readable {
  const enc = String(res.headers["content-encoding"] ?? "").toLowerCase();
  const inflate =
    enc === "gzip" || enc === "x-gzip"
      ? createGunzip()
      : enc === "deflate"
        ? createInflate()
        : enc === "br"
          ? createBrotliDecompress()
          : null;
  // pipeline destroys the socket when the consumer cancels the decoded stream.
  return inflate ? pipeline(res, inflate, () => {}) : res;
}

/**
 * One HTTP/1.1 request to a vetted address. The URL's hostname still drives
 * SNI, the certificate check and the Host header; only the socket goes to the
 * pinned address, so a DNS answer cannot change between the check and the
 * connect. Returns a fetch-style Response whose body is left unread.
 */
function requestPinned(
  url: URL,
  init: { method: string; headers: Record<string, string>; body?: string; timeoutMs: number },
  to: Resolved,
): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    const request = url.protocol === "https:" ? httpsRequest : httpRequest;
    const req = request(url, {
      method: init.method,
      headers: init.headers,
      agent: false,
      lookup: (_host, options, cb) => (options.all ? cb(null, [to]) : cb(null, to.address, to.family)),
      // Socket idle timeout: also covers a body that stalls after the headers.
      timeout: init.timeoutMs,
    });
    const timer = setTimeout(() => req.destroy(timeoutError()), init.timeoutMs);
    req.on("timeout", () => req.destroy(timeoutError()));
    req.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    req.on("response", (res) => {
      clearTimeout(timer);
      const status = res.statusCode ?? 0;
      if (status < 200 || status > 599) {
        res.destroy();
        reject(new Error(`status ${status}`));
        return;
      }
      const headers = new Headers();
      for (const [k, v] of Object.entries(res.headers)) {
        if (v === undefined) continue;
        try {
          headers.set(k, Array.isArray(v) ? v.join(", ") : v);
        } catch {
          /* skip a header the fetch API refuses */
        }
      }
      const body = Readable.toWeb(decodedBody(res)) as unknown as ReadableStream;
      resolve(new Response(body, { status, statusText: res.statusMessage ?? "", headers }));
    });
    if (init.body !== undefined) req.write(init.body);
    req.end();
  });
}

/**
 * fetch-shaped request with manual redirects: every hop resolves the host,
 * refuses non-public answers and connects to the vetted address. Same-host,
 * same-port redirects are followed by hand (up to maxRedirects, default 3); a
 * redirect elsewhere throws CrossHostRedirect. The body is left unread.
 */
export async function fetchManual(url: URL, init: ManualInit = {}): Promise<Response> {
  let current = url;
  let method = init.method ?? "GET";
  let body = init.body;
  const hops = init.maxRedirects ?? 3;
  const timeoutMs = init.timeoutMs ?? PROBE_TIMEOUT_MS;
  for (let hop = 0; ; hop++) {
    const to = await resolvePublic(current.hostname);
    const headers: Record<string, string> = {
      "user-agent": USER_AGENT,
      "accept-encoding": "identity",
      ...(init.headers ?? {}),
    };
    if (body !== undefined && !("content-length" in headers)) headers["content-length"] = String(Buffer.byteLength(body));
    const res = await requestPinned(current, { method, headers, body, timeoutMs }, to);
    if (!REDIRECT.has(res.status)) return res;
    const loc = res.headers.get("location");
    await discard(res);
    if (!loc || hop >= hops) return res;
    let next: URL;
    try {
      next = new URL(loc, current);
    } catch {
      return res;
    }
    const safe = safeUrl(next.toString());
    if (!safe || !redirectAllowed(url, safe)) throw new CrossHostRedirect(res.status, safe ? safe.hostname : "invalid");
    if (res.status === 303 || ((res.status === 301 || res.status === 302) && method === "POST")) {
      method = "GET";
      body = undefined;
    }
    current = safe;
  }
}

export async function discard(res: Response): Promise<void> {
  try {
    await res.body?.cancel();
  } catch {
    /* ignore */
  }
}

export interface CappedBody {
  text: string;
  truncated: boolean;
}

/** Reads at most `cap` bytes of the body, then aborts the stream. */
export async function readCapped(res: Response, cap = BODY_CAP): Promise<CappedBody> {
  const reader = res.body?.getReader();
  if (!reader) return { text: "", truncated: false };
  const chunks: Uint8Array[] = [];
  let size = 0;
  let truncated = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      if (size + value.byteLength > cap) {
        chunks.push(value.subarray(0, cap - size));
        size = cap;
        truncated = true;
        break;
      }
      chunks.push(value);
      size += value.byteLength;
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
  }
  const joined = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) {
    joined.set(c, off);
    off += c.byteLength;
  }
  return { text: new TextDecoder("utf-8", { fatal: false }).decode(joined), truncated };
}

export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

export function errorName(e: unknown): string {
  if (e instanceof CrossHostRedirect) return "cross-host redirect";
  if (e instanceof PrivateAddress) return "non-public address";
  if (e instanceof Error) {
    if (e.name === "TimeoutError" || e.name === "AbortError") return "timeout";
    const { code, cause } = e as { code?: string; cause?: { code?: string } };
    return code ?? cause?.code ?? e.name;
  }
  return "error";
}

/** Bounded-concurrency map, order preserved; fn must not throw. */
export async function pool<T, R>(items: readonly T[], size: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

export function withTimeout<T>(p: Promise<T>, ms: number, onTimeout: () => T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const t = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(onTimeout()), ms);
  });
  return Promise.race([p, t]).finally(() => clearTimeout(timer));
}

// ---------------------------------------------------------------- probes

/** `blocked`: the host only redirected elsewhere — recorded with its 3xx code, read as unreachable. */
type Hit = { status: number; latencyMs: number; blocked?: boolean } | { error: string };

async function head(url: URL, timeoutMs: number): Promise<Hit> {
  const t0 = Date.now();
  try {
    const res = await fetchManual(url, { method: "GET", headers: { accept: "application/json, */*;q=0.5" }, timeoutMs });
    await discard(res);
    if (REDIRECT.has(res.status)) return { status: res.status, latencyMs: Date.now() - t0, blocked: true };
    return { status: res.status, latencyMs: Date.now() - t0 };
  } catch (e) {
    if (e instanceof CrossHostRedirect) return { status: e.status, latencyMs: Date.now() - t0, blocked: true };
    return { error: errorName(e) };
  }
}

const accepted = (h: Hit): h is { status: number; latencyMs: number } =>
  "status" in h && !h.blocked && (h.status < 400 || GATED.has(h.status));

/**
 * One GET against the endpoint with the build's path logic: the fallback path
 * that answered last time first, then the endpoint itself, then the well-known
 * fallbacks when the endpoint answers 404/410. Never throws.
 */
export async function probeEndpoint(
  endpoint: string,
  opts: { path?: string | null; timeoutMs?: number } = {},
): Promise<ProbeResult> {
  const checkedAt = new Date().toISOString();
  const timeoutMs = opts.timeoutMs ?? PROBE_TIMEOUT_MS;
  const base = safeUrl(endpoint);
  if (!base) return { word: "unreachable", code: null, latencyMs: null, checkedAt };
  const tried = new Set<string>();
  const at = async (u: URL) => {
    tried.add(u.toString());
    return head(u, timeoutMs);
  };
  const done = (h: { status: number; latencyMs: number; blocked?: boolean }, path?: string): ProbeResult => ({
    word: h.blocked ? "unreachable" : wordFor(h.status),
    code: h.status,
    latencyMs: h.latencyMs,
    checkedAt,
    ...(path ? { path } : {}),
  });

  if (opts.path) {
    const u = safeUrl(base.origin + opts.path);
    if (u) {
      const h = await at(u);
      if (accepted(h)) return done(h, opts.path);
    }
  }
  const main = await at(base);
  if ("status" in main && main.blocked) return done(main);
  if ("status" in main && main.status !== 404 && main.status !== 410) return done(main);
  if ("status" in main) {
    for (const p of FALLBACK_PATHS) {
      const u = safeUrl(base.origin + p);
      if (!u || tried.has(u.toString())) continue;
      const h = await at(u);
      if (accepted(h)) return done(h, p);
    }
    return done(main);
  }
  return { word: "unreachable", code: null, latencyMs: null, checkedAt };
}

/** Our own health endpoints: 2xx means `live`; anything else reads like a third-party probe. */
export async function probeStatusUrl(statusUrl: string, timeoutMs = PROBE_TIMEOUT_MS): Promise<ProbeResult> {
  const checkedAt = new Date().toISOString();
  const u = safeUrl(statusUrl);
  if (!u) return { word: "unreachable", code: null, latencyMs: null, checkedAt };
  const h = await head(u, timeoutMs);
  if ("error" in h) return { word: "unreachable", code: null, latencyMs: null, checkedAt };
  return {
    word: h.blocked ? "unreachable" : h.status >= 200 && h.status < 300 ? "live" : wordFor(h.status),
    code: h.status,
    latencyMs: h.latencyMs,
    checkedAt,
  };
}

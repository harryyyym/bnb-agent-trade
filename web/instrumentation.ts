// Server start hook: begins the 5-minute endpoint probe loop (docs/marketplace/design.md §5,
// status freshness) and warms the two chain reads the landing awaits. Node
// runtime only; never during `next build`; the loop itself is guarded by a
// globalThis symbol so HMR and duplicate bundles cannot start it twice. Set
// PROBE_LOOP=off to run the site on build-time results.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.PROBE_LOOP === "off") return;
  const { startProbeLoop } = await import("./lib/probe-store");
  startProbeLoop();
  // `/` is the one route that awaits the network during render: the registry
  // count and the settled-jobs feed, each behind a TTL cache with an 8s
  // budget. Steady state is served from ISR, but the first request after a
  // container start had no cached value and no prerendered page, and paid the
  // round-trip. Both reads start now, so the cache is populated before the
  // first visitor; a failure here is the same fallback the page already has.
  const live = await import("./lib/live");
  void Promise.allSettled([live.getRegistryCount(56), live.getRecentSettledJobs(5)]);
}

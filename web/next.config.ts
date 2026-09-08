import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Operator-registered avatars come from 44 hosts and arrive as whatever
    // those hosts serve — one was a 1.3 MB PNG painted at 38px. The optimizer
    // fetches each once, re-encodes it to the size it is drawn at, and serves
    // it from this origin, so a list page depends on one host and moves
    // kilobytes. The wildcard is deliberate: the set of hosts is the registry's,
    // not ours. Only https; a data: or ipfs: image already falls back to the
    // identicon in components/avatar.tsx.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
    // Upstream avatars mostly send no cache headers; a day, not the 60s default,
    // so the optimizer is not re-fetching the 1.3 MB original every minute.
    minimumCacheTTL: 86_400,
  },
};

export default nextConfig;

// Root not-found. It cannot see params, so the copy is generic; the counts bind
// to shelf-stats. One screen, treated as a screen: the grid
// and glow behind it, the two figures the old description carried in a sentence
// raised to stat size, and the two ways out. The footer line every page carries
// closes it.
import { SearchX } from "lucide-react";
import { Button } from "@/components/button";
import { HeroBackdrop } from "@/components/hero-rays";
import { Logo } from "@/components/logo";
import { SiteFooter, SiteNav } from "@/components/site-chrome";
import { Stat } from "@/components/stat";
import { registryUrl } from "@/lib/format";
import { getStats } from "@/lib/shelf";
import { siteFooterLine } from "./_landing/data";

import { Container } from "./_landing/ui";

/*
 * Where to send a reader whose id is not on the shelf. NOT 8004scan: it indexes
 * no BNB Chain registry, so every 8004scan.io/agents/{56,97}/<id> renders
 * "Agent Not Found" (checked 2026-09-06). The registry contract on BscScan is
 * the one place the full set of ids is actually readable. This is why
 * lib/format.ts no longer exports SCAN_BASE: no explorer indexes the BNB Chain registries.
 */
const REGISTRY_URL = registryUrl(56);

// not-found.js takes no props and no metadata export; the layout title applies.
export default function NotFound() {
  const stats = getStats();
  return (
    <>
      <SiteNav />
      <main>
        <section className="relative overflow-hidden py-24 md:py-32">
          <HeroBackdrop />
          <Container className="relative flex flex-col gap-12">
            {/* The rise is a mount animation, stopped and left visible by the
                reduced-motion block in globals.css. */}
            <div className="flex max-w-2xl flex-col gap-4">
              <span
                className="animate-rise flex size-9 items-center justify-center rounded-lg bg-secondary"
                style={{ animationDelay: "0.05s" }}
              >
                <SearchX aria-hidden className="size-5 text-muted-foreground" />
              </span>
              <h1
                className="animate-rise text-3xl font-semibold tracking-tight md:text-4xl"
                style={{ animationDelay: "0.15s" }}
              >
                Not listed
              </h1>
              <p className="animate-rise text-lg text-muted-foreground" style={{ animationDelay: "0.3s" }}>
                That page is not on this site. If you were looking for an agent, it is either not listed here or the
                id does not exist.
              </p>
            </div>
            {/* the design system. The description used to carry both
                figures inside one 14px sentence; they are the only thing this
                page can actually tell you, so they are the page. */}
            <dl
              className="animate-rise grid max-w-2xl grid-cols-1 gap-6 border-y py-8 sm:grid-cols-2"
              style={{ animationDelay: "0.45s" }}
            >
              <Stat label="Agents listed" value={stats.shelved} size="lg" highlight />
              <Stat label="Registered ids" value={stats.registered} size="lg" caption="on BNB Chain" />
            </dl>
            <div className="animate-rise flex flex-wrap gap-3" style={{ animationDelay: "0.6s" }}>
              {/* The nav already carries this link as the view's one `default` button; the page's copy is `outline`. */}
              <Button href="/marketplace" variant="outline" size="lg">
                Explore all agents
              </Button>
              <Button href={REGISTRY_URL} size="lg" icon={<Logo name="bscscan" size={16} />}>
                Registry on BscScan
              </Button>
            </div>
          </Container>
        </section>
      </main>
      <SiteFooter line={siteFooterLine()} />
    </>
  );
}

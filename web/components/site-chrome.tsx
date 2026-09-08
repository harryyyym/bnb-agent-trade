import { EYEBROW } from "@/app/_landing/ui";
import Link from "next/link";
import type { ReactNode } from "react";
import { GITHUB_URL, REPORT_URL, SITE_NAME } from "@/lib/site";
import { Container } from "./container";
import { ExtLink } from "./ext-link";
import { Logo, type LogoName } from "./logo";
import { NavLinks } from "./nav-links";

/**
 * the header: sticky, 64px, translucent with a blur so
 * the hero backdrop reads through, a hairline underneath. Wordmark left, links
 * and the primary `sm` CTA right (`NavLinks`); a Menu icon button below `md`.
 */
export function SiteNav() {
  return (
    // `bg-background/80 backdrop-blur` let scrolled content read through the
    // bar: agent names and the yellow quote button were legible behind it. The
    // ground is opaque enough to stop that now, and the blur is wider so what
    // passes under the edges is a wash rather than shapes.
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur-lg">
      <Container className="flex h-16 items-center justify-between gap-6">
        {/* `shrink-0` and no wrap: between 768 and about 830 the links and the
            action squeezed the wordmark onto two lines inside a 64px bar. The
            link row gives up the space instead. */}
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight whitespace-nowrap">
          <span className="size-2.5 rounded-sm bg-primary" aria-hidden />
          {SITE_NAME}
        </Link>
        <NavLinks />
      </Container>
    </header>
  );
}

const SOURCES: ReadonlyArray<{ name: LogoName; label: string }> = [
  { name: "bnbchain", label: "BNB Chain" },
  { name: "bscscan", label: "BscScan" },
  { name: "pancakeswap", label: "PancakeSwap" },
  { name: "aave", label: "Aave" },
  { name: "venus", label: "Venus" },
  { name: "termix", label: "TermiX" },
];

/**
 * Footer: optional one-line slot (`block N · status checked N min ago`, see
 * footerLine() in lib/format), the `Data` source strip, GitHub and Report.
 */
export function SiteFooter({ line }: { line?: ReactNode }) {
  return (
    <footer className="mt-24 border-t py-10">
      <Container className="flex flex-col gap-6">
        {line ? <p className="font-mono text-xs leading-relaxed text-muted-foreground">{line}</p> : null}
        <div className="flex flex-col gap-6 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:gap-8">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <span className={EYEBROW}>Data</span>
            {SOURCES.map((s) => (
              <span key={s.name} className="inline-flex items-center gap-2">
                <Logo name={s.name} size={16} />
                {s.label}
              </span>
            ))}
          </div>
          <div className="flex shrink-0 gap-6">
            <ExtLink href={GITHUB_URL}>GitHub</ExtLink>
            <ExtLink href={REPORT_URL}>Report a listing</ExtLink>
          </div>
        </div>
      </Container>
    </footer>
  );
}

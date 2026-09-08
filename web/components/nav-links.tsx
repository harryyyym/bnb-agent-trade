"use client";

import { ArrowUpRight, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button as UIButton } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { GITHUB_URL, NAV_LINKS } from "@/lib/site";
import { cn } from "@/lib/utils";

const linkClass = (active: boolean) =>
  cn("text-sm transition-colors", active ? "text-foreground" : "text-muted-foreground hover:text-foreground");

const sheetLinkClass = (active: boolean) =>
  cn(
    "flex items-center gap-1.5 rounded-md px-3 py-2 text-base transition-colors",
    active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
  );

/**
 * Nav links with active state. The bar is the same on every page — the
 * `Explore agents` CTA it used to carry was removed on 2026-09-08 so the banner
 * reads identically on the landing, the marketplace, payments and the reports.
 * Below `lg` the links move into a stock Sheet behind a Menu icon button
 *. Client only for usePathname and the Sheet.
 */
export function NavLinks() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="flex items-center gap-6">
      <nav className="hidden items-center gap-6 lg:flex" aria-label="Primary">
        {NAV_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={isActive(l.href) ? "page" : undefined}
            className={linkClass(isActive(l.href))}
          >
            {l.label}
          </Link>
        ))}
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(linkClass(false), "inline-flex items-center gap-0.5")}
        >
          GitHub
          <ArrowUpRight aria-hidden className="size-3.5" />
        </a>
      </nav>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          {/* `icon-lg` is 40px — the touch floor the design system; no smaller stock size reaches it. */}
          <UIButton variant="outline" size="icon-lg" className="lg:hidden" aria-label="Open menu">
            <Menu />
          </UIButton>
        </SheetTrigger>
        <SheetContent side="right" aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-1 px-4" aria-label="Primary">
            {NAV_LINKS.map((l) => (
              <SheetClose asChild key={l.href}>
                <Link
                  href={l.href}
                  aria-current={isActive(l.href) ? "page" : undefined}
                  className={sheetLinkClass(isActive(l.href))}
                >
                  {l.label}
                </Link>
              </SheetClose>
            ))}
            <SheetClose asChild>
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className={sheetLinkClass(false)}>
                GitHub
                <ArrowUpRight aria-hidden className="size-4" />
              </a>
            </SheetClose>
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}

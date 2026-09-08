import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * An outbound link in body text: new tab, `rel="noopener noreferrer"`, an
 * ArrowUpRight icon after the label.
 * The base sets the hover only, so a caller decides the resting colour.
 * Buttons stay `components/button`; this is for links inside a sentence.
 */
export function ExtLink({
  href,
  className,
  title,
  arrow = true,
  children,
}: {
  href: string;
  className?: string;
  title?: string;
  arrow?: boolean;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className={cn("transition-colors hover:text-foreground", className)}
    >
      {children}
      {arrow ? <ArrowUpRight aria-hidden className="ml-0.5 inline size-3.5 -translate-y-px" /> : null}
    </a>
  );
}

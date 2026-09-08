import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** DESIGN.md §3 container: 1152px, 16 / 24 / 32px side padding by breakpoint. */
export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}

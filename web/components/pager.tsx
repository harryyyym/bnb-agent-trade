"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem } from "@/components/ui/pagination";
import { fmtInt } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Page numbers to show: all when ≤ 9, else 1 … p-1 p p+1 … n. */
function pageList(page: number, pages: number): Array<number | "…"> {
  if (pages <= 9) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set<number>([1, 2, pages - 1, pages, page - 1, page, page + 1]);
  const nums = [...set].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: Array<number | "…"> = [];
  for (let i = 0; i < nums.length; i++) {
    if (i > 0 && nums[i] - nums[i - 1] > 1) out.push("…");
    out.push(nums[i]);
  }
  return out;
}

/**
 * `Showing 1–30 of 268` + numbered pages with Prev / Next on the stock shadcn
 * Pagination. The ends are inert spans at 50% when there is
 * nowhere to go — no disabled control on a public page.
 *
 * Pass `onChange` for the client-filtered marketplace list (cells are buttons
 * styled with `buttonVariants`, as the stock PaginationLink is), or `href` to
 * build real links so the pager also works without JavaScript.
 */
export function Pager({
  page,
  total,
  pageSize = 20,
  onChange,
  href,
  className,
}: {
  page: number;
  total: number;
  pageSize?: number;
  onChange?: (page: number) => void;
  href?: (page: number) => string;
  className?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const cur = Math.min(Math.max(1, page), pages);
  const start = total === 0 ? 0 : (cur - 1) * pageSize + 1;
  const end = Math.min(total, cur * pageSize);
  const showing =
    total === 0 ? "Showing 0 of 0" : `Showing ${fmtInt(start)}–${fmtInt(end)} of ${fmtInt(total)}`;

  /** One clickable cell: a next/link anchor when `href` is given, else a button. */
  const cell = (
    target: number,
    label: ReactNode,
    ariaLabel: string,
    opts: { active?: boolean; size?: "icon" | "default"; className?: string } = {},
  ) => {
    const { active = false, size = "icon", className: extra } = opts;
    const cls = cn(buttonVariants({ variant: active ? "outline" : "ghost", size }), extra);
    if (href) {
      return (
        <Link
          href={href(target)}
          aria-label={ariaLabel}
          aria-current={active ? "page" : undefined}
          data-slot="pagination-link"
          data-active={active}
          className={cls}
        >
          {label}
        </Link>
      );
    }
    return (
      <button
        type="button"
        onClick={() => onChange?.(target)}
        aria-label={ariaLabel}
        aria-current={active ? "page" : undefined}
        data-slot="pagination-link"
        data-active={active}
        className={cls}
      >
        {label}
      </button>
    );
  };

  /*
   * The end that has nowhere to go. It measured 2.42:1 at
   * `text-muted-foreground/50` — the universal look of a dead button, on a page
   * that is not allowed to render one. `text-muted-foreground`
   * is 6.34:1 and reads as a label rather than as a broken control; the missing
   * hover and the missing pointer already say it is not clickable.
   */
  const inert = (label: ReactNode) => (
    <span
      aria-hidden
      className={cn(
        buttonVariants({ variant: "ghost", size: "default" }),
        "pointer-events-none gap-1 px-2.5 text-muted-foreground hover:bg-transparent",
      )}
    >
      {label}
    </span>
  );

  const prev = (
    <>
      <ChevronLeft />
      <span className="hidden sm:block">Prev</span>
    </>
  );
  const next = (
    <>
      <span className="hidden sm:block">Next</span>
      <ChevronRight />
    </>
  );

  return (
    <div
      className={cn(
        "flex flex-col gap-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <span className="tabular-nums">{showing}</span>
      <Pagination className="mx-0 w-auto">
        <PaginationContent>
          <PaginationItem>
            {cur > 1
              ? cell(cur - 1, prev, "Go to previous page", { size: "default", className: "gap-1 px-2.5" })
              : inert(prev)}
          </PaginationItem>

          {/* Below `sm` only the current page shows between Prev and Next: nine
              numbers plus the ends are 436px, wider than a phone. */}
          {pageList(cur, pages).map((p, i) => (
            <PaginationItem key={p === "…" ? `gap-${i}` : p} className={p === cur ? undefined : "hidden sm:block"}>
              {p === "…" ? <PaginationEllipsis /> : cell(p, String(p), `Page ${p}`, { active: p === cur })}
            </PaginationItem>
          ))}

          <PaginationItem>
            {cur < pages
              ? cell(cur + 1, next, "Go to next page", { size: "default", className: "gap-1 px-2.5" })
              : inert(next)}
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}

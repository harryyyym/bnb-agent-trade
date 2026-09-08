import { Bot, Grid3x3, HeartPulse, Scale, TrendingUp, type LucideIcon } from "lucide-react";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

/** the design system — lucide, one per category. */
export const CATEGORY_ICON: Record<Category, LucideIcon> = {
  rebalancing: Scale,
  "grid trading": Grid3x3,
  "yield optimisation": TrendingUp,
  "health factor monitoring": HeartPulse,
  other: Bot,
};

const SIZE_CLASS: Record<number, string> = { 14: "size-3.5", 16: "size-4", 20: "size-5", 24: "size-6" };

export function CategoryIcon({
  category,
  size = 16,
  className,
}: {
  category: Category;
  /** 14 in a badge · 16 inline · 20 in a card tile · 24 in a header. */
  size?: 14 | 16 | 20 | 24;
  className?: string;
}) {
  const Icon = CATEGORY_ICON[category] ?? Bot;
  return <Icon aria-hidden className={cn("shrink-0", SIZE_CLASS[size], className)} />;
}

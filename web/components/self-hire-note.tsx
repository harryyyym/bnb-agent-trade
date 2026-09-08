import type { ReactNode } from "react";
import { SELF_HIRE_NOTE } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The caption under a settled-job number when the operator bought some of the
 * jobs. The wording
 * comes from `selfHireSentence()` in lib/format, which has the two shapes the
 * rule requires; `SELF_HIRE_NOTE` is the default for the all-operator case.
 */
export function SelfHireNote({ children, className }: { children?: ReactNode; className?: string }) {
  return <div className={cn("text-xs text-muted-foreground", className)}>{children ?? SELF_HIRE_NOTE}</div>;
}

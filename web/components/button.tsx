import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Button as UIButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type UIProps = ComponentProps<typeof UIButton>;
export type ButtonVariant = NonNullable<UIProps["variant"]>;
export type ButtonSize = NonNullable<UIProps["size"]>;

function isExternal(href: string): boolean {
  return /^(https?:)?\/\//.test(href) || href.startsWith("mailto:");
}

/** Old call sites wrote the arrow into the label; the icon replaces it. */
function stripArrow(children: ReactNode): ReactNode {
  return typeof children === "string" ? children.replace(/\s*[↗→←]\s*$/, "") : children;
}

/**
 * the design system Button: the stock shadcn Button plus href behaviour. An internal
 * href renders next/link and ends with an ArrowRight icon, an external href
 * opens in a new tab (rel="noopener noreferrer") and ends with ArrowUpRight;
 * `arrow={false}` opts out. Arrows are lucide icons, never the
 * text glyphs, and nudge 2px on hover (§9).
 *
 * There is deliberately no `disabled`: an unavailable action is not rendered.
 * The default variant is `outline`; a view's one primary action says
 * `variant="default"` explicitly.
 *
 * Everything else is passed through, `ref` included. That matters for the Radix
 * primitives that wrap a button in `asChild`: they clone the child with a ref,
 * `data-state` and the aria pair, and a component with a closed prop list drops
 * all three silently. The trigger still opens, because `onClick` happens to be
 * named — but the ref never arrives, so on close Radix has nothing to hand
 * focus back to and a keyboard user lands on <body>.
 */
export function Button({
  href,
  type = "button",
  size = "default",
  variant = "outline",
  arrow = true,
  icon,
  className,
  children,
  ...rest
}: Omit<ComponentProps<typeof UIButton>, "asChild" | "disabled" | "variant" | "size"> & {
  href?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
  /** Trailing arrow for links; `false` suppresses it. */
  arrow?: boolean | "auto";
  /** Leading lucide icon. */
  icon?: ReactNode;
  children: ReactNode;
}) {
  const ext = href ? isExternal(href) : false;
  const Arrow = href && arrow ? (ext ? ArrowUpRight : ArrowRight) : null;
  const label = (
    <>
      {icon}
      {stripArrow(children)}
      {Arrow ? (
        <Arrow
          aria-hidden
          className={cn(
            "transition-transform",
            ext ? "group-hover/button:translate-x-px group-hover/button:-translate-y-px" : "group-hover/button:translate-x-0.5",
          )}
        />
      ) : null}
    </>
  );
  const cls = cn("group/button", className);

  if (href && !ext) {
    return (
      <UIButton asChild variant={variant} size={size} className={cls} {...rest}>
        <Link href={href}>{label}</Link>
      </UIButton>
    );
  }
  if (href) {
    return (
      <UIButton asChild variant={variant} size={size} className={cls} {...rest}>
        <a href={href} target="_blank" rel="noopener noreferrer">
          {label}
        </a>
      </UIButton>
    );
  }
  return (
    <UIButton type={type} variant={variant} size={size} className={cls} {...rest}>
      {label}
    </UIButton>
  );
}

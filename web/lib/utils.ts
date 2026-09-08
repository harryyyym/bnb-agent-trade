import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Class composition for every component: clsx semantics, Tailwind conflict resolution. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

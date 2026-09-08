"use client";

import {
  Activity,
  ArrowUpDown,
  ChevronDown,
  Coins,
  FlaskConical,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CategoryIcon } from "@/components/category-icon";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isCategory, TRACK_ORDER } from "@/lib/categories";
import {
  MODE_LABEL,
  MODE_ORDER,
  RAIL_LABEL,
  RAIL_ORDER,
  VENUE_FACETS,
  fmtInt,
  type VenueKey,
} from "@/lib/format";
import type { Category, Mode, Rail } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ALL_TAB, ANY_OPTION, isSortKey, RESULTS_ID, SORTS, tabId, type SortKey } from "./filters";
import type { FacetCounts } from "./list";

/**
 * What each category is for, in the words someone arrives with. The tab still
 * filters on `category` and says so in its tooltip, so the editorial join stays
 * auditable — but nobody arrives looking for "health factor monitoring", they
 * arrive wanting to watch a lending position.
 */
const TAB_LABEL: Record<Category, string> = {
  rebalancing: "Rebalance a position",
  "grid trading": "Run a grid",
  "yield optimisation": "Find better yield",
  "health factor monitoring": "Watch a lending position",
  other: "Something else",
};

/**
 * A stock Select whose trigger names the facet until a value is picked and
 * whose options carry the count they would yield; an option yielding none is
 * not offered rather than shown disabled. `Any` puts the facet back to rest.
 */
function Facet<T extends string>({
  label,
  icon,
  value,
  onChange,
  options,
}: {
  label: string;
  icon: ReactNode;
  value: T | null;
  onChange: (v: T | null) => void;
  options: Array<{ value: T; label: string; n: number; title?: string }>;
}) {
  const live = options.filter((o) => o.n > 0 || o.value === value);
  return (
    <Select value={value ?? ""} onValueChange={(v) => onChange(v === ANY_OPTION ? null : (v as T))}>
      <SelectTrigger aria-label={label} className="w-full sm:w-auto">
        {icon}
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent align="start">
        <SelectItem value={ANY_OPTION}>Any</SelectItem>
        {live.map((o) => (
          <SelectItem key={o.value} value={o.value} title={o.title}>
            {o.label}
            <span className="text-muted-foreground tabular-nums">{fmtInt(o.n)}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** A stock Switch with its Label: icon, words, and the count the switch would leave. */
function Toggle({
  id,
  icon: Icon,
  label,
  n,
  checked,
  onChange,
  title,
}: {
  id: string;
  icon: LucideIcon;
  label: string;
  n: number;
  checked: boolean;
  onChange: (v: boolean) => void;
  title?: string;
}) {
  return (
    /*
     * One bounded control, with the switch AFTER its label. Loose in the row,
     * each switch sat to the left of the words it governs and closer to the
     * neighbouring dropdown than to them, so the eye paired it with the wrong
     * thing. The border makes the pair a unit at any wrap position.
     */
    <div className="flex h-9 items-center gap-2 rounded-md border border-input px-3">
      <Label htmlFor={id} title={title} className="cursor-pointer">
        <Icon aria-hidden className="size-4 text-muted-foreground" />
        {label}
        <span className="text-muted-foreground tabular-nums">{fmtInt(n)}</span>
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/**
 * Two acts, not three bands. Searching is the primary one, so it is alone: a
 * 48px field at body size with 24px of air under it. Refining is the secondary
 * one, so the tabs and the facets sit 12px apart as a single group — they are
 * the same act at two depths, and reading as one band is what lets the search
 * above them read as the first thing to do. Before this the three rows were
 * the same height, the same spacing and the same weight, and a visitor met six
 * controls of equal loudness before one agent.
 *
 * Line 1 — search, the widest element on the page, directly under the header.
 * Line 2 — what you want done, as tabs with live counts.
 * Line 3 — venue, what the agent is allowed to do, how it takes payment, the
 * two switches and the sort. `Status checked …` is not here: with it on this
 * line the sort control wrapped onto a line of its own at 1440, so it sits in
 * the list header beside the row count.
 *
 * Every control carries the number of agents it would leave, computed against
 * the filters already applied.
 */
export function Toolbar({
  input,
  onInput,
  total,
  category,
  onCategory,
  venue,
  onVenue,
  mode,
  onMode,
  rail,
  onRail,
  counts,
  sort,
  onSort,
  reachable,
  onReachable,
  seeded,
  onSeeded,
}: {
  input: string;
  onInput: (v: string) => void;
  /** Every listed agent — the number in the search placeholder. */
  total: number;
  category: Category | null;
  onCategory: (c: Category | null) => void;
  venue: VenueKey | null;
  onVenue: (v: VenueKey | null) => void;
  mode: Mode | null;
  onMode: (m: Mode | null) => void;
  rail: Rail | null;
  onRail: (r: Rail | null) => void;
  counts: FacetCounts;
  sort: SortKey;
  onSort: (s: SortKey) => void;
  reachable: boolean;
  onReachable: (v: boolean) => void;
  seeded: boolean;
  onSeeded: (v: boolean) => void;
}) {
  const box = useRef<HTMLInputElement>(null);
  const [openFacets, setOpenFacets] = useState(false);
  const active = [venue, mode, rail, reachable || null, seeded || null].filter(Boolean).length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "k" || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      box.current?.focus();
      box.current?.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const tabs: Array<{ value: string; category: Category | null; label: string; n: number; title?: string }> = [
    { value: ALL_TAB, category: null, label: "All", n: counts.categoryTotal },
    ...TRACK_ORDER.map((c) => ({
      value: c,
      category: c,
      label: TAB_LABEL[c],
      n: counts.category[c],
      title: `category = ${c}`,
    })),
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* `h-12` and body size at every width: the primary act on the page is
          the one control that is taller than the rest of the chrome, and
          `md:text-sm` from the stock Input would have shrunk it on the desktop
          where there is most room for it. */}
      <InputGroup className="h-12 rounded-lg">
        <InputGroupAddon>
          <Search aria-hidden className="size-5" />
        </InputGroupAddon>
        <Label htmlFor="marketplace-search" className="sr-only">
          Search agents
        </Label>
        <InputGroupInput
          id="marketplace-search"
          ref={box}
          type="text"
          value={input}
          onChange={(e) => onInput(e.target.value)}
          placeholder={`Search ${fmtInt(total)} agents by name, skill, venue or address`}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          className="h-full md:text-base"
        />
        <InputGroupAddon align="inline-end" className="hidden md:flex">
          <Kbd>⌘K</Kbd>
        </InputGroupAddon>
      </InputGroup>

      {/* The refine group: one band at 12px, under 24px of air. */}
      <div className="flex flex-col gap-3">
        <Tabs value={category ?? ALL_TAB} onValueChange={(v) => onCategory(isCategory(v) ? v : null)}>
          {/* The one element on the page that scrolls sideways, below `md`. */}
          <TabsList
            aria-label="What you want done"
            className="max-w-full justify-start overflow-x-auto [scrollbar-width:none]"
          >
            {tabs.map((t) => (
              <TabsTrigger
                key={t.value}
                id={tabId(t.category)}
                value={t.value}
                aria-controls={RESULTS_ID}
                title={t.title ?? `all ${fmtInt(t.n)} listed agents`}
                className="flex-none"
              >
                {t.category ? <CategoryIcon category={t.category} size={14} /> : null}
                {t.label}
                <span className="text-muted-foreground tabular-nums">{fmtInt(t.n)}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-2">
          {/* Three selects are four lines of chrome on a phone before a single
              agent shows. Below `sm` they fold behind one button that says how
              many of them are on. */}
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpenFacets((v) => !v)}
            aria-expanded={openFacets}
            className="sm:hidden"
          >
            <SlidersHorizontal aria-hidden />
            Filters
            {active > 0 ? <span className="text-muted-foreground tabular-nums">{fmtInt(active)}</span> : null}
            <ChevronDown aria-hidden className={cn("transition-transform", openFacets && "rotate-180")} />
          </Button>

          <div className={cn("w-full flex-wrap items-center gap-2 sm:flex sm:w-auto", openFacets ? "flex" : "hidden")}>
            <Facet
              label="Venue"
              icon={<Store aria-hidden />}
              value={venue}
              onChange={onVenue}
              options={VENUE_FACETS.map((f) => ({ value: f.key, label: f.label, n: counts.venue[f.key] }))}
            />
            <Facet
              label="Allowed to"
              icon={<ShieldCheck aria-hidden />}
              value={mode}
              onChange={onMode}
              options={MODE_ORDER.map((m) => ({ value: m, label: MODE_LABEL[m], n: counts.mode[m] }))}
            />
            <Facet
              label="Pays via"
              icon={<Coins aria-hidden />}
              value={rail}
              onChange={onRail}
              options={RAIL_ORDER.map((r) => ({ value: r, label: RAIL_LABEL[r], n: counts.rail[r] }))}
            />

            <Toggle
              id="reachable-only"
              icon={Activity}
              label="Answering now"
              n={counts.reachable}
              checked={reachable}
              onChange={onReachable}
            />

            {/* The demo lane, off by default. Its rows' records are synthetic, so
                the marketplace a reader lands on is the chain-sourced one and
                showing the rest is a deliberate act. */}
            {counts.seeded > 0 || seeded ? (
              <Toggle
                id="seeded-rows"
                icon={FlaskConical}
                label="Seeded demo rows"
                n={counts.seeded}
                checked={seeded}
                onChange={onSeeded}
                title="Seeded rows are a demonstration lane: their records are synthetic, not read from BNB Chain."
              />
            ) : null}
          </div>

          {/* `xl`, not `lg`: the content box is 1088px from `lg` up, so the row
              only fits on one line from 1280 — at 1024 the sort wrapped to a
              line of its own and `ml-auto` pushed it 800px away from every
              other control on the page. Below `xl` it wraps into the group. */}
          <div className="flex flex-wrap items-center gap-2 xl:ml-auto">
            <Select
              value={sort}
              onValueChange={(v) => {
                if (isSortKey(v)) onSort(v);
              }}
            >
              {/* Pinned to one width: the Radix trigger is `w-fit`, so the box used
                  to grow and shrink with the selected label and drag itself out
                  from under the pointer. */}
              <SelectTrigger aria-label="Sort" className="w-48">
                <ArrowUpDown aria-hidden />
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {SORTS.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}

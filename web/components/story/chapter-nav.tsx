"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export type Chapter = { n: string; id: string; label: string };

/** The heading nearest above the reading line, by id. */
function useActiveChapter(ids: ReadonlyArray<string>): string | null {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    let raf = 0;
    const read = () => {
      raf = 0;
      let current: string | null = null;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= window.innerHeight * 0.3) current = id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [ids]);
  return active;
}

/**
 * The sticky chapter rail (State of JS's sidebar, Octoverse's TOC): one entry
 * per chapter, the current one carrying the brand rule. Below 1280 the rail is
 * hidden by CSS and `ChapterChips` stands in under the hero.
 */
export function ChapterRail({
  chapters,
  back,
}: {
  chapters: ReadonlyArray<Chapter>;
  back?: { href: string; label: string };
}) {
  const active = useActiveChapter(chapters.map((c) => c.id));
  return (
    <aside className="story-rail">
      <div>
        {back ? (
          <Link href={back.href} className="rail-back">
            <ArrowLeft size={14} aria-hidden />
            {back.label}
          </Link>
        ) : null}
        <nav aria-label="Chapters">
          <p className="rail-title">Contents</p>
          <ol>
            {chapters.map((c) => (
              <li key={c.id}>
                <a href={`#${c.id}`} aria-current={active === c.id ? "true" : undefined}>
                  <span className="n">{c.n}</span>
                  <span>{c.label}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </div>
    </aside>
  );
}

export function ChapterChips({ chapters }: { chapters: ReadonlyArray<Chapter> }) {
  return (
    <nav className="story-chapters-inline" aria-label="Chapters">
      {chapters.map((c) => (
        <a key={c.id} href={`#${c.id}`}>
          <span className="n">{c.n}</span>
          {c.label}
        </a>
      ))}
    </nav>
  );
}

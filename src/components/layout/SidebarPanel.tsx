import type { MarkdownHeading } from "astro";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Heading = Pick<MarkdownHeading, "slug" | "text" | "depth">;

interface SidebarPanelProps {
  headings?: Heading[];
}

interface TocListProps {
  headings: NormalizedHeading[];
  activeSlug: string | null;
  onNavigate: (slug: string) => void;
  size?: "desktop" | "mobile";
}

interface NormalizedHeading {
  slug: string;
  depth: number;
  text: string;
}

const HEADER_OFFSET = 88;
const SELECTOR =
  "article h1, article h2, article h3, article h4, article h5, article h6";

export default function SidebarPanel({ headings = [] }: SidebarPanelProps) {
  const { normalizedHeadings, activeSlug, scrollToSlug, hasHydratedHeadings } =
    useDynamicToc(headings);

  const hasHeadings = normalizedHeadings.length > 0;

  if (!hasHeadings) {
    return null;
  }

  return (
    <>
      <section className="hidden lg:block bg-base-200/40 backdrop-blur-sm rounded-2xl border border-base-content/5 p-5 shadow-sm">
        <header className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <i className="ri-compass-3-line text-lg" aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold text-base">阅读导览</p>
              <p className="text-xs text-base-content/60">动态追踪当前章节</p>
            </div>
          </div>
          <span className="text-xs font-mono text-base-content/50">
            {normalizedHeadings.length} 条
          </span>
        </header>

        <div className="relative">
          {hasHydratedHeadings ? (
            <TocList
              headings={normalizedHeadings}
              activeSlug={activeSlug}
              onNavigate={scrollToSlug}
              size="desktop"
            />
          ) : (
            <SkeletonLines />
          )}
        </div>
      </section>

      {hasHydratedHeadings && (
        <MobileTocFab
          headings={normalizedHeadings}
          activeSlug={activeSlug}
          onNavigate={scrollToSlug}
        />
      )}
    </>
  );
}

function TocList({ headings, activeSlug, onNavigate, size }: TocListProps) {
  return (
    <nav aria-label="文章目录">
      <ol className="space-y-1 pl-2 max-h-[calc(100vh-500px)] overflow-y-auto scrollbar-none">
        {headings.map((heading) => {
          const isActive = heading.slug === activeSlug;
          const depth = Math.min(heading.depth, 4);
          const paddingLeft = depth * 12;

          return (
            <li key={heading.slug}>
              <button
                type="button"
                onClick={() => onNavigate(heading.slug)}
                className={[
                  "relative flex items-center py-2 px-2 rounded-lg w-full transition-colors cursor-pointer",
                  isActive
                    ? "bg-primary/10 text-primary font-medium shadow-sm"
                    : "text-base-content/70 hover:text-base-content hover:bg-base-100/60",
                  size === "mobile" ? "text-sm" : "text-xs",
                ].join(" ")}
                style={{ paddingLeft: `${paddingLeft}px` }}
                aria-current={isActive ? "true" : undefined}
              >
                <span className="flex items-center gap-2">
                  <i
                    className={[
                      "ri-checkbox-blank-circle-fill text-[6px] transition-colors",
                      isActive ? "text-primary" : "text-base-content/30",
                    ].join(" ")}
                    aria-hidden
                  />
                  <span className="line-clamp-2">{heading.text}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function SkeletonLines() {
  const skeletonLines = Array.from({ length: 6 }, (_, index) => ({
    id: `skeleton-line-${index}`,
    width: 80 - index * 5,
    offset: index * 4,
  }));

  return (
    <ul className="space-y-2 py-2">
      {skeletonLines.map((line) => (
        <li
          key={line.id}
          className="h-4 bg-base-content/10 rounded-full animate-pulse"
          style={{ width: `${line.width}%`, marginLeft: `${line.offset}px` }}
        />
      ))}
    </ul>
  );
}

function MobileTocFab({
  headings,
  activeSlug,
  onNavigate,
}: {
  headings: NormalizedHeading[];
  activeSlug: string | null;
  onNavigate: (slug: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (isOpen) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [isOpen]);

  const handleNavigate = useCallback(
    (slug: string) => {
      onNavigate(slug);
      setIsOpen(false);
    },
    [onNavigate],
  );

  return (
    <>
      <button
        type="button"
        className="lg:hidden fixed right-6 bottom-20 md:right-8 w-12 h-12 bg-primary text-primary-content rounded-full shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl z-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 no-print"
        aria-label="打开目录"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(true)}
      >
        <i className="ri-list-check-2 text-xl" aria-hidden />
      </button>

      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            aria-label="关闭目录"
            onClick={() => setIsOpen(false)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setIsOpen(false);
              }
            }}
          />
          <div className="absolute inset-x-0 bottom-0 bg-base-100 rounded-t-3xl shadow-2xl p-5 max-h-[70vh] overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold">快速目录</p>
                <p className="text-xs text-base-content/60">
                  点击标题跳转对应段落
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-circle"
                aria-label="关闭目录"
                onClick={() => setIsOpen(false)}
              >
                <i className="ri-close-line text-lg" aria-hidden />
              </button>
            </div>
            <div className="overflow-y-auto pr-1 max-h-[55vh]">
              <TocList
                headings={headings}
                activeSlug={activeSlug}
                onNavigate={handleNavigate}
                size="mobile"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function useDynamicToc(rawHeadings: Heading[] = []) {
  const normalizedHeadings = useMemo<NormalizedHeading[]>(() => {
    return rawHeadings
      .filter((heading) => heading.depth <= 4)
      .map((heading, index) => ({
        slug: heading.slug || `heading-${index}`,
        depth: heading.depth,
        text: heading.text,
      }));
  }, [rawHeadings]);

  const [activeSlug, setActiveSlug] = useState<string | null>(
    normalizedHeadings[0]?.slug ?? null,
  );
  const [hasHydratedHeadings, setHasHydratedHeadings] = useState(false);
  const manualScrollRef = useRef(false);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    setActiveSlug(normalizedHeadings[0]?.slug ?? null);
  }, [normalizedHeadings]);

  useEffect(() => {
    if (typeof document === "undefined" || !normalizedHeadings.length) return;

    const markdownHeadings = Array.from(
      document.querySelectorAll(SELECTOR),
    ) as HTMLElement[];

    normalizedHeadings.forEach((heading, index) => {
      const candidate =
        document.getElementById(heading.slug) || markdownHeadings[index];
      if (candidate && candidate.id !== heading.slug) {
        candidate.id = heading.slug;
      }
    });

    setHasHydratedHeadings(true);
  }, [normalizedHeadings]);

  useEffect(() => {
    if (typeof document === "undefined" || !normalizedHeadings.length) return;

    const elements = normalizedHeadings
      .map((heading) => document.getElementById(heading.slug))
      .filter((el): el is HTMLElement => Boolean(el));

    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (manualScrollRef.current) return;

        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          )[0];

        if (visibleEntry?.target.id) {
          setActiveSlug(visibleEntry.target.id);
        }
      },
      {
        rootMargin: `-${HEADER_OFFSET + 10}px 0px -70% 0px`,
        threshold: [0, 0.2, 0.4],
      },
    );

    elements.forEach((element) => {
      observer.observe(element);
    });

    return () => observer.disconnect();
  }, [normalizedHeadings]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      timersRef.current = [];
    };
  }, []);

  const scrollToSlug = useCallback((slug: string) => {
    if (typeof window === "undefined") return;
    const target = document.getElementById(slug);
    if (!target) return;

    const scroll = () => {
      const targetTop =
        window.scrollY + target.getBoundingClientRect().top - HEADER_OFFSET;
      window.scrollTo({ top: targetTop, behavior: "smooth" });
    };

    manualScrollRef.current = true;
    timersRef.current.forEach((timerId) => {
      window.clearTimeout(timerId);
    });
    timersRef.current = [];

    scroll();
    timersRef.current.push(
      window.setTimeout(scroll, 350),
      window.setTimeout(() => {
        scroll();
        manualScrollRef.current = false;
      }, 900),
    );

    setActiveSlug(slug);
    history.replaceState(null, "", `#${slug}`);
  }, []);

  return { normalizedHeadings, activeSlug, scrollToSlug, hasHydratedHeadings };
}

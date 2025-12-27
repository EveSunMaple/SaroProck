import type { MarkdownHeading } from "astro";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Heading = Pick<MarkdownHeading, "slug" | "text" | "depth">;

interface SidebarPanelProps {
  headings?: Heading[];
  author: string;
  twitterHandle: string;
  githubUrl: string;
  telegramUrl: string;
  channelUrl: string;
  stats: {
    articles: number;
    words: string | number;
  };
  contacts: {
    qqGroup: string;
    email: string;
  };
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

export default function SidebarPanel({
  headings = [],
  author,
  twitterHandle,
  githubUrl,
  telegramUrl,
  channelUrl,
  stats,
  contacts,
}: SidebarPanelProps) {
  const { normalizedHeadings, activeSlug, scrollToSlug, hasHydratedHeadings } =
    useDynamicToc(headings);
  const hasHeadings = normalizedHeadings.length > 0;

  return (
    <>
      <aside className="hidden lg:block lg:col-span-1 no-print">
        <div className="sticky top-18 space-y-4">
          <ProfileCard
            author={author}
            twitterHandle={twitterHandle}
            githubUrl={githubUrl}
            telegramUrl={telegramUrl}
          />

          <ChannelCard channelUrl={channelUrl} />

          {hasHeadings ? (
            <section className="bg-base-200/40 backdrop-blur-sm rounded-2xl border border-base-content/5 p-5 shadow-sm">
              <header className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <i
                      className="ri-compass-3-line text-lg"
                      aria-hidden="true"
                    />
                  </span>
                  <div>
                    <p className="font-semibold text-base">阅读导览</p>
                    <p className="text-xs text-base-content/60">
                      动态追踪当前章节
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono text-base-content/50">
                  {normalizedHeadings.length} 条
                </span>
              </header>

              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-px bg-base-content/10 pointer-events-none" />
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
          ) : (
            <EmptyState stats={stats} contacts={contacts} />
          )}
        </div>
      </aside>

      {hasHeadings && hasHydratedHeadings && (
        <MobileTocFab
          headings={normalizedHeadings}
          activeSlug={activeSlug}
          onNavigate={scrollToSlug}
        />
      )}
    </>
  );
}

function ProfileCard({
  author,
  twitterHandle,
  githubUrl,
  telegramUrl,
}: Pick<
  SidebarPanelProps,
  "author" | "twitterHandle" | "githubUrl" | "telegramUrl"
>) {
  return (
    <section className="bg-base-200/40 backdrop-blur-sm rounded-2xl border border-base-content/5 p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="avatar">
          <div className="w-12 h-12 rounded-2xl ring-1 ring-primary/30 ring-offset-2 ring-offset-base-100 overflow-hidden">
            <img
              src="/avatar.webp"
              alt={`${author} avatar`}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
        <div>
          <p className="text-sm uppercase tracking-wider text-base-content/50">
            Author
          </p>
          <h3 className="font-semibold text-base-content">{author}</h3>
          <p className="text-xs text-base-content/60">高三学生 · 技术手作</p>
        </div>
      </div>

      <p className="text-sm text-base-content/70 leading-relaxed mb-4">
        如果可以，请送我一张书签
      </p>

      <div className="flex items-center gap-2">
        <IconButton
          href={`https://twitter.com/${twitterHandle.replace("@", "")}`}
          label="Twitter"
          icon="ri-twitter-line"
        />
        <IconButton href={githubUrl} label="GitHub" icon="ri-github-line" />
        <IconButton
          href={telegramUrl}
          label="Telegram"
          icon="ri-telegram-line"
        />
      </div>
    </section>
  );
}

function ChannelCard({ channelUrl }: { channelUrl: string }) {
  return (
    <a
      href={channelUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-4 flex items-center justify-between rounded-2xl border border-base-content/10 bg-base-100 px-4 py-3 transition hover:border-primary/60 hover:bg-base-100/80"
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        <i className="ri-telegram-fill text-primary" aria-hidden />
        <span className="font-mono text-base-content/80">
          {channelUrl.replace(/^https?:\/\//, "")}
        </span>
      </span>
      <i className="ri-external-link-line text-base-content/60" aria-hidden />
    </a>
  );
}

function IconButton({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="btn btn-ghost btn-sm btn-circle"
      aria-label={label}
    >
      <i className={`${icon} text-lg`} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </a>
  );
}

function EmptyState({
  stats,
  contacts,
}: Pick<SidebarPanelProps, "stats" | "contacts">) {
  return (
    <div className="space-y-4">
      <section className="bg-base-200/40 backdrop-blur-sm rounded-2xl border border-base-content/5 p-5 shadow-sm">
        <header className="flex items-center gap-2 mb-5">
          <i
            className="ri-bar-chart-2-line text-primary text-2xl"
            aria-hidden
          />
          <div>
            <p className="text-sm font-semibold">站点统计</p>
            <p className="text-xs text-base-content/60">每一次记录都算数</p>
          </div>
        </header>
        <div className="grid grid-cols-1 gap-4">
          <StatCard
            label="篇文章"
            value={stats.articles}
            icon="ri-article-line"
          />
          <StatCard
            label="总字数"
            value={stats.words}
            icon="ri-file-word-2-line"
          />
        </div>
      </section>

      <section className="bg-base-200/40 backdrop-blur-sm rounded-2xl border border-base-content/5 p-5 shadow-sm">
        <header className="flex items-center gap-2 mb-4">
          <i
            className="ri-contacts-book-2-line text-primary text-2xl"
            aria-hidden
          />
          <div>
            <p className="text-sm font-semibold">保持联系</p>
            <p className="text-xs text-base-content/60">期待与你聊聊</p>
          </div>
        </header>

        <div className="space-y-3">
          <div className="flex items-center justify-between bg-base-100 rounded-xl border border-base-content/10 px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <i className="ri-qq-line text-base-content/70" aria-hidden />
              QQ 群
            </div>
            <span className="font-mono text-sm text-base-content/80">
              {contacts.qqGroup}
            </span>
          </div>
          <a
            href={`mailto:${contacts.email}`}
            className="btn btn-outline btn-primary w-full rounded-xl gap-2"
          >
            <i className="ri-mail-send-line" aria-hidden />
            给我写信
          </a>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: string;
}) {
  return (
    <div className="bg-base-100/80 rounded-2xl border border-base-content/5 p-4">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <i className={`${icon} text-xl`} aria-hidden />
        </span>
        <div>
          <p className="text-2xl font-semibold leading-none">{value}</p>
          <p className="text-sm text-base-content/60 mt-1">{label}</p>
        </div>
      </div>
    </div>
  );
}

function TocList({ headings, activeSlug, onNavigate, size }: TocListProps) {
  return (
    <nav aria-label="文章目录">
      <ol className="space-y-1 pl-2">
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
                  "relative w-full text-left rounded-xl px-3 py-2 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
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
        className="lg:hidden fixed bottom-20 right-5 z-40 w-12 h-12 rounded-full bg-base-100 border border-base-content/10 shadow-lg flex items-center justify-center text-primary transition hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
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

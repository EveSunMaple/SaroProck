import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import "./SearchBar.css";

type SearchIndexEntry = {
  title: string;
  url: string;
  description: string;
  tags: string[];
  categories: string[];
  contentText: string;
};

type MatchDetails = {
  title: boolean;
  categories: boolean;
  tags: boolean;
  content: boolean;
};

type ClientSearchResult = {
  title: string;
  url: string;
  snippet: string;
  tags: string[];
  categories: string[];
  matchScore: number;
  matchDetails: MatchDetails;
  keywords: string[];
};

type ContentMetadataResponse = {
  tags: string[];
  categories: string[];
};

const escapeRegExp = (text: string) =>
  text.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");

const highlightMatch = (text: string, keywords: string[]) => {
  if (!text) return "";

  let result = text;
  const sortedKeywords = keywords.slice().sort((a, b) => b.length - a.length);

  sortedKeywords.forEach((keyword) => {
    const escapedKeyword = escapeRegExp(keyword);
    const regex = new RegExp(`(${escapedKeyword})`, "gi");
    result = result.replaceAll(regex, '<mark class="search-mark">$1</mark>');
  });

  return result;
};

const SearchBar: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchIndexRef = useRef<SearchIndexEntry[] | null>(null);

  const [isExpanded, setIsExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState<ClientSearchResult[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [metadataLoaded, setMetadataLoaded] = useState(false);

  const expandSearchBar = useCallback(() => {
    if (isExpanded) return;
    setIsExpanded(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [isExpanded]);

  const collapseIfEmpty = useCallback(() => {
    if (query.trim().length === 0) {
      setIsExpanded(false);
    }
  }, [query]);

  const handleCloseDropdown = () => {
    setShowDropdown(false);
    collapseIfEmpty();
  };

  useEffect(() => {
    if (!isExpanded && !showDropdown) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && !containerRef.current?.contains(target)) {
        setShowDropdown(false);
        collapseIfEmpty();
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [collapseIfEmpty, isExpanded, showDropdown]);

  useEffect(() => {
    if (!isExpanded && !showDropdown) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowDropdown(false);
        collapseIfEmpty();
        inputRef.current?.blur();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [collapseIfEmpty, isExpanded, showDropdown]);

  useEffect(() => {
    if (!isExpanded || metadataLoaded) return;

    let isActive = true;
    let idleHandle: number | null = null;
    let timeoutHandle: number | null = null;

    const loadMetadata = async () => {
      try {
        const response = await fetch("/api/content-metadata");
        if (!response.ok) {
          throw new Error("Failed to fetch content metadata");
        }

        const data = (await response.json()) as ContentMetadataResponse;
        if (!isActive) return;

        setTags(Array.isArray(data.tags) ? data.tags : []);
        setCategories(Array.isArray(data.categories) ? data.categories : []);
      } catch (err) {
        console.error("Error loading tags and categories:", err);
      } finally {
        if (isActive) {
          setMetadataLoaded(true);
        }
      }
    };

    const hasWindow = typeof window !== "undefined";

    if (hasWindow && "requestIdleCallback" in window) {
      const runtimeWindow = window as typeof window & {
        requestIdleCallback: (
          callback: IdleRequestCallback,
          options?: IdleRequestOptions,
        ) => number;
        cancelIdleCallback: (handle: number) => void;
      };

      idleHandle = runtimeWindow.requestIdleCallback(
        () => {
          void loadMetadata();
        },
        { timeout: 800 },
      );
    } else if (hasWindow) {
      timeoutHandle = window.setTimeout(() => {
        void loadMetadata();
      }, 200);
    }

    return () => {
      isActive = false;
      if (
        idleHandle !== null &&
        typeof window !== "undefined" &&
        "cancelIdleCallback" in window
      ) {
        (
          window as typeof window & {
            cancelIdleCallback: (handle: number) => void;
          }
        ).cancelIdleCallback(idleHandle);
      }

      if (timeoutHandle !== null && typeof window !== "undefined") {
        window.clearTimeout(timeoutHandle);
      }
    };
  }, [isExpanded, metadataLoaded]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setShowDropdown(false);
      setLoading(false);
      setHasSearched(false);
      setError(null);
      setResults([]);
      return;
    }

    setShowDropdown(true);
    setLoading(true);
    setError(null);

    let isActive = true;
    const timer = window.setTimeout(() => {
      const performSearch = async () => {
        try {
          const rawKeywords = trimmedQuery
            .split(/\s+/)
            .filter((keyword) => keyword.length >= 2);
          const loweredKeywords = rawKeywords.map((keyword) =>
            keyword.toLowerCase(),
          );

          if (!loweredKeywords.length) {
            if (!isActive) return;
            setResults([]);
            setHasSearched(false);
            setLoading(false);
            setShowDropdown(false);
            return;
          }

          if (!searchIndexRef.current) {
            const response = await fetch("/search-index.json");
            if (!response.ok) {
              throw new Error("Failed to load search index");
            }

            const data = (await response.json()) as SearchIndexEntry[];
            searchIndexRef.current = data;
          }

          const index = searchIndexRef.current ?? [];
          const filtered = index.filter((entry) => {
            const entryTags = entry.tags ?? [];
            const entryCategories = entry.categories ?? [];

            if (
              selectedTags.length > 0 &&
              !selectedTags.some((tag) => entryTags.includes(tag))
            ) {
              return false;
            }

            if (
              selectedCategories.length > 0 &&
              !selectedCategories.some((category) =>
                entryCategories.includes(category),
              )
            ) {
              return false;
            }

            return true;
          });

          const computedResults: ClientSearchResult[] = [];

          filtered.forEach((entry) => {
            const titleLower = entry.title.toLowerCase();
            const tagsLower = (entry.tags ?? []).map((tag) =>
              tag.toLowerCase(),
            );
            const categoriesLower = (entry.categories ?? []).map((category) =>
              category.toLowerCase(),
            );
            const contentText = entry.contentText ?? "";
            const contentTextLower = contentText.toLowerCase();

            let matchScore = 0;
            const matchDetails: MatchDetails = {
              title: false,
              categories: false,
              tags: false,
              content: false,
            };

            loweredKeywords.forEach((keyword) => {
              if (titleLower.includes(keyword)) {
                matchScore += 100;
                matchDetails.title = true;
              }

              if (tagsLower.some((tag) => tag.includes(keyword))) {
                matchScore += 30;
                matchDetails.tags = true;
              }

              if (
                categoriesLower.some((category) => category.includes(keyword))
              ) {
                matchScore += 50;
                matchDetails.categories = true;
              }

              if (contentTextLower.includes(keyword)) {
                matchScore += 10;
                matchDetails.content = true;
              }
            });

            if (matchScore === 0) return;

            let snippet = entry.description ?? "";

            if (matchDetails.content) {
              const matchedIndex = loweredKeywords.findIndex((keyword) =>
                contentTextLower.includes(keyword),
              );
              const match =
                matchedIndex >= 0 ? loweredKeywords[matchedIndex] : "";

              if (match) {
                const contentMatchIndex = contentTextLower.indexOf(match);
                if (contentMatchIndex !== -1) {
                  const startIndex = Math.max(0, contentMatchIndex - 50);
                  const excerpt = contentText.substring(
                    startIndex,
                    startIndex + 100,
                  );
                  snippet = `${startIndex > 0 ? "..." : ""}${excerpt}...`;
                }
              }
            }

            computedResults.push({
              title: entry.title,
              url: entry.url,
              snippet,
              tags: entry.tags ?? [],
              categories: entry.categories ?? [],
              matchScore,
              matchDetails,
              keywords: rawKeywords,
            });
          });

          if (!isActive) return;

          computedResults.sort(
            (a, b) =>
              b.matchScore - a.matchScore || a.title.localeCompare(b.title),
          );

          setResults(computedResults);
          setHasSearched(true);
        } catch (err) {
          console.error("Error performing search:", err);
          if (!isActive) return;
          setError("搜索失败，请稍后再试");
          setResults([]);
          setHasSearched(false);
        } finally {
          if (isActive) {
            setLoading(false);
          }
        }
      };

      void performSearch();
    }, 300);

    return () => {
      isActive = false;
      window.clearTimeout(timer);
    };
  }, [query, selectedTags, selectedCategories]);

  const handleEnter = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;

    const trimmedQuery = query.trim();
    if (trimmedQuery.length > 0) {
      event.preventDefault();
      window.location.href = `/?q=${encodeURIComponent(trimmedQuery)}`;
    }
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) {
        const next = prev.filter((item) => item !== tag);
        return next.length ? next : [];
      }

      return [...prev, tag];
    });
  };

  const handleCategoryToggle = (category: string) => {
    setSelectedCategories((prev) => {
      if (prev.includes(category)) {
        const next = prev.filter((item) => item !== category);
        return next.length ? next : [];
      }

      return [...prev, category];
    });
  };

  const isAllTagsSelected = selectedTags.length === 0;
  const isAllCategoriesSelected = selectedCategories.length === 0;

  const searchBarClasses = [
    "flex items-center rounded-xl bg-base-200 transition-transform duration-300 cursor-text",
    isExpanded ? "search-bar-expanded w-52 sm:w-64" : "search-bar-collapsed",
  ].join(" ");

  const dropdownClasses = [
    "search-results-dropdown absolute top-full right-0 mt-2 bg-base-100/95 backdrop-blur-md border border-base-300 rounded-xl shadow-xl z-50 w-screen sm:w-[28rem] md:w-[32rem] max-w-[calc(100vw-2rem)]",
    showDropdown ? "" : "hidden",
  ]
    .join(" ")
    .trim();

  return (
    <div ref={containerRef} className="search-container relative">
      <label
        htmlFor="search-input"
        id="search-bar"
        className={searchBarClasses}
      >
        <span className="sr-only">搜索</span>
        <div className="search-icon px-2 text-base-content/80">
          <i
            className="ri-search-line text-lg leading-none"
            aria-hidden="true"
          />
        </div>
        <input
          ref={inputRef}
          type="text"
          id="search-input"
          className="search-input w-full bg-transparent border-none outline-none text-base py-1 transition-transform duration-300"
          placeholder="搜索..."
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleEnter}
          onFocus={() => {
            expandSearchBar();
            if (query.trim().length >= 2) {
              setShowDropdown(true);
            }
          }}
        />
      </label>

      <div id="search-results-dropdown" className={dropdownClasses}>
        <div className="bg-base-200 py-3 px-4 flex items-center justify-between border-b border-base-300 rounded-xl">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <i className="ri-search-line text-lg" aria-hidden="true" />
            </span>
            <h3 className="font-medium">搜索结果</h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="dropdown dropdown-end">
              <button
                type="button"
                className="btn btn-sm btn-ghost gap-1"
                aria-haspopup="true"
              >
                <i className="ri-equalizer-line text-base" aria-hidden="true" />
                <span>筛选</span>
              </button>
              <div className="card dropdown-content z-10 shadow-lg bg-base-200 rounded-xl w-72">
                <div className="card-body p-4 gap-3">
                  <div>
                    <h6 className="font-semibold text-base">标签</h6>
                    <div
                      className="max-h-40 overflow-y-auto pr-1"
                      id="tag-filters"
                    >
                      <label className="flex items-center mb-2">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm checkbox-primary mr-2"
                          value="all"
                          checked={isAllTagsSelected}
                          onChange={() => setSelectedTags([])}
                        />
                        <span>全部</span>
                      </label>
                      {tags.map((tag) => (
                        <label key={tag} className="flex items-center mb-2">
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm checkbox-primary mr-2"
                            value={tag}
                            checked={selectedTags.includes(tag)}
                            onChange={() => handleTagToggle(tag)}
                          />
                          <span>{tag}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="divider my-1" />

                  <div>
                    <h6 className="font-semibold text-base">分类</h6>
                    <div
                      className="max-h-40 overflow-y-auto pr-1"
                      id="category-filters"
                    >
                      <label className="flex items-center mb-2">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm checkbox-primary mr-2"
                          value="all"
                          checked={isAllCategoriesSelected}
                          onChange={() => setSelectedCategories([])}
                        />
                        <span>全部</span>
                      </label>
                      {categories.map((category) => (
                        <label
                          key={category}
                          className="flex items-center mb-2"
                        >
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm checkbox-primary mr-2"
                            value={category}
                            checked={selectedCategories.includes(category)}
                            onChange={() => handleCategoryToggle(category)}
                          />
                          <span>{category}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-circle btn-ghost text-base-content/70 hover:text-error transition-colors"
              id="close-search-dropdown"
              onClick={handleCloseDropdown}
            >
              <i className="ri-close-line text-lg" aria-hidden="true" />
              <span className="sr-only">关闭</span>
            </button>
          </div>
        </div>

        <div
          id="search-results"
          className="search-results-container p-4 max-h-[60vh] overflow-y-auto"
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <span className="loading loading-spinner loading-md mb-3" />
              <p className="text-base-content/70">搜索中...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <i
                className="ri-error-warning-line text-error text-4xl mx-auto mb-3 opacity-80"
                aria-hidden="true"
              />
              <p className="text-error">{error}</p>
            </div>
          ) : !hasSearched ? (
            <div className="text-base-content/70 text-center py-8">
              <i
                className="ri-search-eye-line text-4xl mx-auto mb-3 opacity-20"
                aria-hidden="true"
              />
              <p>请输入关键词开始搜索</p>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-8">
              <i
                className="ri-close-circle-line text-4xl mx-auto mb-3 opacity-20"
                aria-hidden="true"
              />
              <p className="text-base-content/70">没有匹配的结果</p>
            </div>
          ) : (
            results.map((result) => (
              <a
                key={result.url}
                href={result.url}
                className="search-result block p-3 mb-3 hover:bg-base-200 rounded-lg transition-colors duration-300 border-l-4 border-transparent hover:border-primary group"
              >
                <h3
                  className="font-semibold text-lg group-hover:text-primary transition-colors"
                  dangerouslySetInnerHTML={{
                    __html: highlightMatch(result.title, result.keywords),
                  }}
                />
                {result.snippet ? (
                  <p
                    className="text-base-content/80 mt-2 line-clamp-3"
                    dangerouslySetInnerHTML={{
                      __html: highlightMatch(result.snippet, result.keywords),
                    }}
                  />
                ) : null}
                <div className="flex flex-wrap gap-1 mt-3">
                  {result.categories.map((category) => (
                    <span
                      key={`${result.url}-category-${category}`}
                      className={`badge badge-neutral ${result.matchDetails.categories ? "badge-primary" : ""}`}
                      dangerouslySetInnerHTML={{
                        __html: highlightMatch(category, result.keywords),
                      }}
                    />
                  ))}
                  {result.tags.map((tag) => (
                    <span
                      key={`${result.url}-tag-${tag}`}
                      className={`badge badge-outline ${result.matchDetails.tags ? "text-primary border-primary" : ""}`}
                      dangerouslySetInnerHTML={{
                        __html: highlightMatch(tag, result.keywords),
                      }}
                    />
                  ))}
                </div>
              </a>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchBar;

import { useEffect, useMemo, useState } from "react";

type BlogPostMeta = {
  slug: string;
  title: string;
  description: string;
  categories: string[];
  tags: string[];
  words: number;
  readingMinutes: number;
  url: string;
  pubDate: string;
  coverImage?: string | null;
};

type FilterOptions = {
  categories: string[];
  tags: string[];
};

type Props = {
  posts: BlogPostMeta[];
  filterOptions?: FilterOptions;
};

type PageItem = number | "ellipsis-start" | "ellipsis-end";

const ITEMS_PER_PAGE_OPTIONS = [6, 9, 12];

const getPageItems = (current: number, total: number): PageItem[] => {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const pages: PageItem[] = [1];

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) {
    pages.push("ellipsis-start");
  }

  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  if (end < total - 1) {
    pages.push("ellipsis-end");
  }

  pages.push(total);
  return pages;
};

const BlogExplorer: React.FC<Props> = ({ posts, filterOptions }) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [itemsPerPage, setItemsPerPage] = useState<number>(
    ITEMS_PER_PAGE_OPTIONS[0],
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [isFilterModalOpen, setFilterModalOpen] = useState(false);
  const [draftCategory, setDraftCategory] = useState<string | null>(null);
  const [draftTags, setDraftTags] = useState<string[]>([]);

  const buildChipClass = (
    isActive: boolean,
    accent: "primary" | "secondary" = "primary",
  ) => {
    const base = "badge badge-lg transition-colors duration-200";
    const active =
      accent === "secondary"
        ? "badge-secondary font-medium shadow-sm"
        : "badge-primary font-medium shadow-sm";
    const inactive =
      accent === "secondary"
        ? "badge-outline border-dashed border-base-content/30 text-base-content/60 hover:badge-soft hover:badge-secondary hover:cursor-pointer"
        : "badge-outline border-dashed border-base-content/30 text-base-content/60 hover:badge-soft hover:badge-primary hover:cursor-pointer";

    return [base, isActive ? active : inactive].join(" ");
  };

  const { categories, tags } = useMemo(() => {
    if (filterOptions) {
      return filterOptions;
    }

    const categorySet = new Set<string>();
    const tagSet = new Set<string>();

    posts.forEach((post) => {
      post.categories.forEach((category) => {
        categorySet.add(category);
      });
      post.tags.forEach((tag) => {
        tagSet.add(tag);
      });
    });

    return {
      categories: Array.from(categorySet).sort((a, b) =>
        a.localeCompare(b, "zh-CN"),
      ),
      tags: Array.from(tagSet).sort((a, b) => a.localeCompare(b, "zh-CN")),
    };
  }, [filterOptions, posts]);

  const filtered = useMemo(() => {
    return posts.filter((post) => {
      const categoryMatches =
        !selectedCategory || post.categories.includes(selectedCategory);
      const tagsMatches =
        selectedTags.length === 0 ||
        selectedTags.every((tag) => post.tags.includes(tag));

      return categoryMatches && tagsMatches;
    });
  }, [posts, selectedCategory, selectedTags]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const currentItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage, itemsPerPage]);

  const applyFilters = (category: string | null, tags: string[]) => {
    setSelectedCategory(category);
    setSelectedTags(tags);
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    applyFilters(null, []);
    setDraftCategory(null);
    setDraftTags([]);
  };

  const handleRemoveTag = (tag: string) => {
    const nextTags = selectedTags.filter((item) => item !== tag);
    applyFilters(selectedCategory, nextTags);
  };

  const handleClearCategory = () => {
    applyFilters(null, selectedTags);
  };

  const openFilterModal = () => {
    setDraftCategory(selectedCategory);
    setDraftTags(selectedTags);
    setFilterModalOpen(true);
  };

  const closeFilterModal = () => {
    setFilterModalOpen(false);
  };

  const handleModalApply = () => {
    applyFilters(draftCategory, draftTags);
    setFilterModalOpen(false);
  };

  const handleModalReset = () => {
    setDraftCategory(null);
    setDraftTags([]);
  };

  const handleDraftCategoryToggle = (category: string | null) => {
    if (category === null) {
      setDraftCategory(null);
      return;
    }

    setDraftCategory((prev) => (prev === category ? null : category));
  };

  const handleDraftTagToggle = (tag: string) => {
    setDraftTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag],
    );
  };

  const activeFilterCount = (selectedCategory ? 1 : 0) + selectedTags.length;
  const hasActiveFilters = activeFilterCount > 0;

  return (
    <div className="space-y-8">
      <section className="bg-base-200/40 border border-base-content/10 rounded-2xl p-6 backdrop-blur-sm">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-linear-to-br from-primary/80 to-secondary/80 text-primary-content shadow-md">
                <i className="ri-article-line text-lg" aria-hidden="true" />
              </span>
              <span>博客总览</span>
            </h1>
            <p className="text-sm text-base-content/70 mt-2">
              总共 {posts.length} 篇文章，支持标签与分类组合筛选。
            </p>
          </div>
          <div className="flex items-center gap-3 self-start">
            <label className="flex items-center gap-2 text-sm border border-base-content/10 rounded-full pl-5 pr-3 shadow-sm">
              <i className="ri-layout-grid-line text-base" aria-hidden="true" />
              <select
                className="select select-sm select-ghost focus:outline-none"
                value={itemsPerPage}
                onChange={(event) =>
                  handleItemsPerPageChange(
                    Number.parseInt(event.target.value, 10),
                  )
                }
                aria-label="每页展示数量"
              >
                {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>

        <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2 text-sm">
            {selectedCategory ? (
              <button
                type="button"
                className="badge badge-lg badge-secondary gap-1"
                onClick={handleClearCategory}
              >
                <i className="ri-stack-line" aria-hidden="true" />
                {selectedCategory}
                <i className="ri-close-line text-xs" aria-hidden="true" />
              </button>
            ) : (
              <span className="badge badge-outline badge-lg border-dashed border-base-content/30 text-base-content/60">
                <i className="ri-stack-line" aria-hidden="true" />
                <span>全部分类</span>
              </span>
            )}

            {selectedTags.length > 0 ? (
              selectedTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="badge badge-outline badge-lg border-primary/40 text-primary gap-1"
                  onClick={() => handleRemoveTag(tag)}
                >
                  <i className="ri-price-tag-3-line" aria-hidden="true" />
                  {tag}
                  <i className="ri-close-line text-xs" aria-hidden="true" />
                </button>
              ))
            ) : (
              <span className="badge badge-outline badge-lg border-dashed border-base-content/30 text-base-content/60">
                <i className="ri-price-tag-3-line" aria-hidden="true" />
                <span>未选择标签</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto">
            {hasActiveFilters && (
              <button
                type="button"
                className="btn btn-sm btn-outline gap-2 rounded-full border-base-content/20"
                onClick={clearFilters}
              >
                <i className="ri-refresh-line" aria-hidden="true" />
                <span>清除筛选</span>
              </button>
            )}
            <button
              type="button"
              className="btn btn-sm btn-primary rounded-full gap-2 shadow-sm"
              onClick={openFilterModal}
            >
              <i className="ri-equalizer-line" aria-hidden="true" />
              {hasActiveFilters
                ? `调整筛选 · ${activeFilterCount}`
                : "选择筛选"}
            </button>
          </div>
        </div>
      </section>

      {isFilterModalOpen && (
        <dialog
          className="modal modal-bottom sm:modal-middle"
          open
          onCancel={(event) => {
            event.preventDefault();
            setFilterModalOpen(false);
          }}
          onClose={() => setFilterModalOpen(false)}
        >
          <div className="modal-box w-full max-w-2xl rounded-t-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <i
                  className="ri-equalizer-line text-primary"
                  aria-hidden="true"
                />
                筛选文章
              </h2>
              <button
                type="button"
                className="btn btn-sm btn-circle btn-ghost"
                onClick={closeFilterModal}
                aria-label="关闭筛选"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-1">
              <section>
                <h3 className="text-sm font-medium text-base-content/70 flex items-center gap-2">
                  <i className="ri-stack-line" aria-hidden="true" />
                  <span>分类</span>
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleDraftCategoryToggle(null)}
                    className={buildChipClass(
                      draftCategory === null,
                      "secondary",
                    )}
                  >
                    全部
                  </button>
                  {categories.map((category) => {
                    const isActive = draftCategory === category;
                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() => handleDraftCategoryToggle(category)}
                        className={buildChipClass(isActive, "secondary")}
                      >
                        {category}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <h3 className="text-sm font-medium text-base-content/70 flex items-center gap-2">
                  <i className="ri-price-tag-3-line" aria-hidden="true" />
                  <span>标签</span>
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {tags.length === 0 ? (
                    <span className="text-sm text-base-content/60">
                      暂无标签
                    </span>
                  ) : (
                    tags.map((tag) => {
                      const isActive = draftTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleDraftTagToggle(tag)}
                          className={buildChipClass(isActive)}
                        >
                          {tag}
                        </button>
                      );
                    })
                  )}
                </div>
              </section>
            </div>

            <div className="modal-action mt-6">
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  className="btn btn-soft rounded-xl"
                  onClick={handleModalReset}
                >
                  重置选择
                </button>
                <button
                  type="button"
                  className="btn btn-soft rounded-xl"
                  onClick={closeFilterModal}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="btn btn-primary rounded-xl"
                  onClick={handleModalApply}
                >
                  应用筛选
                </button>
              </div>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button type="submit" onClick={closeFilterModal}>
              close
            </button>
          </form>
        </dialog>
      )}

      <section className="space-y-6">
        {currentItems.length === 0 ? (
          <div className="text-center py-16 bg-base-200/40 border border-base-content/10 rounded-2xl">
            <i
              className="ri-search-eye-line text-5xl text-primary/40"
              aria-hidden="true"
            />
            <p className="mt-4 text-base-content/70">
              暂未找到符合筛选条件的文章。
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            {currentItems.map((post) => (
              <article
                key={post.slug}
                className="group relative bg-base-200/40 border border-base-content/10 rounded-2xl p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl"
              >
                <div className="flex flex-col h-full">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold group-hover:text-primary transition-colors">
                        <a href={post.url} className="stretched-link">
                          {post.title}
                        </a>
                      </h3>
                      <p className="mt-2 text-sm text-base-content/70 leading-relaxed line-clamp-3">
                        {post.description}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-xl bg-primary/10 text-primary text-xs font-medium px-3 py-1">
                      {new Date(post.pubDate).toLocaleDateString("zh-CN", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {post.categories.map((category) => (
                      <span
                        key={`${post.slug}-category-${category}`}
                        className="badge badge-secondary badge-outline whitespace-nowrap"
                      >
                        <i className="ri-stack-line mr-1" aria-hidden="true" />
                        {category}
                      </span>
                    ))}
                    {post.tags.map((tag) => (
                      <span
                        key={`${post.slug}-tag-${tag}`}
                        className="badge badge-outline whitespace-nowrap"
                      >
                        <i
                          className="ri-price-tag-3-line mr-1"
                          aria-hidden="true"
                        />
                        <span>{tag}</span>
                      </span>
                    ))}
                  </div>

                  <div className="mt-6 flex items-center justify-between text-sm text-base-content/70">
                    <span className="flex items-center gap-2">
                      <i
                        className="ri-book-open-line text-base"
                        aria-hidden="true"
                      />
                      <span>{post.words.toLocaleString()} 字</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <i
                        className="ri-time-line text-base"
                        aria-hidden="true"
                      />
                      <span>预计 {post.readingMinutes} 分钟</span>
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="bg-base-200/40 border border-base-content/10 rounded-2xl p-4 sm:p-6 backdrop-blur-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-sm text-base-content/70">
            <span>
              共 {filtered.length} 篇文章，当前第 {currentPage} / {totalPages}{" "}
              页
            </span>
          </div>
          <nav
            className="flex items-center gap-2 flex-wrap"
            aria-label="分页导航"
          >
            <button
              type="button"
              className="btn btn-sm btn-ghost rounded-full"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <i className="ri-arrow-left-line" aria-hidden="true" />
              <span>上一页</span>
            </button>
            {getPageItems(currentPage, totalPages).map((item) => {
              if (item === "ellipsis-start" || item === "ellipsis-end") {
                return (
                  <span key={item} className="px-2 text-base-content/50">
                    ···
                  </span>
                );
              }

              const isActive = currentPage === item;
              return (
                <button
                  key={`page-${item}`}
                  type="button"
                  className={`btn btn-sm rounded-full ${
                    isActive ? "btn-primary" : "btn-ghost"
                  }`}
                  onClick={() => setCurrentPage(item)}
                >
                  {item}
                </button>
              );
            })}
            <button
              type="button"
              className="btn btn-sm btn-ghost rounded-full"
              onClick={() =>
                setCurrentPage((prev) => Math.min(totalPages, prev + 1))
              }
              disabled={currentPage === totalPages}
            >
              <span>下一页</span>
              <i className="ri-arrow-right-line" aria-hidden="true" />
            </button>
          </nav>
        </div>
      </section>
    </div>
  );
};

export default BlogExplorer;

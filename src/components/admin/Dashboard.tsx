import type React from "react";
import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface StatsData {
  comments: { total: number; blog: number; telegram: number };
  likes: { total: number; posts: number; comments: number };
  sink: { totalViews: number };
}
interface ViewsData {
  time: string;
  visits: number;
  visitors: number;
}
interface MetricsData {
  name: string;
  count: number;
}
interface DailyViewsPoint {
  date: string;
  views: number;
}
interface PostStats {
  identifier: string;
  type: "blog" | "telegram";
  title: string;
  comments: number;
  likes: number;
  commentLikes: number;
  totalLikes: number;
  views: number;
}

const StatCard = ({
  title,
  value,
  details,
  icon,
}: {
  title: string;
  value: string | number;
  details: React.ReactNode;
  icon: string;
}) => (
  <div className="stat bg-base-200/60 backdrop-blur-sm border border-base-content/10 rounded-xl">
    <div className="stat-figure text-primary text-3xl">
      <i className={icon} />
    </div>
    <div className="stat-title">{title}</div>
    <div className="stat-value">{value}</div>
    <div className="stat-desc">{details}</div>
  </div>
);

const MetricsTable = ({
  title,
  data,
  icon,
}: {
  title: string;
  data: MetricsData[] | null;
  icon: string;
}) => (
  <div className="bg-base-200/60 backdrop-blur-sm border border-base-content/10 rounded-xl p-4">
    <h3 className="font-bold mb-2 flex items-center gap-2">
      <i className={icon} />
      {title}
    </h3>
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <tbody>
          {data && data.length > 0 ? (
            data.map((item) => {
              const key = item.name || "(Direct)";
              return (
                <tr key={key} className="border-b border-base-content/10">
                  <td className="truncate max-w-40">
                    {item.name || "(Direct)"}
                  </td>
                  <td className="text-right font-semibold">{item.count}</td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td>暂无数据</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [views, setViews] = useState<ViewsData[] | null>(null);
  const [viewsLoading, setViewsLoading] = useState(true);
  const [topReferers, setTopReferers] = useState<MetricsData[] | null>(null);
  const [topCountries, setTopCountries] = useState<MetricsData[] | null>(null);
  const [topOS, setTopOS] = useState<MetricsData[] | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [dailyViews, setDailyViews] = useState<DailyViewsPoint[] | null>(null);
  const [dailyViewsLoading, setDailyViewsLoading] = useState(true);
  const [postsStats, setPostsStats] = useState<PostStats[] | null>(null);
  const [postsStatsLoading, setPostsStatsLoading] = useState(true);
  const [dailyViewsDays, setDailyViewsDays] = useState(30);
  const [postsFilter, setPostsFilter] = useState<"all" | "blog" | "telegram">(
    "all",
  );
  const [showAllPosts, setShowAllPosts] = useState(false);

  const period = "last-7d";

  // 获取总览统计数据
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setStatsLoading(true);
        const response = await fetch("/api/admin/stats");
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setStatsLoading(false);
      }
    };
    fetchStats();
  }, []);

  // 获取访问趋势数据
  useEffect(() => {
    const fetchViews = async () => {
      try {
        setViewsLoading(true);
        const response = await fetch(
          `/api/admin/sink-details?report=views&unit=day&period=${period}`,
        );
        if (response.ok) {
          const data = await response.json();
          setViews(data.data);
        }
      } catch (error) {
        console.error("Failed to fetch views:", error);
      } finally {
        setViewsLoading(false);
      }
    };
    fetchViews();
  }, []);

  // 获取来源、国家、操作系统数据
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setMetricsLoading(true);
        const [referersRes, countriesRes, osRes] = await Promise.all([
          fetch(
            `/api/admin/sink-details?report=metrics&type=referer&limit=5&period=${period}`,
          ),
          fetch(
            `/api/admin/sink-details?report=metrics&type=country&limit=5&period=${period}`,
          ),
          fetch(
            `/api/admin/sink-details?report=metrics&type=os&limit=5&period=${period}`,
          ),
        ]);

        if (referersRes.ok) {
          const data = await referersRes.json();
          setTopReferers(data.data);
        }
        if (countriesRes.ok) {
          const data = await countriesRes.json();
          setTopCountries(data.data);
        }
        if (osRes.ok) {
          const data = await osRes.json();
          setTopOS(data.data);
        }
      } catch (error) {
        console.error("Failed to fetch metrics:", error);
      } finally {
        setMetricsLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  // 获取每日浏览量数据（支持时间范围切换）
  useEffect(() => {
    const fetchDailyViews = async () => {
      try {
        setDailyViewsLoading(true);
        const response = await fetch(
          `/api/admin/daily-views?days=${dailyViewsDays}`,
        );
        if (response.ok) {
          const data = await response.json();
          setDailyViews(data.data);
        }
      } catch (error) {
        console.error("Failed to fetch daily views:", error);
      } finally {
        setDailyViewsLoading(false);
      }
    };
    fetchDailyViews();
  }, [dailyViewsDays]);

  // 获取文章统计数据
  useEffect(() => {
    const fetchPostsStats = async () => {
      try {
        setPostsStatsLoading(true);
        const response = await fetch("/api/admin/posts-stats");
        if (response.ok) {
          const data = await response.json();
          setPostsStats(data.data);
        }
      } catch (error) {
        console.error("Failed to fetch posts stats:", error);
      } finally {
        setPostsStatsLoading(false);
      }
    };
    fetchPostsStats();
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">管理后台</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statsLoading ? (
          <>
            <div className="stat bg-base-200/60 backdrop-blur-sm border border-base-content/10 rounded-xl">
              <div className="stat-title">总评论数</div>
              <div className="stat-value">
                <span className="loading loading-spinner loading-md" />
              </div>
            </div>
            <div className="stat bg-base-200/60 backdrop-blur-sm border border-base-content/10 rounded-xl">
              <div className="stat-title">总点赞数</div>
              <div className="stat-value">
                <span className="loading loading-spinner loading-md" />
              </div>
            </div>
            <div className="stat bg-base-200/60 backdrop-blur-sm border border-base-content/10 rounded-xl">
              <div className="stat-title">短链总访问量</div>
              <div className="stat-value">
                <span className="loading loading-spinner loading-md" />
              </div>
            </div>
          </>
        ) : (
          stats && (
            <>
              <StatCard
                title="总评论数"
                value={stats.comments.total}
                details={
                  <>
                    博客:
                    {stats.comments.blog} | 动态:
                    {stats.comments.telegram}
                  </>
                }
                icon="ri-chat-3-line"
              />
              <StatCard
                title="总点赞数"
                value={stats.likes.total}
                details={
                  <>
                    内容:
                    {stats.likes.posts} | 评论:
                    {stats.likes.comments}
                  </>
                }
                icon="ri-heart-3-line"
              />
              <StatCard
                title="短链总访问量"
                value={stats.sink.totalViews}
                details="来自 saro.pub 的统计"
                icon="ri-links-line"
              />
            </>
          )
        )}
      </div>

      <div className="divider my-8 flex items-center gap-2">
        <i className="ri-bar-chart-2-line text-lg" />
        访问趋势
      </div>

      <div className="bg-base-200/60 backdrop-blur-sm border border-base-content/10 rounded-xl p-4 mb-6">
        <h3 className="font-bold mb-4 flex items-center gap-2">
          <i className="ri-pulse-line" />
          访问趋势
        </h3>
        {viewsLoading ? (
          <div className="flex justify-center items-center h-[300px]">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : views ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={views}
              margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-base-content)"
                strokeOpacity={0.5}
              />
              <XAxis
                dataKey="time"
                stroke="var(--color-base-content)"
                tickFormatter={(timeStr) => {
                  const date = new Date(timeStr);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis stroke="var(--color-base-content)" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--color-base-100)",
                  backdropFilter: "blur(4px)",
                  border: "1px solid var(--color-base-content)",
                  borderRadius: "0.5rem",
                  opacity: 0.9,
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="visits"
                name="访问量"
                stroke="var(--color-success)"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="visitors"
                name="访客数"
                stroke="var(--color-info)"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p>无法加载图表数据。</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {metricsLoading ? (
          <>
            <div className="bg-base-200/60 backdrop-blur-sm border border-base-content/10 rounded-xl p-4">
              <h3 className="font-bold mb-2">Top 5 来源</h3>
              <div className="flex justify-center items-center h-[200px]">
                <span className="loading loading-spinner" />
              </div>
            </div>
            <div className="bg-base-200/60 backdrop-blur-sm border border-base-content/10 rounded-xl p-4">
              <h3 className="font-bold mb-2">Top 5 国家</h3>
              <div className="flex justify-center items-center h-[200px]">
                <span className="loading loading-spinner" />
              </div>
            </div>
            <div className="bg-base-200/60 backdrop-blur-sm border border-base-content/10 rounded-xl p-4">
              <h3 className="font-bold mb-2">Top 5 操作系统</h3>
              <div className="flex justify-center items-center h-[200px]">
                <span className="loading loading-spinner" />
              </div>
            </div>
          </>
        ) : (
          <>
            <MetricsTable
              title="Top 5 来源"
              data={topReferers}
              icon="ri-global-line"
            />
            <MetricsTable
              title="Top 5 国家"
              data={topCountries}
              icon="ri-earth-line"
            />
            <MetricsTable
              title="Top 5 操作系统"
              data={topOS}
              icon="ri-computer-line"
            />
          </>
        )}
      </div>

      <div className="divider my-8 flex items-center gap-2">
        <i className="ri-bar-chart-line text-lg" />
        每日浏览量
      </div>

      <div className="bg-base-200/60 backdrop-blur-sm border border-base-content/10 rounded-xl p-4 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold flex items-center gap-2">
            <i className="ri-line-chart-line" />
            每日博客浏览量
          </h3>
          <select
            className="select select-sm select-bordered"
            value={dailyViewsDays}
            onChange={(e) =>
              setDailyViewsDays(Number.parseInt(e.target.value, 10))
            }
          >
            <option value={7}>最近 7 天</option>
            <option value={30}>最近 30 天</option>
            <option value={90}>最近 90 天</option>
          </select>
        </div>
        {dailyViewsLoading ? (
          <div className="flex justify-center items-center h-[300px]">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : dailyViews && dailyViews.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={dailyViews}
              margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-base-content)"
                strokeOpacity={0.5}
              />
              <XAxis
                dataKey="date"
                stroke="var(--color-base-content)"
                tickFormatter={(dateStr) => {
                  const date = new Date(dateStr);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis stroke="var(--color-base-content)" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--color-base-100)",
                  backdropFilter: "blur(4px)",
                  border: "1px solid var(--color-base-content)",
                  borderRadius: "0.5rem",
                  opacity: 0.9,
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="views"
                name="浏览量"
                stroke="var(--color-primary)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p>无法加载每日浏览量数据。</p>
        )}
      </div>

      <div className="divider my-8 flex items-center gap-2">
        <i className="ri-file-chart-line text-lg" />
        内容统计
      </div>

      <div className="bg-base-200/60 backdrop-blur-sm border border-base-content/10 rounded-xl p-4 mb-6">
        <h3 className="font-bold mb-4 flex items-center gap-2">
          <i className="ri-file-list-3-line" />
          各内容互动与浏览统计
        </h3>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 text-sm">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`btn btn-xs ${postsFilter === "all" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setPostsFilter("all")}
            >
              <i className="ri-apps-2-line mr-1" />
              全部
            </button>
            <button
              type="button"
              className={`btn btn-xs ${postsFilter === "blog" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setPostsFilter("blog")}
            >
              <i className="ri-article-line mr-1" />
              博客
            </button>
            <button
              type="button"
              className={`btn btn-xs ${postsFilter === "telegram" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setPostsFilter("telegram")}
            >
              <i className="ri-message-3-line mr-1" />
              动态
            </button>
          </div>
          {postsStats && postsStats.length > 12 && (
            <button
              type="button"
              className="btn btn-ghost btn-xs flex items-center gap-1"
              onClick={() => setShowAllPosts((v) => !v)}
            >
              <i className={showAllPosts ? "ri-eye-off-line" : "ri-eye-line"} />
              {showAllPosts ? "只看前 12 条" : "显示全部"}
            </button>
          )}
        </div>
        {postsStatsLoading ? (
          <div className="flex justify-center items-center h-[300px]">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : postsStats && postsStats.length > 0 ? (
          (() => {
            const filtered = postsStats.filter((post) =>
              postsFilter === "all" ? true : post.type === postsFilter,
            );
            const visible = showAllPosts ? filtered : filtered.slice(0, 12);
            const totalCount = filtered.length;
            return (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {visible.map((post) => {
                    const totalInteraction = post.comments + post.totalLikes;
                    return (
                      <a
                        key={`${post.type}-${post.identifier}`}
                        href={`/${post.type === "telegram" ? "post" : "blog"}/${post.identifier}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group bg-base-100/80 hover:bg-base-100 border border-base-content/10 hover:border-primary/30 rounded-lg p-3 transition-all duration-200 hover:shadow-md"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <span
                            className={`badge badge-sm flex items-center gap-1 badge-outline ${post.type === "blog" ? "badge-primary" : "badge-secondary"}`}
                          >
                            <i
                              className={
                                post.type === "blog"
                                  ? "ri-article-line"
                                  : "ri-message-3-line"
                              }
                            />
                            <span>
                              {post.type === "blog" ? "博客" : "动态"}
                            </span>
                          </span>
                          <span className="text-xs font-bold opacity-80 flex items-center gap-1">
                            <i className="ri-fire-line text-warning" />
                            {totalInteraction}
                          </span>
                        </div>
                        <h4 className="font-semibold text-sm mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                          {post.title}
                        </h4>
                        <div className="flex flex-wrap gap-3 text-xs">
                          {post.type === "blog" && (
                            <div className="flex items-center gap-1 text-base-content/70">
                              <i className="ri-eye-line text-primary" />
                              <span>{post.views}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1 text-base-content/70">
                            <i className="ri-chat-3-line text-info" />
                            <span>{post.comments}</span>
                          </div>
                          <div className="flex items-center gap-1 text-base-content/70">
                            <i className="ri-heart-3-line text-error" />
                            <span>{post.totalLikes}</span>
                          </div>
                          {post.commentLikes > 0 && (
                            <div className="flex items-center gap-1 text-base-content/70">
                              <i className="ri-heart-add-line text-warning" />
                              <span>{post.commentLikes}</span>
                            </div>
                          )}
                        </div>
                      </a>
                    );
                  })}
                </div>
                {totalCount > 12 && !showAllPosts && (
                  <div className="text-center mt-4 text-sm opacity-60 flex items-center justify-center gap-1">
                    <i className="ri-information-line" />
                    仅显示前 12 条，共{" "}
                    <span className="font-semibold">{totalCount}</span> 条记录
                  </div>
                )}
              </>
            );
          })()
        ) : (
          <div className="text-center py-8 text-base-content/50">
            <i className="ri-inbox-line text-4xl mb-2 block" />
            <p>暂无数据</p>
          </div>
        )}
      </div>

      <div className="divider my-8 flex items-center gap-2">
        <i className="ri-rocket-2-line text-lg" />
        快捷入口
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <a
          href="/admin/comments"
          className="btn btn-lg h-auto py-4 flex-col justify-start items-start text-left bg-base-200/60 backdrop-blur-sm border border-base-content/10 rounded-xl"
        >
          <div className="flex items-center gap-2 font-bold text-lg">
            <i className="ri-chat-settings-line" />
            评论管理
          </div>
          <p className="text-xs font-normal opacity-70 mt-1">
            管理、审核和删除所有页面的评论。
          </p>
        </a>
        <div className="btn btn-lg h-auto py-4 flex-col justify-start items-start text-left rounded-xl btn-disabled">
          <div className="flex items-center gap-2 font-bold text-lg">
            <i className="ri-bar-chart-box-line" />
            更多统计
          </div>
          <p className="text-xs font-normal opacity-70 mt-1">
            功能正在开发中...
          </p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

import React, { useEffect, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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

const StatCard = ({ title, value, details, icon }: { title: string; value: string | number; details: React.ReactNode; icon: string }) => (
  <div className="stat bg-base-200/60 backdrop-blur-sm border border-base-content/10 rounded-xl">
    <div className="stat-figure text-primary text-3xl"><i className={icon}></i></div>
    <div className="stat-title">{title}</div>
    <div className="stat-value">{value}</div>
    <div className="stat-desc">{details}</div>
  </div>
);

const MetricsTable = ({ title, data, icon }: { title: string; data: MetricsData[] | null; icon: string }) => (
  <div className="bg-base-200/60 backdrop-blur-sm border border-base-content/10 rounded-xl p-4">
    <h3 className="font-bold mb-2 flex items-center gap-2">
      <i className={icon}></i>
      {title}
    </h3>
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <tbody>
          {data && data.length > 0
            ? data.map((item, index) => (
                <tr key={index} className="border-b border-base-content/10">
                  <td className="truncate max-w-40">{item.name || "(Direct)"}</td>
                  <td className="text-right font-semibold">{item.count}</td>
                </tr>
              ))
            : <tr><td>暂无数据</td></tr>}
        </tbody>
      </table>
    </div>
  </div>
);

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [views, setViews] = useState<ViewsData[] | null>(null);
  const [topReferers, setTopReferers] = useState<MetricsData[] | null>(null);
  const [topCountries, setTopCountries] = useState<MetricsData[] | null>(null);
  const [topOS, setTopOS] = useState<MetricsData[] | null>(null);
  const [loading, setLoading] = useState(true);

  const period = "last-7d";

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true);

        // 1. 获取总览数据 (不带时间参数，获取所有时间)
        const statsPromise = fetch("/api/admin/stats").then((res) => res.ok ? res.json() : null);

        // 2. 获取详细数据 (全部带上 period 参数)
        const viewsPromise = fetch(`/api/admin/sink-details?report=views&unit=day&period=${period}`).then((res) => res.ok ? res.json() : null);
        const referersPromise = fetch(`/api/admin/sink-details?report=metrics&type=referer&limit=5&period=${period}`).then((res) => res.ok ? res.json() : null);
        const countriesPromise = fetch(`/api/admin/sink-details?report=metrics&type=country&limit=5&period=${period}`).then((res) => res.ok ? res.json() : null);
        const osPromise = fetch(`/api/admin/sink-details?report=metrics&type=os&limit=5&period=${period}`).then((res) => res.ok ? res.json() : null);

        // 并行等待所有请求完成
        const [
          statsData,
          viewsData,
          referersData,
          countriesData,
          osData,
        ] = await Promise.all([
          statsPromise,
          viewsPromise,
          referersPromise,
          countriesPromise,
          osPromise,
        ]);

        // 更新状态
        if (statsData)
          setStats(statsData);
        if (viewsData)
          setViews(viewsData.data);
        if (referersData)
          setTopReferers(referersData.data);
        if (countriesData)
          setTopCountries(countriesData.data);
        if (osData)
          setTopOS(osData.data);
      }
      catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      }
      finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, [period]);

  if (loading) {
    return <div className="text-center p-20"><span className="loading loading-dots loading-lg"></span></div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">管理后台</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats && (
          <>
            <StatCard
              title="总评论数"
              value={stats.comments.total}
              details={(
                <>
                  博客:
                  {stats.comments.blog}
                  {" "}
                  | 动态:
                  {stats.comments.telegram}
                </>
              )}
              icon="ri-chat-3-line"
            />
            <StatCard
              title="总点赞数"
              value={stats.likes.total}
              details={(
                <>
                  内容:
                  {stats.likes.posts}
                  {" "}
                  | 评论:
                  {stats.likes.comments}
                </>
              )}
              icon="ri-heart-3-line"
            />
            <StatCard title="短链总访问量" value={stats.sink.totalViews} details="来自 saro.pub 的统计" icon="ri-links-line" />
          </>
        )}
      </div>

      <div className="divider my-8">最近 7 天详细统计</div>

      <div className="bg-base-200/60 backdrop-blur-sm border border-base-content/10 rounded-xl p-4 mb-6">
        <h3 className="font-bold mb-4">访问趋势</h3>
        {views
          ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={views} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-base-content)" strokeOpacity={0.5} />
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
                  <Line type="monotone" dataKey="visits" name="访问量" stroke="var(--color-success)" strokeWidth={2} />
                  <Line type="monotone" dataKey="visitors" name="访客数" stroke="var(--color-info)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )
          : <p>无法加载图表数据。</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricsTable title="Top 5 来源" data={topReferers} icon="ri-global-line" />
        <MetricsTable title="Top 5 国家" data={topCountries} icon="ri-earth-line" />
        <MetricsTable title="Top 5 操作系统" data={topOS} icon="ri-computer-line" />
      </div>
      <div className="divider my-8">快捷入口</div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <a href="/admin/comments" className="btn btn-lg h-auto py-4 flex-col justify-start items-start text-left bg-base-200/60 backdrop-blur-sm border border-base-content/10 rounded-xl">
          <div className="flex items-center gap-2 font-bold text-lg">
            <i className="ri-chat-settings-line"></i>
            评论管理
          </div>
          <p className="text-xs font-normal opacity-70 mt-1">管理、审核和删除所有页面的评论。</p>
        </a>
        <div className="btn btn-lg h-auto py-4 flex-col justify-start items-start text-left rounded-xl btn-disabled">
          <div className="flex items-center gap-2 font-bold text-lg">
            <i className="ri-bar-chart-box-line"></i>
            更多统计
          </div>
          <p className="text-xs font-normal opacity-70 mt-1">功能正在开发中...</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

import type React from "react";
import { useCallback, useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface SystemMonitorData {
  health: {
    score: number;
    status: "healthy" | "warning" | "critical";
    details: string[];
  };
  mongodb: {
    status: "connected" | "disconnected";
    latency: number;
    collections: {
      name: string;
      count: number;
    }[];
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  services: {
    mongodb: boolean;
    telegram: boolean;
    sink: boolean;
  };
}

interface LatencyPoint {
  time: string;
  latency: number;
}

const SystemMonitor: React.FC = () => {
  const [systemData, setSystemData] = useState<SystemMonitorData | null>(null);
  const [latencyHistory, setLatencyHistory] = useState<LatencyPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const formatTime = useCallback((date: Date) => {
    return date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }, []);

  const fetchSystemData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/system-monitor");
      if (!response.ok) {
        throw new Error("无法获取系统监控数据");
      }

      const data: SystemMonitorData = await response.json();
      setSystemData(data);

      // Update latency history
      const now = new Date();
      const timeStr = formatTime(now);
      setLatencyHistory((prev) => {
        const newHistory = [
          ...prev,
          { time: timeStr, latency: data.mongodb.latency },
        ];
        // Keep only last 20 points
        if (newHistory.length > 20) {
          return newHistory.slice(newHistory.length - 20);
        }
        return newHistory;
      });
    } catch (error) {
      console.error("Error fetching system data:", error);
      toast.error("获取系统监控数据失败");
    } finally {
      setLoading(false);
    }
  }, [formatTime]);

  useEffect(() => {
    fetchSystemData();
  }, [fetchSystemData]);

  useEffect(() => {
    let interval: number | undefined;
    if (autoRefresh) {
      interval = window.setInterval(() => {
        fetchSystemData();
      }, 5000);
    }
    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [autoRefresh, fetchSystemData]);

  const getHealthColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "text-success";
      case "warning":
        return "text-warning";
      case "critical":
        return "text-error";
      default:
        return "text-base-content";
    }
  };

  const getServiceStatus = (active: boolean) => {
    return active ? (
      <span className="text-success">● 正常</span>
    ) : (
      <span className="text-error">● 未配置</span>
    );
  };

  const totalComments =
    systemData?.mongodb.collections
      .filter((c) => c.name === "comments" || c.name === "telegram_comments")
      .reduce((sum, c) => sum + c.count, 0) || 0;

  const totalCommentLikes =
    systemData?.mongodb.collections
      .filter(
        (c) =>
          c.name === "comment_likes" || c.name === "telegram_comment_likes",
      )
      .reduce((sum, c) => sum + c.count, 0) || 0;

  const totalPostLikes =
    systemData?.mongodb.collections.find((c) => c.name === "post_likes")
      ?.count || 0;

  const totalLikes = totalCommentLikes + totalPostLikes;

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-base-content">系统监控</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fetchSystemData()}
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? "刷新中..." : "手动刷新"}
          </button>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="toggle"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span>自动刷新 (5秒)</span>
          </label>
        </div>
      </div>

      {/* Health Status */}
      {systemData && (
        <div className="stats shadow bg-base-200/60 backdrop-blur-sm border border-base-content/10">
          <div className="stat">
            <div className="stat-title">系统健康度</div>
            <div
              className={`stat-value text-5xl ${getHealthColor(systemData.health.status)}`}
            >
              {systemData.health.score}%
            </div>
            <div className="stat-desc">
              状态:{" "}
              <span className={getHealthColor(systemData.health.status)}>
                {systemData.health.status === "healthy"
                  ? "良好"
                  : systemData.health.status === "warning"
                    ? "警告"
                    : "严重"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Health Issues */}
      {systemData?.health.details && systemData.health.details.length > 0 && (
        <div className="alert alert-warning bg-base-200/60 backdrop-blur-sm border border-base-content/10">
          <div>
            <h3 className="font-bold text-warning">检测到以下问题：</h3>
            <ul className="list-disc list-inside mt-2">
              {systemData.health.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      {systemData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="stat bg-base-200/60 backdrop-blur-sm border border-base-content/10 rounded-lg">
            <div className="stat-title">数据库延迟</div>
            <div className="stat-value">{systemData.mongodb.latency}ms</div>
            <div className="stat-desc">
              状态:{" "}
              {systemData.mongodb.status === "connected" ? "正常" : "断开"}
            </div>
          </div>

          <div className="stat bg-base-200/60 backdrop-blur-sm border border-base-content/10 rounded-lg">
            <div className="stat-title">总评论数</div>
            <div className="stat-value">{totalComments.toLocaleString()}</div>
            <div className="stat-desc">包括博客和动态评论</div>
          </div>

          <div className="stat bg-base-200/60 backdrop-blur-sm border border-base-content/10 rounded-lg">
            <div className="stat-title">总点赞数</div>
            <div className="stat-value">{totalLikes.toLocaleString()}</div>
            <div className="stat-desc">文章和评论点赞</div>
          </div>

          <div className="stat bg-base-200/60 backdrop-blur-sm border border-base-content/10 rounded-lg">
            <div className="stat-title">内存使用</div>
            <div className="stat-value">{systemData.memory.percentage}%</div>
            <div className="stat-desc">
              {systemData.memory.used}MB / {systemData.memory.total}MB
            </div>
          </div>
        </div>
      )}

      {/* Latency Chart */}
      <div className="bg-base-200/60 backdrop-blur-sm border border-base-content/10 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">MongoDB 响应时间趋势</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={latencyHistory}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="time"
                tick={{ fill: "var(--color-base-content)", fontSize: 12 }}
              />
              <YAxis
                tick={{ fill: "var(--color-base-content)", fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(var(--color-base-200), 0.9)",
                  border: "1px solid rgba(var(--color-base-content), 0.1)",
                  backdropFilter: "blur(10px)",
                }}
              />
              <Line
                type="monotone"
                dataKey="latency"
                stroke="var(--color-primary)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Service Status */}
      <div className="bg-base-200/60 backdrop-blur-sm border border-base-content/10 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">服务状态</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center justify-between p-4 bg-base-100/50 rounded-lg">
            <div>
              <h3 className="font-semibold">MongoDB</h3>
              <p className="text-sm text-base-content/70">数据库服务</p>
            </div>
            {getServiceStatus(systemData?.services.mongodb || false)}
          </div>

          <div className="flex items-center justify-between p-4 bg-base-100/50 rounded-lg">
            <div>
              <h3 className="font-semibold">Telegram</h3>
              <p className="text-sm text-base-content/70">Telegram 集成</p>
            </div>
            {getServiceStatus(systemData?.services.telegram || false)}
          </div>

          <div className="flex items-center justify-between p-4 bg-base-100/50 rounded-lg">
            <div>
              <h3 className="font-semibold">Sink</h3>
              <p className="text-sm text-base-content/70">统计服务</p>
            </div>
            {getServiceStatus(systemData?.services.sink || false)}
          </div>
        </div>
      </div>

      {/* Collections Table */}
      <div className="bg-base-200/60 backdrop-blur-sm border border-base-content/10 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">集合统计</h2>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>集合名称</th>
                <th>文档数量</th>
                <th>描述</th>
              </tr>
            </thead>
            <tbody>
              {systemData?.mongodb.collections.map((collection) => (
                <tr key={collection.name}>
                  <td className="font-mono text-sm">{collection.name}</td>
                  <td>{collection.count.toLocaleString()}</td>
                  <td className="text-sm">
                    {collection.name === "comments" && "博客评论"}
                    {collection.name === "telegram_comments" &&
                      "Telegram 动态评论"}
                    {collection.name === "comment_likes" && "博客评论点赞"}
                    {collection.name === "telegram_comment_likes" &&
                      "Telegram 评论点赞"}
                    {collection.name === "post_likes" && "文章点赞"}
                    {collection.name === "post_views" && "文章浏览统计"}
                    {collection.name === "daily_views" && "每日浏览统计"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SystemMonitor;

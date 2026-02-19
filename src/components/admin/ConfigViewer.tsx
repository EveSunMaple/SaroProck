import type React from "react";
import { useCallback, useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";

interface ConfigInfo {
  environment: {
    nodeVersion: string;
    platform: string;
    deployment: string;
  };
  services: {
    mongodb: {
      configured: boolean;
      connected: boolean;
      uri: string;
    };
    telegram_scraper: {
      channel: boolean;
      accessible: boolean;
    };
    sink: {
      configured: boolean;
      reachable: boolean;
    };
  };
  features: {
    comments: boolean;
    likes: boolean;
    telegram: boolean;
    analytics: boolean;
  };
  security: {
    jwtSecret: boolean;
    adminConfigured: boolean;
  };
}

interface ServiceStatus {
  name: string;
  icon: string;
  status: "good" | "warning" | "error";
  details: string;
}

const ConfigViewer: React.FC = () => {
  const [config, setConfig] = useState<ConfigInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/config");
      if (!response.ok) {
        throw new Error("无法获取配置信息");
      }
      const data: ConfigInfo = await response.json();
      setConfig(data);
    } catch (error) {
      console.error("Error fetching config:", error);
      toast.error("获取配置信息失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const runTests = async () => {
    setTesting(true);
    try {
      const response = await fetch("/api/admin/config?test=true");
      if (!response.ok) {
        throw new Error("测试失败");
      }
      const data: ConfigInfo = await response.json();
      setConfig(data);
      toast.success("连接测试完成");
    } catch (error) {
      console.error("Test error:", error);
      toast.error("测试失败");
    } finally {
      setTesting(false);
    }
  };

  const getStatusBadge = (active: boolean) => {
    return active ? (
      <span className="inline-flex items-center gap-1 text-success">
        <i className="ri-checkbox-circle-line" />
        已配置
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-error">
        <i className="ri-close-circle-line" />
        未配置
      </span>
    );
  };

  const getServiceStatuses = (): ServiceStatus[] => {
    if (!config) return [];
    return [
      {
        name: "MongoDB",
        icon: "ri-database-2-line",
        status: config.services.mongodb.connected ? "good" : "error",
        details: config.services.mongodb.uri,
      },
      {
        name: "Telegram Scraper",
        icon: "ri-telegram-line",
        status: config.services.telegram_scraper.accessible
          ? "good"
          : config.services.telegram_scraper.channel
            ? "warning"
            : "error",
        details: config.services.telegram_scraper.accessible
          ? "可访问"
          : config.services.telegram_scraper.channel
            ? "频道已配置"
            : "频道未配置",
      },
      {
        name: "Statistics Service",
        icon: "ri-bar-chart-line",
        status: config.services.sink.reachable
          ? "good"
          : config.services.sink.configured
            ? "warning"
            : "error",
        details: config.services.sink.configured
          ? config.services.sink.reachable
            ? "服务可达"
            : "服务不可达"
          : "服务未配置",
      },
      {
        name: "JWT Secret",
        icon: "ri-key-2-line",
        status: config.security.jwtSecret ? "good" : "error",
        details: "API 认证密钥",
      },
    ];
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="text-center py-16 text-error">
        <i className="ri-error-warning-line text-4xl mb-4" />
        <p>无法加载配置信息</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-base-content">系统配置</h1>
          <p className="text-base-content/60 mt-2">查看系统配置和服务状态</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={runTests}
          disabled={testing}
        >
          {testing ? (
            <>
              <span className="loading loading-spinner loading-sm" />
              测试中...
            </>
          ) : (
            <>
              <i className="ri-refresh-line mr-2" />
              重新测试
            </>
          )}
        </button>
      </div>

      {/* Environment Info */}
      <div className="bg-base-200/60 backdrop-blur-sm border border-base-content/10 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <i className="ri-computer-line text-primary" />
          环境信息
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="stat bg-base-100/40 rounded-lg">
            <div className="stat-title">Node.js 版本</div>
            <div className="stat-value text-lg">
              {config.environment.nodeVersion}
            </div>
          </div>
          <div className="stat bg-base-100/40 rounded-lg">
            <div className="stat-title">操作系统</div>
            <div className="stat-value text-lg capitalize">
              {config.environment.platform}
            </div>
          </div>
          <div className="stat bg-base-100/40 rounded-lg">
            <div className="stat-title">部署平台</div>
            <div className="stat-value text-lg">
              {config.environment.deployment}
            </div>
          </div>
        </div>
      </div>

      {/* Service Status */}
      <div className="bg-base-200/60 backdrop-blur-sm border border-base-content/10 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <i className="ri-service-line text-primary" />
          服务状态
        </h2>
        <div className="space-y-4">
          {getServiceStatuses().map((service) => (
            <div
              key={service.name}
              className="flex items-center justify-between p-4 bg-base-100/40 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <i className={`${service.icon} text-xl text-primary`} />
                <div>
                  <h3 className="font-semibold">{service.name}</h3>
                  <p className="text-sm text-base-content/70 font-mono">
                    {service.details}
                  </p>
                </div>
              </div>
              <div>
                {service.status === "good" ? (
                  <span className="inline-flex items-center gap-1 text-success">
                    <i className="ri-checkbox-circle-line" />
                    正常
                  </span>
                ) : service.status === "warning" ? (
                  <span className="inline-flex items-center gap-1 text-warning">
                    <i className="ri-alert-line" />
                    警告
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-error">
                    <i className="ri-close-circle-line" />
                    错误
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Feature Status */}
      <div className="bg-base-200/60 backdrop-blur-sm border border-base-content/10 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <i className="ri-toggles-line text-primary" />
          功能状态
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-base-100/40 rounded-lg">
            <i className="ri-chat-3-line text-2xl text-primary mb-2" />
            <h3 className="font-semibold">评论系统</h3>
            {getStatusBadge(config.features.comments)}
          </div>
          <div className="text-center p-4 bg-base-100/40 rounded-lg">
            <i className="ri-heart-line text-2xl text-primary mb-2" />
            <h3 className="font-semibold">点赞功能</h3>
            {getStatusBadge(config.features.likes)}
          </div>
          <div className="text-center p-4 bg-base-100/40 rounded-lg">
            <i className="ri-telegram-line text-2xl text-primary mb-2" />
            <h3 className="font-semibold">Telegram 集成</h3>
            {getStatusBadge(config.features.telegram)}
          </div>
          <div className="text-center p-4 bg-base-100/40 rounded-lg">
            <i className="ri-bar-chart-line text-2xl text-primary mb-2" />
            <h3 className="font-semibold">统计分析</h3>
            {getStatusBadge(config.features.analytics)}
          </div>
        </div>
      </div>

      {/* Security Info */}
      <div className="bg-base-200/60 backdrop-blur-sm border border-base-content/10 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <i className="ri-shield-check-line text-primary" />
          安全设置
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-base-100/40 rounded-lg">
            <div>
              <h3 className="font-semibold">JWT 密钥</h3>
              <p className="text-sm text-base-content/70">API 认证和会话管理</p>
            </div>
            {getStatusBadge(config.security.jwtSecret)}
          </div>
          <div className="flex items-center justify-between p-4 bg-base-100/40 rounded-lg">
            <div>
              <h3 className="font-semibold">管理员账户</h3>
              <p className="text-sm text-base-content/70">后台管理访问权限</p>
            </div>
            {getStatusBadge(config.security.adminConfigured)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfigViewer;

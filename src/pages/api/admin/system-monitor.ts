import type { APIContext } from "astro";
import { getAdminUser } from "@/lib/auth";
import { getCollection } from "@/lib/mongodb.server";

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

export async function GET(context: APIContext): Promise<Response> {
  const adminUser = getAdminUser(context);
  if (!adminUser) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 403,
    });
  }

  try {
    const monitorData: SystemMonitorData = {
      health: {
        score: 100,
        status: "healthy",
        details: [],
      },
      mongodb: {
        status: "connected",
        latency: 0,
        collections: [],
      },
      memory: {
        used: 0,
        total: 0,
        percentage: 0,
      },
      services: {
        mongodb: false,
        telegram: false,
        sink: false,
      },
    };

    // Test MongoDB latency
    const mongoStart = Date.now();
    try {
      await Promise.all([
        getCollection("comments").then((c) => c.countDocuments()),
        getCollection("telegram_comments").then((c) => c.countDocuments()),
        getCollection("comment_likes").then((c) => c.countDocuments()),
        getCollection("telegram_comment_likes").then((c) => c.countDocuments()),
        getCollection("post_likes").then((c) => c.countDocuments()),
        getCollection("post_views").then((c) => c.countDocuments()),
        getCollection("daily_views").then((c) => c.countDocuments()),
      ]);
      monitorData.mongodb.latency = Date.now() - mongoStart;
      monitorData.services.mongodb = true;
    } catch (_error) {
      monitorData.mongodb.status = "disconnected";
      monitorData.health.score -= 30;
      monitorData.health.details.push("MongoDB connection failed");
    }

    // Get collection statistics
    const collections = [
      "comments",
      "telegram_comments",
      "comment_likes",
      "telegram_comment_likes",
      "post_likes",
      "post_views",
      "daily_views",
    ];

    for (const collectionName of collections) {
      try {
        const collection = await getCollection(collectionName as any);
        const count = await collection.countDocuments();
        monitorData.mongodb.collections.push({
          name: collectionName,
          count,
        });
      } catch (error) {
        console.error(`Error getting collection ${collectionName}:`, error);
      }
    }

    // Memory usage
    const memUsage = process.memoryUsage();
    monitorData.memory = {
      used: Math.round(memUsage.heapUsed / 1024 / 1024),
      total: Math.round(memUsage.heapTotal / 1024 / 1024),
      percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
    };

    if (monitorData.memory.percentage > 80) {
      monitorData.health.score -= 10;
      monitorData.health.details.push("High memory usage");
    }

    // Service checks
    monitorData.services.telegram = !!import.meta.env.CHANNEL;
    monitorData.services.sink = !!(
      import.meta.env.SINK_PUBLIC_URL && import.meta.env.SINK_API_KEY
    );

    if (!monitorData.services.telegram) {
      monitorData.health.score -= 5;
      monitorData.health.details.push("Telegram CHANNEL not configured");
    }
    if (!monitorData.services.sink) {
      monitorData.health.score -= 5;
      monitorData.health.details.push("Sink service not configured");
    }

    if (monitorData.mongodb.latency > 200) {
      monitorData.health.score -= 10;
      monitorData.health.details.push("High MongoDB latency");
    }

    // Determine overall health status
    if (monitorData.health.score >= 90) {
      monitorData.health.status = "healthy";
    } else if (monitorData.health.score >= 70) {
      monitorData.health.status = "warning";
    } else {
      monitorData.health.status = "critical";
    }

    return new Response(JSON.stringify(monitorData), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in system monitor:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
    });
  }
}

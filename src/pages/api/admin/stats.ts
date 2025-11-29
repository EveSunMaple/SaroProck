import type { APIContext } from "astro";
import AV from "leancloud-storage";
import { getAdminUser } from "@/lib/auth";
import { initLeanCloud } from "@/lib/leancloud.server";

// 初始化 LeanCloud
initLeanCloud();

export async function GET(context: APIContext): Promise<Response> {
  // 权限验证
  const adminUser = getAdminUser(context);
  if (!adminUser) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 403,
    });
  }

  // [修改] 从环境变量中获取 Sink 基础配置
  const sinkBaseUrl = import.meta.env.SINK_PUBLIC_URL;
  const sinkApiKey = import.meta.env.SINK_API_KEY;

  try {
    // --- LeanCloud 数据获取 ---
    const blogCommentsQuery = new AV.Query("Comment");
    const telegramCommentsQuery = new AV.Query("TelegramComment");
    const postLikesQuery = new AV.Query("PostLikes");
    postLikesQuery.select("likes").limit(1000);
    const blogCommentLikesQuery = new AV.Query("CommentLike");
    const telegramCommentLikesQuery = new AV.Query("TelegramCommentLike");

    // [修改] 动态构建 Sink Counters URL
    const sinkCountersUrl = sinkBaseUrl
      ? `${sinkBaseUrl}/api/stats/counters`
      : null;

    // 并行执行所有数据获取请求
    const [
      totalBlogComments,
      totalTelegramComments,
      allPostLikes,
      totalBlogCommentLikes,
      totalTelegramCommentLikes,
      sinkCountersResponse,
    ] = await Promise.all([
      blogCommentsQuery.count(),
      telegramCommentsQuery.count(),
      postLikesQuery.find(),
      blogCommentLikesQuery.count(),
      telegramCommentLikesQuery.count(),
      // [修改] 使用统一的 Bearer 认证
      sinkApiKey && sinkCountersUrl
        ? fetch(sinkCountersUrl, {
            headers: { Authorization: `Bearer ${sinkApiKey}` },
          })
        : Promise.resolve(null),
    ]);

    // --- 数据处理 ---
    const totalPostLikes = allPostLikes.reduce(
      (sum, item) => sum + (item.get("likes") || 0),
      0,
    );

    let totalSinkViews = 0;
    // 处理 Sink 统计数据
    if (sinkCountersResponse?.ok) {
      const countersData = await sinkCountersResponse.json();
      if (countersData.data?.[0]) {
        totalSinkViews = countersData.data[0].visits || 0;
      }
    }

    // --- 组合最终数据 ---
    const stats = {
      comments: {
        blog: totalBlogComments,
        telegram: totalTelegramComments,
        total: totalBlogComments + totalTelegramComments,
      },
      likes: {
        posts: totalPostLikes,
        comments: totalBlogCommentLikes + totalTelegramCommentLikes,
        total:
          totalPostLikes + totalBlogCommentLikes + totalTelegramCommentLikes,
      },
      sink: {
        totalViews: totalSinkViews,
      },
    };

    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch statistics" }),
      { status: 500 },
    );
  }
}

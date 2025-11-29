// src/pages/api/like.ts
import type { APIContext } from "astro";
import AV from "leancloud-storage";
import { initLeanCloud } from "@/lib/leancloud.server";

// 初始化 LeanCloud (仅在服务器端)
initLeanCloud();

// LeanCloud Class 名称
const LIKES_STATS_CLASS = "PostLikes"; // 用于存储总点赞数

// --- GET: 获取帖子的初始点赞状态 ---
export async function GET({ request }: APIContext): Promise<Response> {
  const url = new URL(request.url);
  const postId = url.searchParams.get("postId");

  if (!postId) {
    return new Response(JSON.stringify({ error: "缺少 postId" }), {
      status: 400,
    });
  }

  try {
    const statsQuery = new AV.Query(LIKES_STATS_CLASS);
    statsQuery.equalTo("postId", postId);
    const postStats = await statsQuery.first();
    const likeCount = postStats ? postStats.get("likes") || 0 : 0;

    return new Response(JSON.stringify({ likeCount }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching like status:", error);
    return new Response(JSON.stringify({ error: "服务器内部错误" }), {
      status: 500,
    });
  }
}

// --- POST: 根据 delta 调整帖子的点赞总数 ---
export async function POST({ request }: APIContext): Promise<Response> {
  try {
    const { postId, delta } = await request.json();

    if (!postId || typeof delta !== "number" || !Number.isFinite(delta)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "缺少 postId 或非法的 delta",
        }),
        { status: 400 },
      );
    }

    // 1. 准备点赞统计对象
    const statsQuery = new AV.Query(LIKES_STATS_CLASS);
    statsQuery.equalTo("postId", postId);
    let postStats = await statsQuery.first();

    // 如果统计对象不存在，则创建一个
    if (!postStats) {
      const PostLikes = AV.Object.extend(LIKES_STATS_CLASS);
      postStats = new PostLikes();
      postStats.set("postId", postId);
      postStats.set("likes", 0);
    }

    // 2. 更新统计：根据 delta 调整 likes，避免降到 0 以下
    (postStats as AV.Object)?.increment("likes", delta);

    const savedStats = await postStats?.save();
    const finalLikeCount = Math.max(
      0,
      savedStats ? savedStats.get("likes") || 0 : 0,
    );

    return new Response(
      JSON.stringify({ success: true, likeCount: finalLikeCount }),
      { status: 200 },
    );
  } catch (error) {
    console.error("Error toggling like:", error);
    return new Response(
      JSON.stringify({ success: false, message: "服务器内部错误" }),
      { status: 500 },
    );
  }
}

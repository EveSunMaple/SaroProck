// src/pages/api/like.ts
import type { APIContext } from "astro";
import { getCollection } from "@/lib/mongodb.server";

// MongoDB Collection 名称
const LIKES_STATS_COLLECTION = "post_likes";

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
    const collection = await getCollection(LIKES_STATS_COLLECTION);
    const postStats = await collection.findOne({ postId });
    const likeCount = postStats ? postStats.likes || 0 : 0;

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

    const now = new Date();

    // 使用 upsert 和 $inc 来更新点赞统计
    const collection = await getCollection(LIKES_STATS_COLLECTION);
    const updateResult = await collection.findOneAndUpdate(
      { postId },
      {
        $inc: { likes: delta },
        $setOnInsert: {
          postId,
          createdAt: now,
        },
        $set: {
          updatedAt: now,
        },
      },
      { upsert: true, returnDocument: "after" },
    );

    const finalLikeCount = Math.max(0, updateResult?.likes || 0);

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

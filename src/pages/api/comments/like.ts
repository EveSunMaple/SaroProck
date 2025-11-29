// src/pages/api/comments/like.ts
import type { APIContext } from "astro";
import AV from "leancloud-storage";
import { initLeanCloud } from "@/lib/leancloud.server";

// 初始化 LeanCloud (仅在服务器端)
initLeanCloud();

export async function POST({ request }: APIContext): Promise<Response> {
  try {
    const { commentId, commentType, deviceId } = await request.json();

    if (!commentId || !deviceId || !commentType) {
      return new Response(
        JSON.stringify({ success: false, message: "缺少必要参数" }),
        { status: 400 },
      );
    }

    const leanCloudLikeClassName =
      commentType === "telegram" ? "TelegramCommentLike" : "CommentLike";
    const Like = AV.Object.extend(leanCloudLikeClassName);
    const query = new AV.Query(leanCloudLikeClassName);

    // 查询该设备是否已经为该评论点过赞
    query.equalTo("commentId", commentId);
    query.equalTo("deviceId", deviceId);
    const existingLike = await query.first();

    if (existingLike) {
      // 如果已存在，则取消点赞 (删除记录)
      await existingLike.destroy();
    } else {
      // 如果不存在，则创建新点赞记录
      const newLike = new Like();
      newLike.set("commentId", commentId);
      newLike.set("deviceId", deviceId); // 用 deviceId 标识用户
      await newLike.save();
    }

    // 重新计算该评论的总点赞数
    const countQuery = new AV.Query(leanCloudLikeClassName);
    countQuery.equalTo("commentId", commentId);
    const totalLikes = await countQuery.count();

    return new Response(
      JSON.stringify({
        success: true,
        likes: totalLikes,
        isLiked: !existingLike, // 返回当前的点赞状态
      }),
      { status: 200 },
    );
  } catch (error) {
    console.error("Error processing like:", error);
    return new Response(
      JSON.stringify({ success: false, message: "服务器内部错误" }),
      { status: 500 },
    );
  }
}

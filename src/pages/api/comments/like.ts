// src/pages/api/comments/like.ts
import type { APIContext } from "astro";
import type { ObjectId } from "mongodb";
import { getCollection, toObjectId } from "@/lib/mongodb.server";

export async function POST({ request }: APIContext): Promise<Response> {
  try {
    const { commentId, commentType, deviceId } = await request.json();

    if (!commentId || !deviceId || !commentType) {
      return new Response(
        JSON.stringify({ success: false, message: "缺少必要参数" }),
        { status: 400 },
      );
    }

    const likeCollection =
      commentType === "telegram" ? "telegram_comment_likes" : "comment_likes";
    const likeColl = await getCollection(likeCollection);

    // Convert commentId to ObjectId
    let commentObjectId: ObjectId;
    try {
      commentObjectId = toObjectId(commentId);
    } catch {
      return new Response(
        JSON.stringify({ success: false, message: "无效的 commentId" }),
        { status: 400 },
      );
    }

    // 查询该设备是否已经为该评论点过赞
    const existingLike = await likeColl.findOne({
      comment: commentObjectId,
      ip: deviceId,
    });

    if (existingLike) {
      // 如果已存在，则取消点赞 (删除记录)
      await likeColl.deleteOne({ _id: existingLike._id });
    } else {
      // 如果不存在，则创建新点赞记录
      const now = new Date();
      await likeColl.insertOne({
        comment: commentObjectId,
        ip: deviceId,
        createdAt: now,
        updatedAt: now,
      });
    }

    // 重新计算该评论的总点赞数
    const totalLikes = await likeColl.countDocuments({
      comment: commentObjectId,
    });

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

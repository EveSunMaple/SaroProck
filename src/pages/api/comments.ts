import type { APIContext } from "astro";
import DOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import AV from "leancloud-storage";
import { marked } from "marked";
import { getAdminUser } from "@/lib/auth";
import { initLeanCloud } from "@/lib/leancloud.server";

// 初始化 LeanCloud (仅在服务器端)
initLeanCloud();

const window = new JSDOM("").window;
const dompurify = DOMPurify(window as any);

// GET: 获取评论 (已修改)
export async function GET(context: APIContext): Promise<Response> {
  const { request } = context;
  const url = new URL(request.url);
  const identifier = url.searchParams.get("identifier");
  const commentType = url.searchParams.get("commentType") || "blog";
  const deviceId = url.searchParams.get("deviceId");
  const page = Number.parseInt(url.searchParams.get("page") || "1", 10);
  const limit = Number.parseInt(url.searchParams.get("limit") || "20", 10);

  // 管理员路由：如果不存在 identifier，则获取所有评论
  if (!identifier) {
    const adminUser = getAdminUser(context);
    if (!adminUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Admin access required." }),
        { status: 403 },
      );
    }

    try {
      const leanCloudClassName =
        commentType === "telegram" ? "TelegramComment" : "Comment";
      const query = new AV.Query(leanCloudClassName);
      query.addDescending("createdAt"); // 管理页面按最新排序
      query.limit(limit);
      query.skip((page - 1) * limit);
      const totalCount = await query.count(); // 分页前获取总数
      const results = await query.find();

      const comments = results.map((c) => {
        const commentJSON = c.toJSON();
        // 统一标识符字段，方便前端使用
        commentJSON.identifier = commentJSON.slug || commentJSON.postId;
        commentJSON.commentType = commentType;
        return commentJSON;
      });

      return new Response(
        JSON.stringify({ comments, total: totalCount, page, limit }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      console.error("Error fetching all comments for admin:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch all comments" }),
        { status: 500 },
      );
    }
  }

  // 公开路由：获取特定页面的评论
  try {
    const leanCloudClassName =
      commentType === "telegram" ? "TelegramComment" : "Comment";
    const leanCloudLikeClassName =
      commentType === "telegram" ? "TelegramCommentLike" : "CommentLike";

    const query = new AV.Query(leanCloudClassName);
    query.equalTo(commentType === "telegram" ? "postId" : "slug", identifier);
    query.addAscending("createdAt");
    query.include("parent");
    const results = await query.find();

    const commentIds = results.map((c) => c.id!);
    if (commentIds.length === 0) {
      return new Response(JSON.stringify([]), { status: 200 });
    }

    const likeQuery = new AV.Query(leanCloudLikeClassName);
    likeQuery.containedIn("commentId", commentIds);
    const likes = await likeQuery.find();

    const likeCounts = new Map<string, number>();
    likes.forEach((like) => {
      const commentId = like.get("commentId");
      likeCounts.set(commentId, (likeCounts.get(commentId) || 0) + 1);
    });

    const userLikedSet = new Set<string>();
    if (deviceId) {
      likes.forEach((like) => {
        if (like.get("deviceId") === deviceId) {
          userLikedSet.add(like.get("commentId"));
        }
      });
    }

    const comments = results.map((c) => {
      const commentId = c.id!;
      const commentJSON = c.toJSON();
      return {
        ...commentJSON,
        id: commentId,
        likes: likeCounts.get(commentId) || 0,
        isLiked: userLikedSet.has(commentId),
      };
    });

    return new Response(JSON.stringify(comments), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching comments from backend:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch comments" }), {
      status: 500,
    });
  }
}

export async function POST(context: APIContext): Promise<Response> {
  const { request } = context;
  try {
    const data = await request.json();
    const { identifier, commentType, content, parentId, userInfo } = data;

    if (!identifier || !content) {
      return new Response(
        JSON.stringify({ success: false, message: "缺少必要参数" }),
        { status: 400 },
      );
    }

    const adminUser = getAdminUser(context);

    // biome-ignore lint/suspicious/noImplicitAnyLet: <>
    let finalUser;
    if (adminUser) {
      // 如果是管理员 (通过cookie验证)
      finalUser = {
        nickname: adminUser.nickname,
        email: adminUser.email,
        website: adminUser.website,
        avatar: adminUser.avatar,
        isAdmin: true,
      };
    } else {
      // 如果是普通用户
      if (!userInfo || !userInfo.nickname || !userInfo.email) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "普通用户需要提供用户信息",
          }),
          { status: 400 },
        );
      }
      finalUser = {
        nickname: userInfo.nickname,
        email: userInfo.email,
        website: userInfo.website || null,
        avatar: userInfo.avatar, // 前端应已生成好头像URL
        isAdmin: false,
      };
    }

    const leanCloudClassName =
      commentType === "telegram" ? "TelegramComment" : "Comment";
    const Comment = AV.Object.extend(leanCloudClassName);
    const comment = new Comment();

    // 安全处理：清理 HTML
    const rawHtml = await marked(content);
    const cleanHtml = dompurify.sanitize(rawHtml);

    comment.set("nickname", finalUser.nickname);
    comment.set("email", finalUser.email);
    comment.set("website", finalUser.website);
    comment.set("avatar", finalUser.avatar);
    comment.set("content", cleanHtml);
    comment.set(commentType === "telegram" ? "postId" : "slug", identifier);
    comment.set("isAdmin", finalUser.isAdmin); // 可以加一个字段来标识管理员评论

    if (parentId) {
      const parentPointer = AV.Object.createWithoutData(
        leanCloudClassName,
        parentId,
      );
      comment.set("parent", parentPointer);
    }

    const savedComment = await comment.save();

    return new Response(
      JSON.stringify({ success: true, comment: savedComment.toJSON() }),
      { status: 201 },
    );
  } catch (error) {
    console.error("Error submitting comment from backend:", error);
    return new Response(
      JSON.stringify({ success: false, message: "服务器内部错误" }),
      { status: 500 },
    );
  }
}

export async function DELETE(context: APIContext): Promise<Response> {
  const adminUser = getAdminUser(context);
  if (!adminUser) {
    return new Response(
      JSON.stringify({ success: false, message: "Unauthorized" }),
      { status: 403 },
    );
  }

  try {
    const { commentId, commentType } = await context.request.json();
    if (!commentId || !commentType) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Missing commentId or commentType",
        }),
        { status: 400 },
      );
    }

    const leanCloudClassName =
      commentType === "telegram" ? "TelegramComment" : "Comment";
    const leanCloudLikeClassName =
      commentType === "telegram" ? "TelegramCommentLike" : "CommentLike";

    const objectsToDelete: AV.Object[] = [];
    const allCommentIds: string[] = [];

    // 递归查找所有子评论
    async function findChildren(parentId: string) {
      const query = new AV.Query(leanCloudClassName);
      const parentPointer = AV.Object.createWithoutData(
        leanCloudClassName,
        parentId,
      );
      query.equalTo("parent", parentPointer);
      const children = await query.find();

      for (const child of children) {
        objectsToDelete.push(child as AV.Object);
        allCommentIds.push(child.id!);
        await findChildren(child.id!); // 递归查找子评论的子评论
      }
    }

    // 添加主评论
    const mainComment = AV.Object.createWithoutData(
      leanCloudClassName,
      commentId,
    );
    objectsToDelete.push(mainComment);
    allCommentIds.push(commentId);

    // 查找并添加所有后代评论
    await findChildren(commentId);

    // 一次性删除所有评论对象
    if (objectsToDelete.length > 0) {
      await AV.Object.destroyAll(objectsToDelete);
    }

    // 查找并删除所有相关的点赞记录
    const likeQuery = new AV.Query(leanCloudLikeClassName);
    likeQuery.containedIn("commentId", allCommentIds);
    likeQuery.limit(1000);
    const likesToDelete = await likeQuery.find();
    if (likesToDelete.length > 0) {
      await AV.Object.destroyAll(likesToDelete as AV.Object[]);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Deleted ${objectsToDelete.length} comment(s) and ${likesToDelete.length} like(s).`,
      }),
      { status: 200 },
    );
  } catch (error: any) {
    console.error("Error deleting comment:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || "Server internal error",
      }),
      { status: 500 },
    );
  }
}

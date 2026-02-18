import type { APIContext } from "astro";
import DOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import AV from "leancloud-storage";
import { marked } from "marked";
import md5 from "md5";
import { getAdminUser } from "@/lib/auth";
import { initLeanCloud } from "@/lib/leancloud.server";

// 初始化 LeanCloud (仅在服务器端)
initLeanCloud();

const window = new JSDOM("").window;
const dompurify = DOMPurify(window as any);

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function logCommentsApiFailed(
  event: string,
  input: string,
  error: unknown,
): void {
  console.error(event, {
    error: safeErrorMessage(error),
    inputHash: md5(input),
  });
}

function getLeanCloudClassName(commentType: unknown): {
  commentClass: string;
  likeClass: string;
  type: "blog" | "telegram";
} {
  const type = commentType === "telegram" ? "telegram" : "blog";
  return {
    type,
    commentClass: type === "telegram" ? "TelegramComment" : "Comment",
    likeClass: type === "telegram" ? "TelegramCommentLike" : "CommentLike",
  };
}

function parsePagination(url: URL): { page: number; limit: number } {
  const page = Math.max(
    1,
    Number.parseInt(url.searchParams.get("page") || "1", 10),
  );
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(url.searchParams.get("limit") || "20", 10)),
  );
  return { page, limit };
}

async function fetchAdminComments(params: {
  commentClass: string;
  commentType: string;
  page: number;
  limit: number;
}): Promise<{ comments: any[]; total: number; page: number; limit: number }> {
  const query = new AV.Query(params.commentClass);
  query.addDescending("createdAt");
  query.limit(params.limit);
  query.skip((params.page - 1) * params.limit);

  const totalCount = await query.count();
  const results = await query.find();

  const comments = results.map((c) => {
    const commentJSON = c.toJSON();
    commentJSON.identifier = commentJSON.slug || commentJSON.postId;
    commentJSON.commentType = params.commentType;
    return commentJSON;
  });

  return {
    comments,
    total: totalCount,
    page: params.page,
    limit: params.limit,
  };
}

async function fetchPublicComments(params: {
  identifier: string;
  type: "blog" | "telegram";
  commentClass: string;
  likeClass: string;
  deviceId: string | null;
}): Promise<any[]> {
  const query = new AV.Query(params.commentClass);
  query.equalTo(
    params.type === "telegram" ? "postId" : "slug",
    params.identifier,
  );
  query.addAscending("createdAt");
  query.include("parent");
  const results = await query.find();

  const commentIds = results.map((c) => c.id!).filter(Boolean);
  if (commentIds.length === 0) {
    return [];
  }

  const likeQuery = new AV.Query(params.likeClass);
  likeQuery.containedIn("commentId", commentIds);
  const likes = await likeQuery.find();

  const likeCounts = new Map<string, number>();
  likes.forEach((like) => {
    const commentId = like.get("commentId");
    if (typeof commentId !== "string") return;
    likeCounts.set(commentId, (likeCounts.get(commentId) || 0) + 1);
  });

  const userLikedSet = new Set<string>();
  if (params.deviceId) {
    likes.forEach((like) => {
      if (like.get("deviceId") === params.deviceId) {
        const commentId = like.get("commentId");
        if (typeof commentId === "string") {
          userLikedSet.add(commentId);
        }
      }
    });
  }

  return results.map((c) => {
    const commentId = c.id!;
    const commentJSON = c.toJSON();
    return {
      ...commentJSON,
      id: commentId,
      likes: likeCounts.get(commentId) || 0,
      isLiked: userLikedSet.has(commentId),
    };
  });
}

async function createComment(params: {
  identifier: string;
  type: "blog" | "telegram";
  commentClass: string;
  content: string;
  parentId?: string | null;
  finalUser: {
    nickname: string;
    email: string;
    website?: string | null;
    avatar: string;
    isAdmin: boolean;
  };
}) {
  const Comment = AV.Object.extend(params.commentClass);
  const comment = new Comment();

  const rawHtml = await marked(params.content);
  const cleanHtml = dompurify.sanitize(rawHtml);

  comment.set("nickname", params.finalUser.nickname);
  comment.set("email", params.finalUser.email);
  comment.set("website", params.finalUser.website);
  comment.set("avatar", params.finalUser.avatar);
  comment.set("content", cleanHtml);
  comment.set(
    params.type === "telegram" ? "postId" : "slug",
    params.identifier,
  );
  comment.set("isAdmin", params.finalUser.isAdmin);

  if (params.parentId) {
    const parentPointer = AV.Object.createWithoutData(
      params.commentClass,
      params.parentId,
    );
    comment.set("parent", parentPointer);
  }

  return await comment.save();
}

// GET: 获取评论 (已修改)
export async function GET(context: APIContext): Promise<Response> {
  const { request } = context;
  const url = new URL(request.url);
  const identifier = url.searchParams.get("identifier");
  const commentType = url.searchParams.get("commentType") || "blog";
  const deviceId = url.searchParams.get("deviceId");
  const { page, limit } = parsePagination(url);
  const { commentClass, likeClass, type } = getLeanCloudClassName(commentType);

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
      const result = await fetchAdminComments({
        commentClass,
        commentType,
        page,
        limit,
      });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      logCommentsApiFailed("comments_api_admin_get_failed", request.url, error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch all comments" }),
        { status: 500 },
      );
    }
  }

  // 公开路由：获取特定页面的评论
  try {
    const comments = await fetchPublicComments({
      identifier,
      type,
      commentClass,
      likeClass,
      deviceId,
    });

    return new Response(JSON.stringify(comments), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logCommentsApiFailed("comments_api_public_get_failed", request.url, error);
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

    const { commentClass, type } = getLeanCloudClassName(commentType);

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

    const savedComment = await createComment({
      identifier,
      type,
      commentClass,
      content,
      parentId,
      finalUser,
    });

    return new Response(
      JSON.stringify({ success: true, comment: savedComment.toJSON() }),
      { status: 201 },
    );
  } catch (error) {
    logCommentsApiFailed("comments_api_post_failed", request.url, error);
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

    const {
      commentClass: leanCloudClassName,
      likeClass: leanCloudLikeClassName,
    } = getLeanCloudClassName(commentType);

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
    logCommentsApiFailed(
      "comments_api_delete_failed",
      context.request.url,
      error,
    );
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || "Server internal error",
      }),
      { status: 500 },
    );
  }
}

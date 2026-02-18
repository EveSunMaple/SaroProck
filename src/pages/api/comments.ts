import type { APIContext } from "astro";
import DOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import { marked } from "marked";
import md5 from "md5";
import { ObjectId } from "mongodb";
import { getAdminUser } from "@/lib/auth";
import {
  type Comment,
  getCollection,
  type TelegramComment,
  toObjectId,
} from "@/lib/mongodb.server";

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

function getCollectionNames(commentType: unknown): {
  commentCollection: "comments" | "telegram_comments";
  likeCollection: "comment_likes" | "telegram_comment_likes";
  type: "blog" | "telegram";
  identifierField: "slug" | "postId";
} {
  const type = commentType === "telegram" ? "telegram" : "blog";
  return {
    type,
    identifierField: type === "telegram" ? "postId" : "slug",
    commentCollection: type === "telegram" ? "telegram_comments" : "comments",
    likeCollection:
      type === "telegram" ? "telegram_comment_likes" : "comment_likes",
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
  commentCollection: "comments" | "telegram_comments";
  commentType: string;
  page: number;
  limit: number;
}): Promise<{ comments: any[]; total: number; page: number; limit: number }> {
  const collection = await getCollection(params.commentCollection);

  const totalCount = await collection.countDocuments();
  const results = await collection
    .find({})
    .sort({ createdAt: -1 })
    .skip((params.page - 1) * params.limit)
    .limit(params.limit)
    .toArray();

  const comments = results.map((c) => {
    const commentJSON: any = {
      ...c,
      id: c._id?.toString(),
    };
    commentJSON.identifier = ("slug" in c ? c.slug : (c as any).postId) || "";
    commentJSON.commentType = params.commentType;
    commentJSON.isAdmin = c.isAdmin || false;
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
  commentCollection: "comments" | "telegram_comments";
  likeCollection: "comment_likes" | "telegram_comment_likes";
  identifierField: "slug" | "postId";
  deviceId: string | null;
}): Promise<any[]> {
  const commentCollection = await getCollection(params.commentCollection);
  const likeCollection = await getCollection(params.likeCollection);

  const results = await commentCollection
    .find({ [params.identifierField]: params.identifier })
    .sort({ createdAt: 1 })
    .toArray();

  const commentIds = results
    .map((c) => c._id?.toString())
    .filter(Boolean) as string[];
  if (commentIds.length === 0) {
    return [];
  }

  // Convert string IDs to ObjectIds for query
  const objectIds = commentIds
    .map((id) => {
      try {
        return toObjectId(id);
      } catch {
        return null;
      }
    })
    .filter(Boolean) as ObjectId[];

  const likes = await likeCollection
    .find({ comment: { $in: objectIds } })
    .toArray();

  const likeCounts = new Map<string, number>();
  likes.forEach((like) => {
    if (!like.comment) return;
    const commentId =
      like.comment instanceof ObjectId
        ? like.comment.toString()
        : (like.comment as string);
    likeCounts.set(commentId, (likeCounts.get(commentId) || 0) + 1);
  });

  const userLikedSet = new Set<string>();
  if (params.deviceId) {
    likes.forEach((like) => {
      if (!like || !like.comment) return;
      // Check if this like belongs to the current device/user
      // For regular comments, check ip field
      // For telegram comments, check telegramId field
      const isDeviceLike =
        ("ip" in like && like.ip === params.deviceId) ||
        ("telegramId" in like && like.telegramId !== undefined);

      if (isDeviceLike) {
        const commentId =
          like.comment instanceof ObjectId
            ? like.comment.toString()
            : (like.comment as string);
        userLikedSet.add(commentId);
      }
    });
  }

  return results.map((c) => {
    const commentId = c._id?.toString() || "";
    // Convert parent ObjectId to string if it exists
    let parentId: string | undefined;
    if (c.parent) {
      if (c.parent instanceof ObjectId) {
        parentId = c.parent.toString();
      } else if (typeof c.parent === "string") {
        parentId = c.parent;
      }
    }

    const commentJSON: any = {
      ...c,
      id: commentId,
      parentId: parentId,
    };
    return {
      ...commentJSON,
      likes: likeCounts.get(commentId) || 0,
      isLiked: userLikedSet.has(commentId),
    };
  });
}

async function createComment(params: {
  identifier: string;
  type: "blog" | "telegram";
  commentCollection: "comments" | "telegram_comments";
  identifierField: "slug" | "postId";
  content: string;
  parentId?: string | null;
  finalUser: {
    nickname: string;
    email: string;
    website?: string | null;
    avatar: string;
    isAdmin: boolean;
  };
}): Promise<any> {
  const collection = await getCollection(params.commentCollection);

  const rawHtml = await marked(params.content);
  const cleanHtml = dompurify.sanitize(rawHtml);

  const commentData: Partial<Comment | TelegramComment> = {
    [params.identifierField]: params.identifier,
    content: cleanHtml,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  if (params.commentCollection === "comments") {
    (commentData as Partial<Comment>).nickname = params.finalUser.nickname;
    (commentData as Partial<Comment>).email = params.finalUser.email;
    (commentData as Partial<Comment>).isAdmin = params.finalUser.isAdmin;
    (commentData as Partial<Comment>).avatar = params.finalUser.avatar;
    if (params.finalUser.website) {
      (commentData as Partial<Comment>).website = params.finalUser.website;
    }
  } else {
    (commentData as Partial<TelegramComment>).username =
      params.finalUser.nickname;
  }

  if (params.parentId) {
    try {
      commentData.parent = toObjectId(params.parentId);
    } catch {
      commentData.parent = params.parentId;
    }
  } else {
    commentData.parent = null;
  }

  const result = await collection.insertOne(commentData as any);
  return {
    id: result.insertedId.toString(),
    ...commentData,
  };
}

// GET: 获取评论
export async function GET(context: APIContext): Promise<Response> {
  const { request } = context;
  const url = new URL(request.url);
  const identifier = url.searchParams.get("identifier");
  const commentType = url.searchParams.get("commentType") || "blog";
  const deviceId = url.searchParams.get("deviceId");
  const { page, limit } = parsePagination(url);
  const { commentCollection, likeCollection, type, identifierField } =
    getCollectionNames(commentType);

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
        commentCollection,
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
      commentCollection,
      likeCollection,
      identifierField,
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

    const { commentCollection, identifierField, type } =
      getCollectionNames(commentType);

    if (!identifier || !content) {
      return new Response(
        JSON.stringify({ success: false, message: "缺少必要参数" }),
        { status: 400 },
      );
    }

    const adminUser = getAdminUser(context);

    let finalUser: {
      nickname: string;
      email: string;
      website?: string | null;
      avatar: string;
      isAdmin: boolean;
    };
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
      commentCollection,
      identifierField,
      content,
      parentId,
      finalUser,
    });

    return new Response(
      JSON.stringify({ success: true, comment: savedComment }),
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

    const { commentCollection, likeCollection } =
      getCollectionNames(commentType);

    const commentColl = await getCollection(commentCollection);
    const likeColl = await getCollection(likeCollection);

    const allCommentIds: ObjectId[] = [];
    const queue: ObjectId[] = [];

    // Convert commentId to ObjectId
    const mainCommentIdObj = toObjectId(commentId);
    allCommentIds.push(mainCommentIdObj);
    queue.push(mainCommentIdObj);

    // BFS to find all children comments (iterative to avoid stack overflow)
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = await commentColl
        .find({ parent: currentId })
        .project({ _id: 1 })
        .toArray();

      for (const child of children) {
        if (child._id && child._id instanceof ObjectId) {
          if (!allCommentIds.some((id) => id.equals(child._id as ObjectId))) {
            allCommentIds.push(child._id as ObjectId);
            queue.push(child._id as ObjectId);
          }
        }
      }
    }

    // Delete all comments
    if (allCommentIds.length > 0) {
      await commentColl.deleteMany({
        _id: { $in: allCommentIds },
      });
    }

    // Delete all related likes
    await likeColl.deleteMany({
      comment: { $in: allCommentIds },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Deleted ${allCommentIds.length} comment(s) and their likes.`,
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

// PATCH: 更新评论的isAdmin状态（管理员专用）
export async function PATCH(context: APIContext): Promise<Response> {
  const adminUser = getAdminUser(context);
  if (!adminUser) {
    return new Response(
      JSON.stringify({ success: false, message: "Unauthorized" }),
      { status: 403 },
    );
  }

  try {
    const { commentId, isAdmin, commentType } = await context.request.json();
    if (!commentId || typeof isAdmin !== "boolean" || !commentType) {
      return new Response(
        JSON.stringify({
          success: false,
          message:
            "Missing required fields: commentId, isAdmin, or commentType",
        }),
        { status: 400 },
      );
    }

    const { commentCollection } = getCollectionNames(commentType);
    const collection = await getCollection(commentCollection);

    // 更新评论的isAdmin字段
    const result = await collection.updateOne(
      { _id: toObjectId(commentId) },
      { $set: { isAdmin, updatedAt: new Date() } },
    );

    if (result.matchedCount === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Comment not found",
        }),
        { status: 404 },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Comment updated successfully",
      }),
      { status: 200 },
    );
  } catch (error: any) {
    logCommentsApiFailed(
      "comments_api_patch_failed",
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

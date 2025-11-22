// src/pages/api/admin/posts-stats.ts
import type { APIContext } from "astro";
import { getCollection } from "astro:content";
import AV from "leancloud-storage";
import { getAdminUser } from "@/lib/auth";
import { initLeanCloud } from "@/lib/leancloud.server";

// 初始化 LeanCloud
initLeanCloud();

/**
 * 获取所有文章的评论和点赞统计
 * 返回每篇文章的标识符、评论数、点赞数等信息
 */
export async function GET(context: APIContext): Promise<Response> {
  // 权限验证
  const adminUser = getAdminUser(context);
  if (!adminUser) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403 });
  }

  try {
    // 获取所有博客文章
    const blogEntries = await getCollection("blog", ({ data }) => !data.draft);
    const blogSlugs = blogEntries.map((entry) => entry.slug);

    // 获取所有评论
    const blogCommentsQuery = new AV.Query("Comment");
    blogCommentsQuery.limit(10000); // 获取所有评论
    const blogComments = await blogCommentsQuery.find();

    const telegramCommentsQuery = new AV.Query("TelegramComment");
    telegramCommentsQuery.limit(10000);
    const telegramComments = await telegramCommentsQuery.find();

    // 获取所有文章点赞
    const postLikesQuery = new AV.Query("PostLikes");
    postLikesQuery.limit(1000);
    const postLikes = await postLikesQuery.find();

    // 获取所有评论点赞
    const blogCommentLikesQuery = new AV.Query("CommentLike");
    blogCommentLikesQuery.limit(10000);
    const blogCommentLikes = await blogCommentLikesQuery.find();

    const telegramCommentLikesQuery = new AV.Query("TelegramCommentLike");
    telegramCommentLikesQuery.limit(10000);
    const telegramCommentLikes = await telegramCommentLikesQuery.find();

    // 统计每篇文章的评论数
    const commentCounts = new Map<string, number>();
    blogComments.forEach((comment) => {
      const slug = comment.get("slug");
      if (slug) {
        commentCounts.set(slug, (commentCounts.get(slug) || 0) + 1);
      }
    });

    // 统计每个动态的评论数
    const telegramCommentCounts = new Map<string, number>();
    telegramComments.forEach((comment) => {
      const postId = comment.get("postId");
      if (postId) {
        telegramCommentCounts.set(postId, (telegramCommentCounts.get(postId) || 0) + 1);
      }
    });

    // 统计每篇文章的点赞数
    const postLikeCounts = new Map<string, number>();
    postLikes.forEach((like) => {
      const postId = like.get("postId");
      const likes = like.get("likes") || 0;
      if (postId) {
        postLikeCounts.set(postId, likes);
      }
    });

    // 建立评论ID到文章标识符的映射（提高查找效率）
    const blogCommentToSlug = new Map<string, string>();
    blogComments.forEach((comment) => {
      const commentId = comment.id!;
      const slug = comment.get("slug");
      if (slug) {
        blogCommentToSlug.set(commentId, slug);
      }
    });

    const telegramCommentToPostId = new Map<string, string>();
    telegramComments.forEach((comment) => {
      const commentId = comment.id!;
      const postId = comment.get("postId");
      if (postId) {
        telegramCommentToPostId.set(commentId, postId);
      }
    });

    // 统计每个评论的点赞数（按文章分组）
    const commentLikeCountsByPost = new Map<string, number>();
    blogCommentLikes.forEach((like) => {
      const commentId = like.get("commentId");
      const slug = blogCommentToSlug.get(commentId);
      if (slug) {
        commentLikeCountsByPost.set(slug, (commentLikeCountsByPost.get(slug) || 0) + 1);
      }
    });

    telegramCommentLikes.forEach((like) => {
      const commentId = like.get("commentId");
      const postId = telegramCommentToPostId.get(commentId);
      if (postId) {
        commentLikeCountsByPost.set(postId, (commentLikeCountsByPost.get(postId) || 0) + 1);
      }
    });

    // 构建博客文章统计
    const blogStats = blogSlugs.map((slug) => {
      const entry = blogEntries.find((e) => e.slug === slug);
      return {
        identifier: slug,
        type: "blog" as const,
        title: entry?.data.title || slug,
        comments: commentCounts.get(slug) || 0,
        likes: postLikeCounts.get(slug) || 0,
        commentLikes: commentLikeCountsByPost.get(slug) || 0,
        totalLikes: (postLikeCounts.get(slug) || 0) + (commentLikeCountsByPost.get(slug) || 0),
      };
    });

    // 获取所有动态的postId（从TelegramComment中提取）
    const telegramPostIds = Array.from(new Set(telegramComments.map((c) => c.get("postId")).filter(Boolean) as string[]));

    // 构建动态统计
    const telegramStats = telegramPostIds.map((postId) => ({
      identifier: postId,
      type: "telegram" as const,
      title: postId,
      comments: telegramCommentCounts.get(postId) || 0,
      likes: postLikeCounts.get(postId) || 0,
      commentLikes: commentLikeCountsByPost.get(postId) || 0,
      totalLikes: (postLikeCounts.get(postId) || 0) + (commentLikeCountsByPost.get(postId) || 0),
    }));

    // 合并并排序（按总互动数排序：评论数 + 点赞数）
    const allStats = [...blogStats, ...telegramStats].sort((a, b) => {
      const aTotal = a.comments + a.totalLikes;
      const bTotal = b.comments + b.totalLikes;
      return bTotal - aTotal;
    });

    return new Response(JSON.stringify({ data: allStats }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  catch (error) {
    console.error("Error fetching posts stats:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch posts statistics" }), { status: 500 });
  }
}

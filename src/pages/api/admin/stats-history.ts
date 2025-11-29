// src/pages/api/admin/stats-history.ts
import type { APIContext } from "astro";
import AV from "leancloud-storage";
import { getAdminUser } from "@/lib/auth";
import { initLeanCloud } from "@/lib/leancloud.server";

// 初始化 LeanCloud
initLeanCloud();

/**
 * 获取评论和点赞的历史趋势数据
 * 获取所有历史数据，计算真实的累计数，但只返回最近N天的数据点
 */
export async function GET(context: APIContext): Promise<Response> {
  // 权限验证
  const adminUser = getAdminUser(context);
  if (!adminUser) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 403,
    });
  }

  const url = new URL(context.request.url);
  const days = Number.parseInt(url.searchParams.get("days") || "30", 10); // 默认30天

  try {
    // 计算要返回的日期范围（最近N天）
    const displayStartDate = new Date();
    displayStartDate.setDate(displayStartDate.getDate() - days);
    displayStartDate.setHours(0, 0, 0, 0);

    // 获取所有历史评论（不限制时间范围，获取全部数据）
    const blogCommentsQuery = new AV.Query("Comment");
    blogCommentsQuery.select("createdAt", "slug");
    blogCommentsQuery.limit(10000);

    const telegramCommentsQuery = new AV.Query("TelegramComment");
    telegramCommentsQuery.select("createdAt", "postId");
    telegramCommentsQuery.limit(10000);

    // 获取所有点赞记录（评论点赞 + 文章点赞日志）
    const blogCommentLikesQuery = new AV.Query("CommentLike");
    blogCommentLikesQuery.select("createdAt");
    blogCommentLikesQuery.limit(10000);

    const telegramCommentLikesQuery = new AV.Query("TelegramCommentLike");
    telegramCommentLikesQuery.select("createdAt");
    telegramCommentLikesQuery.limit(10000);

    // 并行获取所有历史数据
    const [
      blogComments,
      telegramComments,
      blogCommentLikes,
      telegramCommentLikes,
    ] = await Promise.all([
      blogCommentsQuery.find(),
      telegramCommentsQuery.find(),
      blogCommentLikesQuery.find(),
      telegramCommentLikesQuery.find(),
    ]);

    // 按日期分组统计每日新增（所有历史数据）
    const commentsByDate = new Map<
      string,
      { blog: number; telegram: number; total: number }
    >();
    const likesByDate = new Map<
      string,
      { posts: number; comments: number; total: number }
    >();

    // 统计所有历史评论（按创建日期）
    blogComments.forEach((comment) => {
      const createdAt = new Date(comment.get("createdAt"));
      const dateKey = createdAt.toISOString().split("T")[0];
      const stats = commentsByDate.get(dateKey) || {
        blog: 0,
        telegram: 0,
        total: 0,
      };
      stats.blog++;
      stats.total++;
      commentsByDate.set(dateKey, stats);
    });

    telegramComments.forEach((comment) => {
      const createdAt = new Date(comment.get("createdAt"));
      const dateKey = createdAt.toISOString().split("T")[0];
      const stats = commentsByDate.get(dateKey) || {
        blog: 0,
        telegram: 0,
        total: 0,
      };
      stats.telegram++;
      stats.total++;
      commentsByDate.set(dateKey, stats);
    });

    // 统计所有历史评论点赞（按创建日期）
    blogCommentLikes.forEach((like) => {
      const createdAt = new Date(like.get("createdAt"));
      const dateKey = createdAt.toISOString().split("T")[0];
      const stats = likesByDate.get(dateKey) || {
        posts: 0,
        comments: 0,
        total: 0,
      };
      stats.comments++;
      stats.total++;
      likesByDate.set(dateKey, stats);
    });

    telegramCommentLikes.forEach((like) => {
      const createdAt = new Date(like.get("createdAt"));
      const dateKey = createdAt.toISOString().split("T")[0];
      const stats = likesByDate.get(dateKey) || {
        posts: 0,
        comments: 0,
        total: 0,
      };
      stats.comments++;
      stats.total++;
      likesByDate.set(dateKey, stats);
    });

    // 获取所有日期并排序（从最早到最晚）
    const allDates = new Set<string>();
    commentsByDate.forEach((_, date) => {
      allDates.add(date);
    });
    likesByDate.forEach((_, date) => {
      allDates.add(date);
    });
    const sortedAllDates = Array.from(allDates).sort();

    // 计算从最早日期到每个日期的真实累计数（包括各分类的累计）
    let cumulativeComments = 0;
    let cumulativeLikes = 0;
    let cumulativeCommentsBlog = 0;
    let cumulativeCommentsTelegram = 0;
    let cumulativeLikesPosts = 0;
    let cumulativeLikesComments = 0;
    const cumulativeData = new Map<
      string,
      {
        comments: number;
        likes: number;
        commentsBlog: number;
        commentsTelegram: number;
        likesPosts: number;
        likesComments: number;
      }
    >();

    sortedAllDates.forEach((dateKey) => {
      const commentStats = commentsByDate.get(dateKey) || {
        blog: 0,
        telegram: 0,
        total: 0,
      };
      const likeStats = likesByDate.get(dateKey) || {
        posts: 0,
        comments: 0,
        total: 0,
      };

      cumulativeComments += commentStats.total;
      cumulativeLikes += likeStats.total;
      cumulativeCommentsBlog += commentStats.blog;
      cumulativeCommentsTelegram += commentStats.telegram;
      cumulativeLikesPosts += likeStats.posts;
      cumulativeLikesComments += likeStats.comments;

      cumulativeData.set(dateKey, {
        comments: cumulativeComments,
        likes: cumulativeLikes,
        commentsBlog: cumulativeCommentsBlog,
        commentsTelegram: cumulativeCommentsTelegram,
        likesPosts: cumulativeLikesPosts,
        likesComments: cumulativeLikesComments,
      });
    });

    // 只返回最近N天的数据点
    const historyData: Array<{
      date: string;
      comments: {
        daily: number;
        blog: number;
        telegram: number;
        cumulative: number;
        cumulativeBlog: number;
        cumulativeTelegram: number;
      };
      likes: {
        daily: number;
        posts: number;
        comments: number;
        cumulative: number;
        cumulativePosts: number;
        cumulativeComments: number;
      };
    }> = [];

    // 获取所有有累计数据的日期（已排序）
    const cumulativeDates = Array.from(cumulativeData.keys()).sort();

    // 初始化要显示的日期范围
    let lastCommentsCumulative = 0;
    let lastLikesCumulative = 0;
    let lastCommentsBlogCumulative = 0;
    let lastCommentsTelegramCumulative = 0;
    let lastLikesPostsCumulative = 0;
    let lastLikesCommentsCumulative = 0;

    for (let i = 0; i < days; i++) {
      const date = new Date(displayStartDate);
      date.setDate(date.getDate() + i);
      const dateKey = date.toISOString().split("T")[0];

      const commentStats = commentsByDate.get(dateKey) || {
        blog: 0,
        telegram: 0,
        total: 0,
      };
      const likeStats = likesByDate.get(dateKey) || {
        posts: 0,
        comments: 0,
        total: 0,
      };

      // 获取该日期的累计数，如果不存在则使用前一个日期的累计数
      let commentsCumulative = lastCommentsCumulative;
      let likesCumulative = lastLikesCumulative;
      let commentsBlogCumulative = lastCommentsBlogCumulative;
      let commentsTelegramCumulative = lastCommentsTelegramCumulative;
      let likesPostsCumulative = lastLikesPostsCumulative;
      let likesCommentsCumulative = lastLikesCommentsCumulative;

      // 查找该日期或之前最近的累计数
      for (let j = cumulativeDates.length - 1; j >= 0; j--) {
        const cumDate = cumulativeDates[j];
        if (cumDate <= dateKey) {
          const cum = cumulativeData.get(cumDate)!;
          commentsCumulative = cum.comments;
          likesCumulative = cum.likes;
          commentsBlogCumulative = cum.commentsBlog;
          commentsTelegramCumulative = cum.commentsTelegram;
          likesPostsCumulative = cum.likesPosts;
          likesCommentsCumulative = cum.likesComments;
          break;
        }
      }

      // 更新最后的累计数（确保单调递增）
      lastCommentsCumulative = Math.max(
        lastCommentsCumulative,
        commentsCumulative,
      );
      lastLikesCumulative = Math.max(lastLikesCumulative, likesCumulative);
      lastCommentsBlogCumulative = Math.max(
        lastCommentsBlogCumulative,
        commentsBlogCumulative,
      );
      lastCommentsTelegramCumulative = Math.max(
        lastCommentsTelegramCumulative,
        commentsTelegramCumulative,
      );
      lastLikesPostsCumulative = Math.max(
        lastLikesPostsCumulative,
        likesPostsCumulative,
      );
      lastLikesCommentsCumulative = Math.max(
        lastLikesCommentsCumulative,
        likesCommentsCumulative,
      );

      historyData.push({
        date: dateKey,
        comments: {
          daily: commentStats.total,
          blog: commentStats.blog,
          telegram: commentStats.telegram,
          cumulative: lastCommentsCumulative,
          cumulativeBlog: lastCommentsBlogCumulative,
          cumulativeTelegram: lastCommentsTelegramCumulative,
        },
        likes: {
          daily: likeStats.total,
          posts: likeStats.posts,
          comments: likeStats.comments,
          cumulative: lastLikesCumulative,
          cumulativePosts: lastLikesPostsCumulative,
          cumulativeComments: lastLikesCommentsCumulative,
        },
      });
    }

    return new Response(JSON.stringify({ data: historyData }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching stats history:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch statistics history" }),
      { status: 500 },
    );
  }
}

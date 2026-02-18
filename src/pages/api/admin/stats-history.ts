// src/pages/api/admin/stats-history.ts
import type { APIContext } from "astro";
import md5 from "md5";
import { getAdminUser } from "@/lib/auth";
import { getCollection } from "@/lib/mongodb.server";

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function logStatsHistoryFailed(event: string, input: string, error: unknown) {
  console.error(event, {
    error: safeErrorMessage(error),
    inputHash: md5(input),
  });
}

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    return new Date(value);
  }
  return new Date(0);
}

function validateDays(rawDays: string | null): number {
  const parsed = Number.parseInt(rawDays || "30", 10);
  if (!Number.isFinite(parsed)) return 30;
  return Math.min(Math.max(parsed, 1), 365);
}

function getDisplayStartDate(days: number): Date {
  const displayStartDate = new Date();
  displayStartDate.setDate(displayStartDate.getDate() - days);
  displayStartDate.setHours(0, 0, 0, 0);
  return displayStartDate;
}

type CommentsByDate = Map<
  string,
  {
    blog: number;
    telegram: number;
    total: number;
  }
>;

type LikesByDate = Map<
  string,
  {
    posts: number;
    comments: number;
    total: number;
  }
>;

async function queryStatsFromDB() {
  const blogComments = await getCollection("comments").then((c) =>
    c.find({}).limit(10000).toArray(),
  );

  const telegramComments = await getCollection("telegram_comments").then((c) =>
    c.find({}).limit(10000).toArray(),
  );

  const blogCommentLikes = await getCollection("comment_likes").then((c) =>
    c.find({}).limit(10000).toArray(),
  );

  const telegramCommentLikes = await getCollection(
    "telegram_comment_likes",
  ).then((c) => c.find({}).limit(10000).toArray());

  return {
    blogComments,
    telegramComments,
    blogCommentLikes,
    telegramCommentLikes,
  };
}

function aggregateStats(rawData: {
  blogComments: any[];
  telegramComments: any[];
  blogCommentLikes: any[];
  telegramCommentLikes: any[];
}): { commentsByDate: CommentsByDate; likesByDate: LikesByDate } {
  const commentsByDate: CommentsByDate = new Map();
  const likesByDate: LikesByDate = new Map();

  rawData.blogComments.forEach((comment) => {
    const createdAt = toDate(comment.createdAt);
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

  rawData.telegramComments.forEach((comment) => {
    const createdAt = toDate(comment.createdAt);
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

  rawData.blogCommentLikes.forEach((like) => {
    const createdAt = toDate(like.createdAt);
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

  rawData.telegramCommentLikes.forEach((like) => {
    const createdAt = toDate(like.createdAt);
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

  return { commentsByDate, likesByDate };
}

function buildCumulativeData(
  commentsByDate: CommentsByDate,
  likesByDate: LikesByDate,
) {
  const allDates = new Set<string>();
  commentsByDate.forEach((_, date) => {
    allDates.add(date);
  });
  likesByDate.forEach((_, date) => {
    allDates.add(date);
  });
  const sortedAllDates = Array.from(allDates).sort();

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

  return cumulativeData;
}

function formatApiResponse(
  displayStartDate: Date,
  days: number,
  commentsByDate: CommentsByDate,
  likesByDate: LikesByDate,
  cumulativeData: Map<
    string,
    {
      comments: number;
      likes: number;
      commentsBlog: number;
      commentsTelegram: number;
      likesPosts: number;
      likesComments: number;
    }
  >,
) {
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

  const cumulativeDates = Array.from(cumulativeData.keys()).sort();

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

    let commentsCumulative = lastCommentsCumulative;
    let likesCumulative = lastLikesCumulative;
    let commentsBlogCumulative = lastCommentsBlogCumulative;
    let commentsTelegramCumulative = lastCommentsTelegramCumulative;
    let likesPostsCumulative = lastLikesPostsCumulative;
    let likesCommentsCumulative = lastLikesCommentsCumulative;

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

  return { data: historyData };
}

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
  const days = validateDays(url.searchParams.get("days"));

  try {
    const displayStartDate = getDisplayStartDate(days);
    const rawData = await queryStatsFromDB();
    const { commentsByDate, likesByDate } = aggregateStats(rawData);
    const cumulativeData = buildCumulativeData(commentsByDate, likesByDate);
    const responseBody = formatApiResponse(
      displayStartDate,
      days,
      commentsByDate,
      likesByDate,
      cumulativeData,
    );

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logStatsHistoryFailed(
      "admin_stats_history_failed",
      context.request.url,
      error,
    );
    return new Response(
      JSON.stringify({ error: "Failed to fetch statistics history" }),
      { status: 500 },
    );
  }
}

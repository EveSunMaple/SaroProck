import type { APIContext } from "astro";
import { getAdminUser } from "@/lib/auth";
import { getCollection } from "@/lib/mongodb.server";

interface ExportOptions {
  dateFrom?: string;
  dateTo?: string;
  format: "json" | "csv";
  type: "comments" | "likes" | "views";
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCSV(headers: string[], rows: any[][]): string {
  const headerRow = headers.map(csvEscape).join(",");
  const dataRows = rows.map((row) =>
    row
      .map((field: any) => {
        const value = field == null ? "" : String(field);
        return csvEscape(value);
      })
      .join(","),
  );

  return [headerRow, ...dataRows].join("\n");
}

async function exportComments(options: ExportOptions): Promise<string> {
  const { dateFrom, dateTo, format } = options;

  const filters: any = {};

  if (dateFrom || dateTo) {
    filters.createdAt = {};
    if (dateFrom) filters.createdAt.$gte = new Date(dateFrom);
    if (dateTo) filters.createdAt.$lte = new Date(dateTo);
  }

  const collection = await getCollection("comments");
  const comments = await collection
    .find(filters)
    .sort({ createdAt: -1 })
    .toArray();

  if (format === "json") {
    return JSON.stringify(comments, null, 2);
  } else {
    // CSV
    const headers = [
      "ID",
      "Author",
      "Email",
      "Content",
      "Identifier",
      "Created At",
      "IP",
    ];
    const rows = comments.map((comment: any) => [
      comment._id?.toString() || "",
      comment.nickname || comment.username || "",
      comment.email || "",
      comment.content
        ? comment.content.replace(/</g, "&lt;").replace(/>/g, "&gt;")
        : "",
      comment.slug || comment.postId || "",
      comment.createdAt ? new Date(comment.createdAt).toISOString() : "",
      comment.ip || "",
    ]);

    return toCSV(headers, rows);
  }
}

async function exportLikes(options: ExportOptions): Promise<string> {
  const { dateFrom, dateTo, format } = options;

  const likes: any[] = [];

  // Export blog comment likes
  const blogLikes = await getCollection("comment_likes");
  const blogLikeFilters: any = {};
  if (dateFrom || dateTo) {
    blogLikeFilters.createdAt = {};
    if (dateFrom) blogLikeFilters.createdAt.$gte = new Date(dateFrom);
    if (dateTo) blogLikeFilters.createdAt.$lte = new Date(dateTo);
  }

  const blogLikesData = await blogLikes.find(blogLikeFilters).toArray();
  likes.push(
    ...blogLikesData.map((like: any) => ({
      ...like,
      type: "blog_comment_like",
    })),
  );

  // Export telegram comment likes
  const telegramLikes = await getCollection("telegram_comment_likes");
  const telegramLikeFilters: any = {};
  if (dateFrom || dateTo) {
    telegramLikeFilters.createdAt = {};
    if (dateFrom) telegramLikeFilters.createdAt.$gte = new Date(dateFrom);
    if (dateTo) telegramLikeFilters.createdAt.$lte = new Date(dateTo);
  }

  const telegramLikesData = await telegramLikes
    .find(telegramLikeFilters)
    .toArray();
  likes.push(
    ...telegramLikesData.map((like: any) => ({
      ...like,
      type: "telegram_comment_like",
    })),
  );

  // Export post likes
  const postLikesCollection = await getCollection("post_likes");
  const postLikesData = await postLikesCollection.find({}).toArray();
  likes.push(
    ...postLikesData.map((like: any) => ({
      ...like,
      type: "post_like",
    })),
  );

  if (format === "json") {
    return JSON.stringify(likes, null, 2);
  } else {
    const headers = ["ID", "Type", "Comment/Post ID", "Created At"];
    const rows = likes.map((like: any) => [
      like._id?.toString() || "",
      like.type,
      like.comment?.toString() || like.postId || "",
      like.createdAt ? new Date(like.createdAt).toISOString() : "",
    ]);

    return toCSV(headers, rows);
  }
}

async function exportViews(options: ExportOptions): Promise<string> {
  const { dateFrom, dateTo, format } = options;

  const filters: any = {};

  if (dateFrom || dateTo) {
    filters.date = {};
    if (dateFrom) filters.date.$gte = new Date(dateFrom);
    if (dateTo) filters.date.$lte = new Date(dateTo);
  }

  const dailyViews = await getCollection("daily_views");
  const views = await dailyViews.find(filters).sort({ date: -1 }).toArray();

  if (format === "json") {
    return JSON.stringify(views, null, 2);
  } else {
    // CSV
    const headers = ["Date", "Views", "Visitors", "Popular Posts"];
    const rows = views.map((view: any) => [
      view.date ? new Date(view.date).toISOString().split("T")[0] : "",
      view.views || "0",
      view.visitors || "0",
      view.popularPosts ? view.popularPosts.join("; ") : "",
    ]);

    return toCSV(headers, rows);
  }
}
export async function GET(context: APIContext): Promise<Response> {
  const adminUser = getAdminUser(context);
  if (!adminUser) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 403,
    });
  }

  try {
    const url = new URL(context.request.url);
    const options: ExportOptions = {
      format: (url.searchParams.get("format") as "json" | "csv") || "json",
      type:
        (url.searchParams.get("type") as "comments" | "likes" | "views") ||
        "comments",
      dateFrom: url.searchParams.get("dateFrom") || undefined,
      dateTo: url.searchParams.get("dateTo") || undefined,
      postId: url.searchParams.get("postId") || undefined,
      commentType:
        (url.searchParams.get("commentType") as "blog" | "telegram") || "blog",
    };

    let data: string;

    switch (options.type) {
      case "comments":
        data = await exportComments(options);
        break;
      case "likes":
        data = await exportLikes(options);
        break;
      case "views":
        data = await exportViews(options);
        break;
      default:
        throw new Error("Unsupported export type");
    }

    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="export-${options.type}-${Date.now()}.${options.format}"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return new Response(JSON.stringify({ error: "Export failed" }), {
      status: 500,
    });
  }
}

import type { APIContext } from "astro";
import { getCollection } from "@/lib/mongodb.server";

// 每篇文章总浏览量
const POST_VIEWS_COLLECTION = "post_views";
// 每日全站浏览量（按东八区日期聚合）
const DAILY_VIEWS_COLLECTION = "daily_views";

function getAsiaShanghaiDateString() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const beijing = new Date(utc + 8 * 60 * 60000);
  const year = beijing.getFullYear();
  const month = String(beijing.getMonth() + 1).padStart(2, "0");
  const day = String(beijing.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// 获取某篇文章当前总浏览量
export async function GET({ request }: APIContext): Promise<Response> {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");

  if (!slug) {
    return new Response(JSON.stringify({ error: "缺少 slug 参数" }), {
      status: 400,
    });
  }

  try {
    const collection = await getCollection(POST_VIEWS_COLLECTION);
    const postViews = await collection.findOne({ slug });
    const totalViews = postViews ? postViews.views || 0 : 0;

    return new Response(JSON.stringify({ slug, totalViews }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching post views:", error);
    return new Response(JSON.stringify({ error: "服务器内部错误" }), {
      status: 500,
    });
  }
}

// 记录一次浏览：
// - 按 slug 的总浏览量 +1（前端保证每个设备同一篇只记一次）
// - 按当天东八区日期的全站浏览量 +1
export async function POST({ request }: APIContext): Promise<Response> {
  try {
    const { slug } = await request.json();

    if (!slug) {
      return new Response(
        JSON.stringify({ success: false, message: "缺少 slug 参数" }),
        { status: 400 },
      );
    }

    const now = new Date();
    const dateKey = getAsiaShanghaiDateString();

    // 更新 PostViews（按 slug 统计总浏览数）
    const postViewsCollection = await getCollection(POST_VIEWS_COLLECTION);
    const postUpdateResult = await postViewsCollection.findOneAndUpdate(
      { slug },
      {
        $inc: { views: 1 },
        $setOnInsert: {
          slug,
          createdAt: now,
        },
        $set: {
          updatedAt: now,
        },
      },
      { upsert: true, returnDocument: "after" },
    );

    // 更新 DailyViews（按日期统计全站浏览数）
    const dailyViewsCollection = await getCollection(DAILY_VIEWS_COLLECTION);
    const dailyUpdateResult = await dailyViewsCollection.findOneAndUpdate(
      { date: dateKey },
      {
        $inc: { views: 1 },
        $setOnInsert: {
          date: dateKey,
          createdAt: now,
        },
        $set: {
          updatedAt: now,
        },
      },
      { upsert: true, returnDocument: "after" },
    );

    return new Response(
      JSON.stringify({
        success: true,
        slug,
        totalViews: postUpdateResult?.views || 0,
        dailyViews: dailyUpdateResult?.views || 0,
        date: dateKey,
        timestamp: now.toISOString(),
      }),
      { status: 200 },
    );
  } catch (error) {
    console.error("Error recording post view:", error);
    return new Response(
      JSON.stringify({ success: false, message: "服务器内部错误" }),
      { status: 500 },
    );
  }
}

import type { APIContext } from "astro";
import AV from "leancloud-storage";
import { initLeanCloud } from "@/lib/leancloud.server";

// 初始化 LeanCloud（仅服务器端）
initLeanCloud();

// 每篇文章总浏览量
const POST_VIEWS_CLASS = "PostViews";
// 每日全站浏览量（按东八区日期聚合）
const DAILY_VIEWS_CLASS = "DailyViews";

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
    const query = new AV.Query(POST_VIEWS_CLASS);
    query.equalTo("slug", slug);
    const postViews = await query.first();
    const totalViews = postViews ? postViews.get("views") || 0 : 0;

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
    const postQuery = new AV.Query(POST_VIEWS_CLASS);
    postQuery.equalTo("slug", slug);
    let postViews = await postQuery.first();

    if (!postViews) {
      const PostViews = AV.Object.extend(POST_VIEWS_CLASS);
      postViews = new PostViews();
      postViews.set("slug", slug);
      postViews.set("views", 0);
    }

    (postViews as AV.Object).increment("views", 1);

    // 更新 DailyViews（按日期统计全站浏览数）
    const dailyQuery = new AV.Query(DAILY_VIEWS_CLASS);
    dailyQuery.equalTo("date", dateKey);
    let dailyViews = await dailyQuery.first();

    if (!dailyViews) {
      const DailyViews = AV.Object.extend(DAILY_VIEWS_CLASS);
      dailyViews = new DailyViews();
      dailyViews.set("date", dateKey);
      dailyViews.set("views", 0);
    }

    (dailyViews as AV.Object).increment("views", 1);

    const [savedPostViews, savedDailyViews] = await Promise.all([
      postViews.save(),
      dailyViews.save(),
    ]);

    return new Response(
      JSON.stringify({
        success: true,
        slug,
        totalViews: savedPostViews.get("views") || 0,
        dailyViews: savedDailyViews.get("views") || 0,
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

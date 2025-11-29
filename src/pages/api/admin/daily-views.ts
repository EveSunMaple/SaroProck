import type { APIContext } from "astro";
import AV from "leancloud-storage";
import { getAdminUser } from "@/lib/auth";
import { initLeanCloud } from "@/lib/leancloud.server";

// 初始化 LeanCloud
initLeanCloud();

const DAILY_VIEWS_CLASS = "DailyViews";

export async function GET(context: APIContext): Promise<Response> {
  const adminUser = getAdminUser(context);
  if (!adminUser) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 403,
    });
  }

  const url = new URL(context.request.url);
  const days = Number.parseInt(url.searchParams.get("days") || "30", 10);

  try {
    const query = new AV.Query(DAILY_VIEWS_CLASS);
    query.addAscending("date");
    query.limit(365); // 最多一年
    const results = await query.find();

    // 将数据映射为 { date: string, views: number }
    const allData = results
      .map((item) => ({
        date: item.get("date") as string,
        views: (item.get("views") as number) || 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 只保留最近 N 天（按日期字符串从后往前截取）
    const sliced = allData.length > days ? allData.slice(-days) : allData;

    return new Response(JSON.stringify({ data: sliced }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching daily views:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch daily views" }),
      { status: 500 },
    );
  }
}

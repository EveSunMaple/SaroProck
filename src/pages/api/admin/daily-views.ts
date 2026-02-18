import type { APIContext } from "astro";
import { getAdminUser } from "@/lib/auth";
import { getCollection } from "@/lib/mongodb.server";

const DAILY_VIEWS_COLLECTION = "daily_views";

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
    const collection = await getCollection(DAILY_VIEWS_COLLECTION);
    const results = await collection
      .find({})
      .sort({ date: 1 })
      .limit(365) // 最多一年
      .toArray();

    // 将数据映射为 { date: string, views: number }
    const allData = results
      .map((item) => ({
        date: item.date as string,
        views: (item.views as number) || 0,
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

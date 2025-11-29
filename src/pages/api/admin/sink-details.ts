import type { APIContext } from "astro";
import { getAdminUser } from "@/lib/auth";

async function proxyToSinkAPI(
  sinkUrl: string | undefined,
  sinkApiKey: string | undefined,
  event: APIContext,
) {
  if (!sinkApiKey || !sinkUrl) {
    return new Response(
      JSON.stringify({ error: "Sink API URL or Key is not configured." }),
      { status: 500 },
    );
  }

  const requestUrl = new URL(event.request.url);
  const targetParams = new URLSearchParams(requestUrl.search);

  targetParams.delete("report");

  const period = targetParams.get("period");
  if (period) {
    if (period === "last-7d") {
      const now = new Date();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);

      const endAt = Math.floor(now.getTime() / 1000);
      const startAt = Math.floor(sevenDaysAgo.getTime() / 1000);

      targetParams.set("startAt", startAt.toString());
      targetParams.set("endAt", endAt.toString());

      if (!targetParams.has("clientTimezone")) {
        targetParams.set("clientTimezone", "Asia/Shanghai");
      }
    }

    targetParams.delete("period");
  }

  const targetUrl = new URL(sinkUrl);
  targetUrl.search = targetParams.toString();

  try {
    const response = await fetch(targetUrl.toString(), {
      headers: {
        Authorization: `Bearer ${sinkApiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Error from Sink API (${targetUrl.toString()}):`,
        errorText,
      );
      return new Response(
        JSON.stringify({
          error: `Failed to fetch from Sink API: ${errorText}`,
        }),
        { status: response.status },
      );
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}

export async function GET(event: APIContext): Promise<Response> {
  const adminUser = getAdminUser(event);
  if (!adminUser) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 403,
    });
  }

  // [修改] 从环境变量中读取基础配置
  const sinkApiKey = import.meta.env.SINK_API_KEY;
  const sinkBaseUrl = import.meta.env.SINK_PUBLIC_URL;

  const url = new URL(event.request.url);
  const reportType = url.searchParams.get("report");

  let sinkUrl: string | undefined;
  // [修改] 动态构建 Sink URL
  if (reportType === "views") {
    sinkUrl = sinkBaseUrl ? `${sinkBaseUrl}/api/stats/views` : undefined;
  } else if (reportType === "metrics") {
    sinkUrl = sinkBaseUrl ? `${sinkBaseUrl}/api/stats/metrics` : undefined;
  } else {
    return new Response(
      JSON.stringify({ error: "Invalid report type specified." }),
      { status: 400 },
    );
  }

  return proxyToSinkAPI(sinkUrl, sinkApiKey, event);
}

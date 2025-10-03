import type { AstroGlobal } from "astro";
import { LRUCache } from "lru-cache";
import { $fetch } from "ofetch";
import { ProxyAgent } from "undici";

// 初始化缓存
const cache = new LRUCache<string, string>({
  max: 500,
  ttl: 1000 * 60 * 5, // 5 分钟
});

// 获取环境变量的辅助函数
function getEnv(Astro: any, name: string): string | undefined {
  return import.meta.env[name] ?? Astro.locals?.runtime?.env?.[name];
}

/**
 * 从 Telegram 获取原始 HTML
 * @param Astro Astro 全局对象
 * @param options 请求参数
 * @returns 返回 HTML 字符串
 */
export async function fetchTelegramHtml(
  Astro: AstroGlobal,
  options: { before?: string; after?: string; q?: string; id?: string } = {},
): Promise<string> {
  const { before, after, q, id } = options;
  const cacheKey = JSON.stringify({ id, before, after, q });

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  const host = getEnv(Astro, "TELEGRAM_HOST") ?? "t.me";
  const channel = getEnv(Astro, "CHANNEL")

  if (!channel) {
    throw new Error("CHANNEL environment variable is not set.");
  }

  const url = id
    ? `https://${host}/${channel}/${id}?embed=1&mode=tme`
    : `https://${host}/s/${channel}`;

  const proxyUrl = getEnv(Astro, "HTTP_PROXY");
  const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;
  const headers = Object.fromEntries(Astro.request.headers);

  const html = await $fetch<string>(url, {
    headers,
    query: { before, after, q },
    retry: 3,
    dispatcher,
  });

  cache.set(cacheKey, html);
  return html;
}

import type { AstroGlobal } from "astro";
// src/lib/telegram/index.ts
import * as cheerio from "cheerio";
import type { ChannelInfo, TelegramPost } from "@/types";
import { fetchTelegramHtml } from "./api";
import { parsePost } from "./parser";

function getEnv(Astro: any, name: string): string | undefined {
  return import.meta.env[name] ?? Astro.locals?.runtime?.env?.[name];
}

/**
 * 获取频道信息和动态列表
 */
export async function getChannelFeed(
  Astro: AstroGlobal,
  options: { before?: string; after?: string; q?: string } = {},
): Promise<ChannelInfo> {
  const html = await fetchTelegramHtml(Astro, options);
  const $ = cheerio.load(html);
  const channel = getEnv(Astro, "CHANNEL")!;

  const posts: TelegramPost[] = [];

  $(".tgme_channel_history .tgme_widget_message_wrap").each((_, wrap) => {
    const postElement = $(wrap).find(".tgme_widget_message").get(0);
    if (postElement) {
      posts.push(parsePost(postElement, $, channel));
    }
  });

  return {
    title: $(".tgme_channel_info_header_title")?.text() || "Telegram Channel",
    description: $(".tgme_channel_info_description")?.text() || "",
    avatar: $(".tgme_page_photo_image img")?.attr("src") || "",
    subscribers:
      Number.parseInt(
        $(".tgme_channel_info_counter .counter_value")
          .eq(0)
          .text()
          .replaceAll(/\s/g, ""),
        10,
      ) || null,
    photos:
      Number.parseInt(
        $(".tgme_channel_info_counter .counter_value")
          .eq(1)
          .text()
          .replaceAll(/\s/g, ""),
        10,
      ) || null,
    posts: posts.reverse(),
  };
}

/**
 * 根据 ID 获取单条动态
 */
export async function getPostById(
  Astro: AstroGlobal,
  id: string,
): Promise<TelegramPost | null> {
  const html = await fetchTelegramHtml(Astro, { id });
  const $ = cheerio.load(html);
  const channel = getEnv(Astro, "CHANNEL")!;

  const postElement = $(".tgme_widget_message").get(0);
  if (!postElement) return null;

  return parsePost(postElement, $, channel);
}

import type { Cheerio, CheerioAPI } from "cheerio";
import type { Element } from "domhandler";
import md5 from "md5";
import type { LinkPreview, MediaFile, Reply, TelegramPost } from "@/types";
import dayjs from "./dayjs-setup";

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function logTelegramParseFailed(
  event: string,
  input: string,
  error: unknown,
): void {
  const inputHash = md5(input);
  console.error(event, { error: safeErrorMessage(error), inputHash });
}

function parseImages(item: Cheerio<Element>, $: CheerioAPI): MediaFile[] {
  return item
    .find(".tgme_widget_message_photo_wrap")
    .map((_, photo) => {
      const url = $(photo)
        .attr("style")
        ?.match(/url\(["'](.*?)["']/)?.[1];
      return url ? { type: "image", url } : null;
    })
    .get()
    .filter(Boolean) as MediaFile[];
}

function parseVideos(item: Cheerio<Element>, $: CheerioAPI): MediaFile[] {
  const videos: MediaFile[] = [];
  item.find(".tgme_widget_message_video_wrap video").each((_, video) => {
    const url = $(video).attr("src");
    if (url) {
      videos.push({
        type: "video",
        url,
        thumbnail: $(video).attr("poster") || undefined,
      });
    }
  });
  return videos;
}

function parseLinkPreview(
  item: Cheerio<Element>,
  _: CheerioAPI,
): LinkPreview | undefined {
  const link = item.find(".tgme_widget_message_link_preview");
  const url = link.attr("href");
  if (!url) return undefined;

  const title =
    link.find(".link_preview_title").text() ||
    link.find(".link_preview_site_name").text();
  const description = link.find(".link_preview_description").text();
  const imageSrc = link
    .find(".link_preview_image")
    ?.attr("style")
    ?.match(/url\(["'](.*?)["']\)/i)?.[1];

  try {
    const hostname = new URL(url).hostname;
    return { url, title, description, image: imageSrc, hostname };
  } catch (error) {
    logTelegramParseFailed("telegram_parse_link_preview_failed", url, error);
    return undefined;
  }
}

function extractReplyData(
  reply: Cheerio<Element>,
  $: CheerioAPI,
  channel: string,
): {
  href: string;
  author: string;
  html: string;
  thumb?: string;
  targetChannel: string;
  targetId: string;
  finalUrl: string;
  isExternal: boolean;
} | null {
  reply.find("i.emoji").each((_, el) => {
    $(el).removeAttr("style");
  });

  const href = reply.attr("href");
  if (!href) return null;

  let targetChannel = channel;
  let targetId = "";
  let finalUrl = "";
  let isExternal = false;

  if (href.startsWith("https://t.me/")) {
    const match = href.match(/^https:\/\/t\.me\/([^/]+)\/(\d+)/);
    if (!match) return null;
    targetChannel = match[1];
    targetId = match[2];
    finalUrl = href;
    isExternal = targetChannel !== channel;
  } else if (href.startsWith("/")) {
    const parts = href.split("/");
    targetId = parts.pop() || "";
    finalUrl = `/post/${targetId}`;
  } else {
    return null;
  }

  const author =
    reply.find(".tgme_widget_message_author_name").text()?.trim() ||
    targetChannel ||
    "未知用户";

  const textHtml = reply.find(".tgme_widget_message_text").html()?.trim() || "";

  let text = textHtml;
  if (!text) {
    if (reply.find(".tgme_widget_message_photo").length > 0) text = "[图片]";
    else if (reply.find(".tgme_widget_message_sticker").length > 0)
      text = "[贴纸]";
    else if (reply.find(".tgme_widget_message_video").length > 0)
      text = "[视频]";
    else text = "...";
  }

  const thumbStyle = reply
    .find(".tgme_widget_message_reply_thumb")
    .attr("style");
  const thumb = thumbStyle?.match(/url\(['"]?(.*?)['"]?\)/)?.[1];

  return {
    href,
    author,
    html: text,
    thumb,
    targetChannel,
    targetId,
    finalUrl,
    isExternal,
  };
}

function formatReplyOutput(data: {
  author: string;
  html: string;
  thumb?: string;
  targetChannel: string;
  targetId: string;
  finalUrl: string;
  isExternal: boolean;
}): Reply {
  return {
    url: data.finalUrl,
    author: data.author,
    html: data.html,
    thumb: data.thumb,
    isExternal: data.isExternal,
    targetChannel: data.targetChannel,
    targetId: data.targetId,
  };
}

function parseReply(
  item: Cheerio<Element>,
  $: CheerioAPI,
  channel: string,
): Reply | undefined {
  const reply = item.find(".tgme_widget_message_reply");
  if (reply.length === 0) return undefined;

  try {
    const data = extractReplyData(reply, $, channel);
    if (!data) return undefined;
    return formatReplyOutput(data);
  } catch (error) {
    logTelegramParseFailed(
      "telegram_parse_reply_failed",
      reply.attr("href") || "",
      error,
    );
    return undefined;
  }
}

function parseMediaGroup(item: Cheerio<Element>, $: CheerioAPI): MediaFile[] {
  try {
    return [...parseImages(item, $), ...parseVideos(item, $)];
  } catch (error) {
    logTelegramParseFailed(
      "telegram_parse_media_failed",
      item.attr("data-post") || "",
      error,
    );
    return [];
  }
}

/**
 * @returns 返回一个格式化后的 HTML 字符串，如果没有则返回空字符串
 */
function parseUnsupportedMedia(
  item: Cheerio<Element>,
  _$: CheerioAPI,
  postLink: string,
): string {
  const unsupportedWrap = item.find(".message_media_not_supported_wrap");
  if (unsupportedWrap.length === 0) return "";

  const label = "媒体文件过大";

  return `
      <div class="unsupported-media-notice not-prose my-2 p-3 bg-base-300/30 border border-base-content/10 rounded-lg flex items-center justify-between gap-2 text-sm">
        <div class="flex items-center gap-2">
          <i class="ri-error-warning-line text-warning"></i>
          <span>${label}，无法预览。</span>
        </div>
        <a href="${postLink}" target="_blank" rel="noopener noreferrer" class="btn btn-xs btn-ghost">
          在 Telegram 中查看
          <i class="ri-external-link-line"></i>
        </a>
      </div>
    `;
}

export function parsePost(
  element: Element,
  $: CheerioAPI,
  channel: string,
): TelegramPost {
  const item = $(element);
  const id = item.attr("data-post")?.replace(`${channel}/`, "") || "0";
  const postLink = `https://t.me/${channel}/${id}`;

  try {
    const datetime =
      item.find(".tgme_widget_message_date time")?.attr("datetime") || "";
    const formattedDate = datetime
      ? dayjs(datetime).tz("Asia/Shanghai").fromNow()
      : "未知时间";

    const textElement = item
      .find(".tgme_widget_message_text")
      .filter((_, el) => !el.attribs.class.includes("js-message_reply_text"))
      .clone();
    textElement.find("a").each((_, el) => {
      const link = $(el);
      if (link.text().startsWith("#")) {
        link.addClass("hashtag");
      } else {
        link.addClass("link link-primary");
      }
    });

    textElement
      .find(".tgme_widget_message_photo_wrap, .tgme_widget_message_video_wrap")
      .remove();

    textElement.find("i.emoji").each((_, el) => {
      $(el).removeAttr("style");
    });

    const unsupportedMediaHtml = parseUnsupportedMedia(item, $, postLink);

    return {
      id,
      datetime,
      formattedDate,
      text: item.find(".tgme_widget_message_text").text() || "",
      htmlContent: (textElement.html() || "") + unsupportedMediaHtml,
      views: item.find(".tgme_widget_message_views").text() || "0",
      media: parseMediaGroup(item, $),
      linkPreview: parseLinkPreview(item, $),
      reply: parseReply(item, $, channel),
    };
  } catch (error) {
    logTelegramParseFailed("telegram_parse_post_failed", postLink, error);
    return {
      id,
      datetime: "",
      formattedDate: "未知时间",
      text: "",
      htmlContent: "",
      views: "0",
      media: [],
    };
  }
}

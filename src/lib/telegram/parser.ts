import type { Cheerio, CheerioAPI } from "cheerio";
import type { Element } from "domhandler";
import type { LinkPreview, MediaFile, Reply, TelegramPost } from "@/types";
import dayjs from "./dayjs-setup";

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
  } catch {
    return undefined;
  }
}

function parseReply(
  item: Cheerio<Element>,
  $: CheerioAPI,
  channel: string,
): Reply | undefined {
  const reply = item.find(".tgme_widget_message_reply");
  if (reply.length === 0) return undefined;

  reply.find("i.emoji").each((_, el) => {
    $(el).removeAttr("style");
  });

  const href = reply.attr("href");
  if (!href) return undefined;

  // 解析目标频道与 ID
  let targetChannel = channel;
  let targetId = "";
  let finalUrl = "";
  let isExternal = false;

  if (href.startsWith("https://t.me/")) {
    const match = href.match(/^https:\/\/t\.me\/([^/]+)\/(\d+)/);
    if (match) {
      targetChannel = match[1];
      targetId = match[2];
      finalUrl = href; // 保留完整外部链接
      isExternal = targetChannel !== channel;
    }
  } else if (href.startsWith("/")) {
    const parts = href.split("/");
    targetId = parts.pop() || "";
    finalUrl = `/post/${targetId}`;
  }

  // 作者
  const author =
    reply.find(".tgme_widget_message_author_name").text()?.trim() ||
    targetChannel ||
    "未知用户";

  // 回复文本（HTML）
  const textHtml = reply.find(".tgme_widget_message_text").html()?.trim() || "";

  // 如果没有文本，检查是否是图片、视频等
  let text = textHtml;
  if (!text) {
    if (reply.find(".tgme_widget_message_photo").length > 0) text = "[图片]";
    else if (reply.find(".tgme_widget_message_sticker").length > 0)
      text = "[贴纸]";
    else if (reply.find(".tgme_widget_message_video").length > 0)
      text = "[视频]";
    else text = "...";
  }

  // 缩略图
  const thumbStyle = reply
    .find(".tgme_widget_message_reply_thumb")
    .attr("style");
  const thumb = thumbStyle?.match(/url\(['"]?(.*?)['"]?\)/)?.[1];

  return {
    url: finalUrl,
    author,
    html: text,
    thumb,
    isExternal,
    targetChannel,
    targetId,
  };
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
    media: [...parseImages(item, $), ...parseVideos(item, $)],
    linkPreview: parseLinkPreview(item, $),
    reply: parseReply(item, $, channel),
  };
}

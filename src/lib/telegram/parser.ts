import type { Cheerio, CheerioAPI } from "cheerio";
import type { Element } from "domhandler";
import type { LinkPreview, MediaFile, Reply, TelegramPost } from "@/types";
import dayjs from "./dayjs-setup";
function parseImages(item: Cheerio<Element>, $: CheerioAPI): MediaFile[] {
  return item.find(".tgme_widget_message_photo_wrap").map((_, photo) => {
    const rawUrl = $(photo).attr("style")?.match(/url\(["'](.*?)["']/)?.[1];
    // 用正则提取 /file/ 及其后面的内容
    const filePath = rawUrl?.match(/\/file\/.+/i)?.[0];
    // 如果需要拼接 image.shinji.ren 域名
    const url = filePath ? `https://tgimg.shinji.ren${filePath}` : undefined;
    return url ? { type: "image", url } : null;
  }).get().filter(Boolean) as MediaFile[];
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

function parseLinkPreview(item: Cheerio<Element>, $: CheerioAPI): LinkPreview | undefined {
  const link = item.find(".tgme_widget_message_link_preview");
  const url = link.attr("href");
  if (!url)
    return undefined;

  const title = link.find(".link_preview_title").text() || link.find(".link_preview_site_name").text();
  const description = link.find(".link_preview_description").text();
  const imageSrc = link.find(".link_preview_image")?.attr("style")?.match(/url\(["'](.*?)["']/i)?.[1];

  try {
    const hostname = new URL(url).hostname;
    return { url, title, description, image: imageSrc, hostname };
  }
  catch {
    return undefined;
  }
}

function parseReply(item: Cheerio<Element>, $: CheerioAPI, channel: string): Reply | undefined {
  const reply = item.find(".tgme_widget_message_reply");
  if (reply.length === 0)
    return undefined;

  const href = reply.attr("href");
  if (!href)
    return undefined;

  const id = href.split("/").pop() || "";
  const author = reply.find(".tgme_widget_message_author_name").text() || "未知用户";

  let text = reply.text().replace(author, "").trim();

  if (!text) {
    if (reply.find(".tgme_widget_message_photo").length > 0)
      text = "[图片]";
    else if (reply.find(".tgme_widget_message_sticker").length > 0)
      text = "[贴纸]";
    else if (reply.find(".tgme_widget_message_video").length > 0)
      text = "[视频]";
    else text = "...";
  }

  return {
    url: `/post/${id}`,
    author,
    text,
  };
}

/**
 * @returns 返回一个格式化后的 HTML 字符串，如果没有则返回空字符串
 */
function parseUnsupportedMedia(item: Cheerio<Element>, $: CheerioAPI, postLink: string): string {
  const unsupportedWrap = item.find(".message_media_not_supported_wrap");
  if (unsupportedWrap.length === 0)
    return "";

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

export function parsePost(element: Element, $: CheerioAPI, channel: string): TelegramPost {
  const item = $(element);
  const id = item.attr("data-post")?.replace(`${channel}/`, "") || "0";
  const postLink = `https://t.me/${channel}/${id}`;

  const datetime = item.find(".tgme_widget_message_date time")?.attr("datetime") || "";
  const formattedDate = datetime ? dayjs(datetime).tz("Asia/Shanghai").fromNow() : "未知时间";

  const textElement = item.find(".tgme_widget_message_text").clone();

  textElement.find("a").each((_, el) => {
    const link = $(el);
    if (link.text().startsWith("#")) {
      link.addClass("hashtag");
    }
    else {
      link.addClass("link link-primary");
    }
  });

  textElement.find(".tgme_widget_message_photo_wrap, .tgme_widget_message_video_wrap").remove();

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

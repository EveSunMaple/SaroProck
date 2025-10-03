// src/types.ts

// 媒体文件（图片/视频）
export interface MediaFile {
  type: "image" | "video" | "roundVideo";
  url: string; // 媒体文件链接
  thumbnail?: string; // 视频缩略图
  alt?: string; // 图片描述
}

// 链接预览
export interface LinkPreview {
  url: string;
  title: string;
  description?: string;
  image?: string; // 预览图
  hostname: string;
}

// 回复对象
export interface Reply {
  url: string; // 指向被回复消息的链接
  author: string;
  text: string;
}

// 单条 Telegram 动态
export interface TelegramPost {
  id: string;
  datetime: string;
  formattedDate: string;
  text: string; // 纯文本内容
  htmlContent: string; // 带格式的 HTML 内容
  views: string;
  media: MediaFile[];
  linkPreview?: LinkPreview;
  reply?: Reply;
  [key: string]: any;
}

// 频道信息（包含多条动态）
export interface ChannelInfo {
  title: string;
  description: string;
  avatar: string;
  subscribers: number | null;
  photos: number | null;
  posts: TelegramPost[];
}

// Astro 全局 locals 类型（用于 SSR）
// 这可以让你在所有组件中安全地访问环境变量
declare module "astro" {
  interface Locals {
    runtime: {
      env: {
        [key: string]: string;
      };
    };
  }
}

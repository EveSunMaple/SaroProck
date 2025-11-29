// src/lib/blog.ts
import { type CollectionEntry, getCollection } from "astro:content";
import { getShortLink } from "./shortlink";

// 导出完整的文章数据类型，包含短链接
export type ProcessedBlogEntry = CollectionEntry<"blog"> & {
  shortLink: string | null; // 每篇文章都会有一个短链接或 null
  longUrl: string; // 原始的、完整的 URL
};

// 使用一个简单的内存缓存，确保在一次构建中只处理一次
let processedPosts: ProcessedBlogEntry[] | null = null;

/**
 * 获取所有博客文章，并为每一篇生成短链接。
 * 采用了缓存机制，确保在同一次构建中只执行一次。
 * @param siteUrl - 网站的根 URL，用于生成长链接
 */
export async function getAllPostsWithShortLinks(
  siteUrl: URL,
): Promise<ProcessedBlogEntry[]> {
  if (processedPosts) {
    return processedPosts;
  }

  const allPosts = await getCollection(
    "blog",
    ({ data }: CollectionEntry<"blog">) => data.draft !== true,
  );

  const postsWithLinks = await Promise.all(
    allPosts.map(async (post: CollectionEntry<"blog">) => {
      const longUrl = new URL(`/blog/${post.slug}`, siteUrl).toString();
      const shortLink = await getShortLink({
        longUrl,
        slug: post.slug,
      });

      return {
        ...post,
        longUrl,
        shortLink,
      };
    }),
  );

  processedPosts = postsWithLinks.sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  );

  return processedPosts;
}

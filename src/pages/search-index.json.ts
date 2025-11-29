import type { APIRoute } from "astro";
import { remark } from "remark";
import strip from "strip-markdown";
import { getAllPostsWithShortLinks } from "@/lib/blog";

export const prerender = true;

interface SearchIndexEntry {
  title: string;
  url: string;
  description: string;
  tags: string[];
  categories: string[];
  contentText: string;
}

export const GET: APIRoute = async ({ site }) => {
  if (!site) {
    throw new Error(
      "A `site` property is required in your astro.config.mjs for search-index.json to work.",
    );
  }

  const allPosts = await getAllPostsWithShortLinks(site);
  const processor = remark().use(strip);

  const entries: SearchIndexEntry[] = await Promise.all(
    allPosts.map(async (post) => {
      const { title, description = "", tags = [], categories = [] } = post.data;
      const { value: content } = await processor.process(post.body);
      const contentText = String(content);

      return {
        title,
        url: post.shortLink || post.longUrl,
        description,
        tags,
        categories,
        contentText,
      };
    }),
  );

  return new Response(JSON.stringify(entries), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

import { getCollection } from "astro:content";
import rss from "@astrojs/rss";

export const prerender = true;

export async function GET(context: any) {
  const posts = await getCollection("blog");
  const sortedPosts = posts.sort(
    (a: any, b: any) =>
      new Date(b.data.pubDate).getTime() - new Date(a.data.pubDate).getTime(),
  );
  return rss({
    title: "サン猫の時間漂流",
    description: "一个孤独的地方，散落着一个人的人生碎片",
    site: context.site,
    items: sortedPosts.map((blog: any) => ({
      ...blog.data,
      link: `/blog/${blog.slug}/`,
    })),
  });
}

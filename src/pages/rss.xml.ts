import rss from "@astrojs/rss";
import { marked } from "marked";
import { getAllPostsWithShortLinks } from "@/lib/blog";

export const prerender = true;

export async function GET(context: any) {
  if (!context.site) {
    throw new Error("A `site` property is required in your astro.config.mjs for this RSS feed to work.");
  }

  const posts = await getAllPostsWithShortLinks(context.site);

  function replacePath(content: string, siteUrl: string): string {
    return content.replace(/(src|href)="([^"]+)"/g, (match, attr, value) => {
      if (!/^https?:\/\/|^\/\//.test(value) && !value.startsWith("data:")) {
        try {
          return `${attr}="${new URL(value, siteUrl).toString()}"`;
        }
        catch {
          return match;
        }
      }
      return match;
    });
  }

  const items = await Promise.all(posts.map(async (post) => {
    const { data: { title, description, pubDate } } = post;

    const content = post.body
      ? replacePath(await marked.parse(post.body), context.site)
      : "No content available.";

    return {
      title,
      description,
      link: post.shortLink || post.longUrl,
      guid: post.longUrl,
      content,
      pubDate: new Date(pubDate),
      customData: `<dc:creator><![CDATA[光影伴行簿]]></dc:creator>`,
    };
  }));

  return rss({
    title: "光影伴行簿",
    description: "用光影，伴随前行的脚步，记录生活的点滴",
    site: context.site.toString(),
    items,
    stylesheet: "/rss.xsl",
    customData: `
      <language>zh-CN</language>
      <atom:link href="${new URL(context.url.pathname, context.site)}" rel="self" type="application/rss+xml" />
      <image>
        <url>${new URL("/favicon.png", context.site).toString()}</url>
        <title>光影伴行簿</title>
        <link>${context.site}</link>
      </image>
    `,
    xmlns: {
      dc: "http://purl.org/dc/elements/1.1/",
      content: "http://purl.org/rss/1.0/modules/content/",
      atom: "http://www.w3.org/2005/Atom",
    },
  });
}

import { getCollection } from "astro:content";
import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
  try {
    // 获取所有非草稿文章
    const blogEntries = await getCollection("blog", ({ data }) => {
      return !data.draft;
    });

    // 从所有文章中提取唯一的标签和分类
    const tags = new Set<string>();
    const categories = new Set<string>();

    for (const entry of blogEntries) {
      if (entry.data.tags) {
        for (const tag of entry.data.tags) {
          tags.add(tag);
        }
      }
      if (entry.data.categories) {
        for (const category of entry.data.categories) {
          categories.add(category);
        }
      }
    }

    // 构建响应对象
    const response = {
      tags: Array.from(tags).sort(),
      categories: Array.from(categories).sort(),
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error fetching content metadata:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch content metadata",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
};

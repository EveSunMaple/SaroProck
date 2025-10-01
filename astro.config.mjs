import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import vercel from "@astrojs/vercel";
import compress from "@playform/compress";
import terser from "@rollup/plugin-terser";
import tailwindcss from "@tailwindcss/vite";
import expressiveCode from "astro-expressive-code";
import icon from "astro-icon";
import { defineConfig } from "astro/config";
import rehypeKatex from "rehype-katex";

import remarkMath from "remark-math";

// https://astro.build/config
export default defineConfig({
  site: "https://blog.ericzhao3366.work",
  output: "server",
  adapter: vercel(),
  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [expressiveCode(), mdx(), react(), sitemap(), compress(), terser({ compress: true, mangle: true }), icon()],
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
  },
});

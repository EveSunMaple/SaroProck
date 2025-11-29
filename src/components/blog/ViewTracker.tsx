import type React from "react";
import { useEffect } from "react";

interface Props {
  slug: string;
}

// 仅在客户端运行，用 localStorage 保证每个 slug 每个设备只计一次浏览
const ViewTracker: React.FC<Props> = ({ slug }) => {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const storageKey = "viewed_blog_slugs";
    const raw = localStorage.getItem(storageKey);
    const viewed = new Set<string>(raw ? JSON.parse(raw) : []);

    if (viewed.has(slug)) return;

    viewed.add(slug);
    localStorage.setItem(storageKey, JSON.stringify(Array.from(viewed)));

    // 首次浏览该 slug，通知后端计数
    fetch("/api/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    }).catch((err) => {
      console.error("Failed to record view", err);
    });
  }, [slug]);

  return null;
};

export default ViewTracker;

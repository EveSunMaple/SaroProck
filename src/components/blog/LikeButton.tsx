import confetti from "canvas-confetti";
// src/components/blog/LikeButton.tsx
import React, { useEffect, useRef, useState } from "react";

// 获取或生成唯一的设备ID
const getDeviceId = (): string => {
  if (typeof window === "undefined")
    return "ssr-user";
  const key = "comment_device_id"; // 复用评论的设备ID
  let deviceId = localStorage.getItem(key);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(key, deviceId);
  }
  return deviceId;
};

interface Props {
  postId: string;
}

const BlogLikeButton: React.FC<Props> = ({ postId }) => {
  const [likeCount, setLikeCount] = useState<number>(0);
  const [hasLiked, setHasLiked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClicked, setIsClicked] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const storageKey = `liked_blog_posts`; // 使用独立的 key

  useEffect(() => {
    let isMounted = true;
    const deviceId = getDeviceId();

    const fetchInitialState = async () => {
      try {
        const response = await fetch(`/api/like?postId=${postId}&deviceId=${deviceId}`);
        if (!response.ok)
          throw new Error("Failed to fetch");
        const data = await response.json();
        if (isMounted) {
          setLikeCount(data.likeCount);
          setHasLiked(data.hasLiked);
        }
      }
      catch (error) {
        console.error(`Failed to fetch likes for post ${postId}:`, error);
        const likedPosts = JSON.parse(localStorage.getItem(storageKey) || "[]");
        if (isMounted && likedPosts.includes(postId)) {
          setHasLiked(true);
        }
      }
      finally {
        if (isMounted)
          setIsLoading(false);
      }
    };

    fetchInitialState();

    return () => { isMounted = false; };
  }, [postId]);

  const handleClick = async () => {
    if (isSubmitting || isLoading)
      return;

    setIsSubmitting(true);
    const newLikedState = !hasLiked;
    const deviceId = getDeviceId();

    setHasLiked(newLikedState);
    setLikeCount((prev) => newLikedState ? prev + 1 : Math.max(0, prev - 1));

    if (newLikedState) {
      setIsClicked(true);
      setTimeout(() => setIsClicked(false), 400);
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const x = (rect.left + rect.right) / 2 / window.innerWidth;
        const y = (rect.top + rect.bottom) / 2 / window.innerHeight;
        confetti({ particleCount: 100, spread: 70, origin: { x, y }, colors: ["#fb7185", "#fda4af", "#ffedd5"] });
      }
    }

    const likedPosts = new Set<string>(JSON.parse(localStorage.getItem(storageKey) || "[]"));
    if (newLikedState)
      likedPosts.add(postId);
    else likedPosts.delete(postId);
    localStorage.setItem(storageKey, JSON.stringify(Array.from(likedPosts)));

    try {
      const response = await fetch("/api/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, deviceId }),
      });
      if (!response.ok)
        throw new Error("API request failed");
      const data = await response.json();
      if (data.success) {
        setLikeCount(data.likeCount);
        setHasLiked(data.hasLiked);
      }
    }
    catch (error) {
      console.error("Failed to submit like:", error);
      setHasLiked(!newLikedState);
      setLikeCount((prev) => newLikedState ? prev - 1 : prev + 1);
    }
    finally {
      setIsSubmitting(false);
    }
  };

  const buttonStateClasses = hasLiked ? "btn-primary ring-primary/40" : "border-base-content/20";
  if (isLoading)
    return <div className="skeleton w-32 h-16 rounded-full"></div>;

  return (
    <button
      ref={buttonRef}
      className={`btn btn-lg rounded-full shadow-lg transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-4 ${buttonStateClasses} ${isClicked ? "animate-like-pulse" : ""}`}
      onClick={handleClick}
      disabled={isSubmitting}
      aria-label="点赞文章"
    >
      <div className="flex items-center justify-center gap-3">
        <i className={`${hasLiked ? "ri-heart-fill" : "ri-heart-line"} text-3xl transition-transform duration-200`}></i>
        {likeCount > 0 && <span className="text-xl font-bold">{likeCount}</span>}
      </div>
    </button>
  );
};

export default BlogLikeButton;

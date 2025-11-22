import confetti from "canvas-confetti";
// src/components/blog/LikeButton.tsx
import React, { useEffect, useRef, useState } from "react";

interface Props {
  postId: string;
}

const BlogLikeButton: React.FC<Props> = ({ postId }) => {
  const [likeCount, setLikeCount] = useState<number>(0);
  const [displayCount, setDisplayCount] = useState<number>(0);
  const [hasLiked, setHasLiked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClicked, setIsClicked] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const storageKey = `liked_blog_posts`; // 使用独立的 key

  // 数字平滑过渡动画
  useEffect(() => {
    let frame: number;
    const duration = 250; // ms
    const start = performance.now();
    const from = displayCount;
    const to = likeCount;

    if (from === to)
      return;

    const animate = (time: number) => {
      const progress = Math.min(1, (time - start) / duration);
      const value = Math.round(from + (to - from) * progress);
      setDisplayCount(value);
      if (progress < 1)
        frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [likeCount]);

  useEffect(() => {
    let isMounted = true;
    const fetchInitialState = async () => {
      try {
        const response = await fetch(`/api/like?postId=${postId}`);
        if (!response.ok)
          throw new Error("Failed to fetch");
        const data = await response.json();
        if (isMounted) {
          setLikeCount(data.likeCount);
          // 是否点赞改为前端根据 localStorage 决定，这里只关心总数
          const likedPosts = JSON.parse(localStorage.getItem(storageKey) || "[]");
          if (Array.isArray(likedPosts) && likedPosts.includes(postId))
            setHasLiked(true);
        }
      }
      catch (error) {
        console.error(`Failed to fetch likes for post ${postId}:`, error);
        const likedPosts = JSON.parse(localStorage.getItem(storageKey) || "[]");
        if (isMounted && Array.isArray(likedPosts) && likedPosts.includes(postId))
          setHasLiked(true);
      }
      finally {
        if (isMounted)
          setIsLoading(false);
      }
    };

    fetchInitialState();

    return () => {
      isMounted = false;
    };
  }, [postId]);

  const handleClick = async () => {
    if (isSubmitting || isLoading)
      return;

    setIsSubmitting(true);
    const newLikedState = !hasLiked;
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
        body: JSON.stringify({ postId, delta: newLikedState ? 1 : -1 }),
      });
      if (!response.ok)
        throw new Error("API request failed");
      const data = await response.json();
      if (data.success)
        setLikeCount(data.likeCount);
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
        {displayCount > 0 && <span className="text-xl font-bold">{displayCount}</span>}
      </div>
    </button>
  );
};

export default BlogLikeButton;

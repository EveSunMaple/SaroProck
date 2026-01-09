// src/components/blog/LikeButton.tsx
import type React from "react";
import { useEffect, useRef, useState } from "react";

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

  const storageKey = "liked_blog_posts"; // 使用独立的 key

  useEffect(() => {
    let isMounted = true;
    const fetchInitialState = async () => {
      try {
        const response = await fetch(`/api/like?postId=${postId}`);
        if (!response.ok) throw new Error("Failed to fetch");
        const data = await response.json();
        if (isMounted) {
          setLikeCount(data.likeCount);
          // 是否点赞改为前端根据 localStorage 决定，这里只关心总数
          const likedPosts = JSON.parse(
            localStorage.getItem(storageKey) || "[]",
          );
          if (Array.isArray(likedPosts) && likedPosts.includes(postId))
            setHasLiked(true);
        }
      } catch (error) {
        console.error(`Failed to fetch likes for post ${postId}:`, error);
        const likedPosts = JSON.parse(localStorage.getItem(storageKey) || "[]");
        if (
          isMounted &&
          Array.isArray(likedPosts) &&
          likedPosts.includes(postId)
        )
          setHasLiked(true);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchInitialState();

    return () => {
      isMounted = false;
    };
  }, [postId]);

  const handleClick = async () => {
    if (isSubmitting || isLoading) return;

    setIsSubmitting(true);
    const newLikedState = !hasLiked;
    setHasLiked(newLikedState);
    setLikeCount((prev) => (newLikedState ? prev + 1 : Math.max(0, prev - 1)));

    if (newLikedState) {
      setIsClicked(true);
      setTimeout(() => setIsClicked(false), 400);
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const x = (rect.left + rect.right) / 2 / window.innerWidth;
        const y = (rect.top + rect.bottom) / 2 / window.innerHeight;
        const runConfetti = async () => {
          const { default: confetti } = await import("canvas-confetti");
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { x, y },
            colors: ["#fb7185", "#fda4af", "#ffedd5"],
          });
        };
        void runConfetti();
      }
    }

    const likedPosts = new Set<string>(
      JSON.parse(localStorage.getItem(storageKey) || "[]"),
    );
    if (newLikedState) likedPosts.add(postId);
    else likedPosts.delete(postId);
    localStorage.setItem(storageKey, JSON.stringify(Array.from(likedPosts)));

    try {
      const response = await fetch("/api/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, delta: newLikedState ? 1 : -1 }),
      });
      if (!response.ok) throw new Error("API request failed");
      const data = await response.json();
      if (data.success) setLikeCount(data.likeCount);
    } catch (error) {
      console.error("Failed to submit like:", error);
      setHasLiked(!newLikedState);
      setLikeCount((prev) => (newLikedState ? prev - 1 : prev + 1));
    } finally {
      setIsSubmitting(false);
    }
  };

  const buttonStateClasses = hasLiked
    ? "btn-primary ring-primary/40"
    : "border-base-content/20";

  const formatLargeCount = (count: number) => {
    if (count < 1000) return count.toString();
    const k = count / 1000;
    if (k < 10) return `${k.toFixed(1)}k`;
    return `${Math.floor(k)}k`;
  };
  if (isLoading) return <div className="skeleton w-32 h-16 rounded-full" />;

  return (
    <button
      type="button"
      ref={buttonRef}
      className={`btn btn-lg rounded-full shadow-lg transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-4 ${buttonStateClasses} ${
        isClicked ? "animate-like-pulse" : ""
      }`}
      onClick={handleClick}
      disabled={isSubmitting}
      aria-label="点赞文章"
    >
      <div className="flex items-center justify-center gap-3">
        <i
          className={`${hasLiked ? "ri-heart-fill" : "ri-heart-line"} text-3xl transition-transform duration-200`}
        />
        {likeCount > 0 &&
          (likeCount < 1000 ? (
            <span className="countdown font-mono text-xl">
              <span
                style={{ "--value": likeCount } as React.CSSProperties}
                aria-live="polite"
              >
                {likeCount}
              </span>
            </span>
          ) : (
            <span className="text-xl font-bold">
              {formatLargeCount(likeCount)}
            </span>
          ))}
      </div>
    </button>
  );
};

export default BlogLikeButton;

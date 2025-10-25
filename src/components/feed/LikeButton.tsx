// src/components/feed/LikeButton.tsx
import React, { useEffect, useState } from "react";

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

const LikeButton: React.FC<Props> = ({ postId }) => {
  const [likeCount, setLikeCount] = useState<number>(0);
  const [hasLiked, setHasLiked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const storageKey = `liked_feed_posts`; // 使用独立的 key

  // 挂载时从后端获取初始状态
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
        // 如果API失败，可以尝试从本地存储恢复
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

    // 1. 乐观更新 UI
    setHasLiked(newLikedState);
    setLikeCount((prev) => newLikedState ? prev + 1 : Math.max(0, prev - 1));

    // 2. 更新本地存储
    const likedPosts = new Set<string>(JSON.parse(localStorage.getItem(storageKey) || "[]"));
    if (newLikedState)
      likedPosts.add(postId);
    else likedPosts.delete(postId);
    localStorage.setItem(storageKey, JSON.stringify(Array.from(likedPosts)));

    // 3. 调用后端 API
    try {
      const response = await fetch("/api/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, deviceId }),
      });

      if (!response.ok)
        throw new Error("API request failed");

      // 可选：使用后端返回的权威数据进行最终确认
      const data = await response.json();
      if (data.success) {
        setLikeCount(data.likeCount);
        setHasLiked(data.hasLiked);
      }
    }
    catch (error) {
      console.error("Failed to submit like:", error);
      // 回滚 UI
      setHasLiked(!newLikedState);
      setLikeCount((prev) => newLikedState ? prev - 1 : prev + 1);
    }
    finally {
      setIsSubmitting(false);
    }
  };

  const buttonClasses = `btn btn-ghost btn-xs rounded-lg gap-1 text-base-content/60 ${hasLiked ? "text-error" : ""}`;
  const isDisabled = isLoading || isSubmitting;

  if (isLoading) {
    return (
      <button className={buttonClasses}>
        <span className="loading loading-spinner loading-xs"></span>
      </button>
    );
  }

  return (
    <button className={buttonClasses} onClick={handleClick} disabled={isDisabled}>
      {isSubmitting
        ? (
            <span className="loading loading-spinner loading-xs"></span>
          )
        : (
            <i className={`${hasLiked ? "ri-heart-fill" : "ri-heart-line"} text-lg`}></i>
          )}
      {likeCount > 0 && <span>{likeCount}</span>}
    </button>
  );
};

export default LikeButton;

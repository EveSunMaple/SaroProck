// src/components/comments/CommentsWrapper.tsx
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import CommentForm from "./CommentForm";
import CommentList from "./CommentList";

export interface CommentData {
  id: string;
  nickname: string;
  email: string;
  website?: string;
  content: string;
  createdAt: Date;
  avatar: string;
  likes: number;
  isLiked: boolean;
  parentId?: string;
  level: number;
  children: CommentData[]; // 用于构建树形结构
  commentType: "blog" | "telegram";
  identifier: string;
  isAdmin?: boolean;
}

interface Props {
  identifier: string;
  commentType: "telegram" | "blog";
  displayMode?: "full" | "compact" | "guestbook";
}

const sortCommentTree = (nodes: CommentData[]) => {
  nodes.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  nodes.forEach((node) => {
    if (node.children.length > 0) {
      sortCommentTree(node.children);
    }
  });
};

const buildPresentationComments = (
  rootComments: CommentData[],
  displayMode: Props["displayMode"],
) => {
  const normalizedRoots = rootComments.map((comment) => ({
    ...comment,
    children: [...comment.children],
  }));

  sortCommentTree(normalizedRoots);

  if (displayMode === "guestbook") {
    return [...normalizedRoots].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  const flattened: CommentData[] = [];
  const flattenNode = (comment: CommentData, level: number) => {
    const children = comment.children;
    const snapshot: CommentData = {
      ...comment,
      level,
      children: [],
    };
    flattened.push(snapshot);
    children.forEach((child) => {
      flattenNode(child, level + 1);
    });
  };

  normalizedRoots.forEach((comment) => {
    flattenNode(comment, 0);
  });
  return flattened;
};

const getDeviceId = (): string => {
  const key = "comment_device_id";
  let deviceId = localStorage.getItem(key);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(key, deviceId);
  }
  return deviceId;
};

const CommentsWrapper: React.FC<Props> = ({
  identifier,
  commentType,
  displayMode = "full",
}) => {
  const [comments, setComments] = useState<CommentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const latestRequestKey = useRef<string>("");

  useEffect(() => {
    setDeviceId(getDeviceId());
  }, []);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const fetchComments = useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (!deviceId) return;

      const requestKey = `${identifier}-${commentType}`;
      latestRequestKey.current = requestKey;

      if (!options.silent) {
        setLoading(true);
      }

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      try {
        const url = `/api/comments?identifier=${encodeURIComponent(identifier)}&commentType=${commentType}&deviceId=${deviceId}`;
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error("Failed to fetch comments");

        const results = await response.json();
        const commentMap = new Map<string, CommentData>();

        results.forEach(
          (
            c: CommentData & {
              objectId?: string;
              parent?: { objectId?: string };
            },
          ) => {
            const commentId = c.id || c.objectId || "";
            if (!commentId) return;

            commentMap.set(commentId, {
              ...c,
              id: commentId,
              createdAt: new Date(c.createdAt),
              likes: c.likes || 0,
              isLiked: c.isLiked || false,
              parentId: c.parent?.objectId || c.parentId,
              children: [],
              level: 0,
              commentType,
              identifier,
            });
          },
        );

        const rootComments: CommentData[] = [];
        commentMap.forEach((comment) => {
          if (comment.parentId && commentMap.has(comment.parentId)) {
            commentMap.get(comment.parentId)?.children.push(comment);
          } else {
            rootComments.push(comment);
          }
        });

        const processedComments = buildPresentationComments(
          rootComments,
          displayMode,
        );
        if (
          latestRequestKey.current === requestKey &&
          !controller.signal.aborted
        ) {
          setComments(processedComments);
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Error fetching comments:", error);
        }
      } finally {
        if (
          latestRequestKey.current === requestKey &&
          !controller.signal.aborted
        ) {
          if (!options.silent) {
            setLoading(false);
          }
        }
      }
    },
    [identifier, commentType, deviceId, displayMode],
  );

  useEffect(() => {
    if (deviceId) {
      fetchComments();
    }
  }, [deviceId, fetchComments]);

  const handleCommentAdded = useCallback(() => {
    fetchComments({ silent: true });
  }, [fetchComments]);

  const handleLike = useCallback(
    async (commentId: string) => {
      if (!deviceId) return;

      // 乐观更新 UI
      const updateLikesRecursively = (nodes: CommentData[]): CommentData[] => {
        return nodes.map((node) => {
          if (node.id === commentId) {
            const isLiked = !node.isLiked;
            const likes = node.likes + (isLiked ? 1 : -1);
            return { ...node, isLiked, likes };
          }
          if (node.children && node.children.length > 0) {
            return { ...node, children: updateLikesRecursively(node.children) };
          }
          return node;
        });
      };
      setComments((prevComments) => updateLikesRecursively(prevComments));

      try {
        const response = await fetch("/api/comments/like", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ commentId, commentType, deviceId }),
        });
        if (!response.ok) throw new Error("Like operation failed");
        // 可选: 用后端返回的数据再次更新，确保数据同步
        // const result = await response.json();
        // fetchComments(); // 或者直接重新获取
      } catch (error) {
        console.error("Error liking comment:", error);
        fetchComments({ silent: true }); // 如果失败，则回滚
      }
    },
    [deviceId, commentType, fetchComments],
  );

  if (displayMode === "guestbook") {
    return (
      <div className="not-prose">
        <div className="text-center mb-10">
          <button
            type="button"
            className="btn btn-primary btn-wide rounded-lg"
            onClick={() => {
              const dialog = document.getElementById(
                "guestbook_modal",
              ) as HTMLDialogElement | null;
              if (dialog && typeof dialog.showModal === "function") {
                dialog.showModal();
              }
            }}
          >
            <i className="ri-pencil-line" />
            在留言板上留下我的卡片
          </button>
        </div>

        <dialog
          id="guestbook_modal"
          className="modal modal-bottom sm:modal-middle"
        >
          <div className="modal-box rounded-t-2xl sm:rounded-2xl">
            <form method="dialog">
              <button
                type="button"
                className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              >
                ✕
              </button>
            </form>
            <h3 className="font-bold text-lg mb-4">创建新留言</h3>
            <CommentForm
              identifier={identifier}
              commentType={commentType}
              onCommentAdded={() => {
                handleCommentAdded();
                const modal = document.getElementById(
                  "guestbook_modal",
                ) as HTMLDialogElement | null;
                if (modal) modal.close();
              }}
              displayMode="full"
            />
          </div>
          <form method="dialog" className="modal-backdrop">
            <button type="submit">close</button>
          </form>
        </dialog>

        <CommentList
          comments={comments}
          onLike={handleLike}
          onCommentAdded={handleCommentAdded}
          displayMode="guestbook"
          isLoading={loading}
        />
      </div>
    );
  }

  // --- 默认和紧凑模式 UI (保持不变) ---
  return (
    <div className="not-prose">
      {displayMode === "full" && (
        <>
          <h2 className="text-2xl font-bold mb-8 flex items-center gap-2">
            <i className="ri-chat-3-line" />
            评论区
          </h2>
          <div className="divider -mt-2 mb-6" />
        </>
      )}
      <CommentForm
        identifier={identifier}
        commentType={commentType}
        onCommentAdded={handleCommentAdded}
        displayMode={displayMode}
        loading={loading}
      />
      <CommentList
        comments={comments}
        onLike={handleLike}
        onCommentAdded={handleCommentAdded}
        displayMode={displayMode}
        isLoading={loading}
      />
      {displayMode === "full" && (
        <div className="mt-6 text-sm text-right">
          本评论区由{" "}
          <a
            href="https://github.com/EveSunMaple"
            className="text-primary"
            target="_blank"
            rel="noopener noreferrer"
          >
            EveSunMaple
          </a>{" "}
          自主开发
        </div>
      )}
    </div>
  );
};

export default CommentsWrapper;

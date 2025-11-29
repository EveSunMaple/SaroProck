import type React from "react";
import CommentItem from "./CommentItem";
import type { CommentData } from "./CommentsWrapper";

interface Props {
  comments: CommentData[];
  onLike: (commentId: string) => void;
  onCommentAdded: () => void;
  displayMode: "full" | "compact" | "guestbook";
  isLoading: boolean;
}

const CommentList: React.FC<Props> = ({
  comments,
  onLike,
  onCommentAdded,
  displayMode,
  isLoading,
}) => {
  if (isLoading && comments.length === 0) {
    if (displayMode === "guestbook") {
      const skeletonKeys = ["a", "b", "c", "d", "e", "f"];
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {skeletonKeys.map((key) => (
            <div
              key={key}
              className="skeleton bg-base-200/50 rounded-2xl p-4 aspect-[4/3]"
            >
              <div className="flex items-center gap-3">
                <div className="skeleton w-10 h-10 rounded-full bg-base-300/50" />
                <div className="skeleton h-4 bg-base-300/50 rounded w-1/2" />
              </div>
              <div className="space-y-2 mt-4">
                <div className="skeleton h-3 bg-base-300/50 rounded w-full" />
                <div className="skeleton h-3 bg-base-300/50 rounded w-5/6" />
              </div>
            </div>
          ))}
        </div>
      );
    }
    return null;
  }

  if (comments.length === 0) {
    if (displayMode === "full") {
      return (
        <p className="text-center text-base-content/70 my-24">
          还没有评论，快来抢占沙发吧！
        </p>
      );
    }
    if (displayMode === "guestbook") {
      return (
        <p className="text-center text-base-content/70 my-24">
          还没有留言，快来留下第一张卡片吧！
        </p>
      );
    }
    return null;
  }

  if (displayMode === "guestbook") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {comments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            onLike={onLike}
            onCommentAdded={onCommentAdded}
            displayMode="guestbook"
          />
        ))}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${displayMode === "full" ? "mt-8" : "mt-4"}`}>
      {comments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          onLike={onLike}
          onCommentAdded={onCommentAdded}
          displayMode={displayMode}
        />
      ))}
    </div>
  );
};

export default CommentList;

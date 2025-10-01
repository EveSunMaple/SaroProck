import type { CommentData } from "./CommentsWrapper";
import { format, formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import React, { useState } from "react";
import CommentForm from "./CommentForm";

// 头像代理函数
function proxyAvatar(url: string | undefined): string {
  if (!url)
    return "/avatar-placeholder.png";
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname === "www.gravatar.com" || urlObj.hostname === "gravatar.com") {
      urlObj.hostname = "cravatar.cn";
      return urlObj.toString();
    }
    return url;
  }
  catch {
    return url;
  }
}

interface Props {
  comment: CommentData;
  onLike: (commentId: string) => void;
  onCommentAdded: () => void;
  displayMode: "full" | "compact" | "guestbook";
}

const badgeMap: { [key: string]: string } = {
  "ericzhao3366@dingtalk.com": "博主",
};

// 重命名为 CommentItemComponent 以便在文件内部递归调用
const CommentItemComponent: React.FC<Props> = ({ comment, onLike, onCommentAdded, displayMode }) => {
  const [showReplyForm, setShowReplyForm] = useState(false);

  // --- 留言板卡片模式 ---
  if (displayMode === "guestbook") {
    const hasReplies = comment.children && comment.children.length > 0;

    return (
      <div className="guestbook-card flex flex-col h-full rounded-2xl shadow-sm border border-base-content/10 bg-base-100/60 transition-all duration-300 hover:shadow-lg backdrop-blur-sm">
        <header className="flex items-start justify-between p-4">
          <div className="flex items-center gap-3 min-w-0">
            <a href={comment.website || "#"} target="_blank" rel="noopener noreferrer" className="avatar w-10 h-10 shrink-0">
              <div className="rounded-full ring-2 ring-base-content/5"><img src={proxyAvatar(comment.avatar)} alt={comment.nickname} /></div>
            </a>
            <div className="min-w-0">
              <p className="font-semibold truncate">{comment.nickname}</p>
              {badgeMap[comment.email] && <span className="badge badge-primary badge-sm ml-2">{badgeMap[comment.email]}</span>}
            </div>
          </div>
          <time className="text-sm text-base-content/60 shrink-0 ml-2 pt-1" title={format(comment.createdAt, "yyyy年MM月dd日 HH:mm")}>
            {formatDistanceToNow(comment.createdAt, { addSuffix: true, locale: zhCN })}
          </time>
        </header>

        <main className="prose prose-sm max-w-none px-4 pb-4 flex-grow" dangerouslySetInnerHTML={{ __html: comment.content }}></main>

        <footer className="flex items-end justify-end p-4 pt-0 mt-auto">
          <div className="flex items-center">
            <button className="btn btn-ghost btn-sm rounded-lg gap-1" onClick={() => setShowReplyForm(!showReplyForm)}>
              <i className="ri-chat-1-line"></i>
              <span>{showReplyForm ? "收起" : (hasReplies ? comment.children.length : "回复")}</span>
            </button>
            <button className={`btn btn-ghost btn-sm rounded-lg gap-1 ${comment.isLiked ? "text-error" : ""}`} onClick={() => onLike(comment.id)}>
              <i className={comment.isLiked ? "ri-heart-fill" : "ri-heart-line"}></i>
              <span>{comment.likes > 0 ? comment.likes : ""}</span>
            </button>
          </div>
        </footer>

        {showReplyForm && (
          <div className="p-4 border-t border-base-content/10 bg-base-200/30 rounded-b-2xl space-y-4">
            {/* 渲染子评论 */}
            {hasReplies && (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2 -mr-2 custom-scrollbar">
                {comment.children.map(childComment => (
                  <CommentItemComponent
                    key={childComment.id}
                    comment={childComment}
                    onLike={onLike}
                    onCommentAdded={onCommentAdded}
                    displayMode="compact" // 回复始终使用紧凑模式
                  />
                ))}
              </div>
            )}
            {/* 回复表单 */}
            <CommentForm
              identifier={comment.identifier}
              commentType={comment.commentType}
              parentId={comment.id}
              onCommentAdded={() => {
                onCommentAdded();
                // 也可以选择不关闭，让用户连续回复
                // setShowReplyForm(false);
              }}
              displayMode="compact"
              isReply={true}
              onCancelReply={() => setShowReplyForm(false)}
            />
          </div>
        )}
      </div>
    );
  }

  // --- 紧凑模式 (用于卡片内的回复) ---
  if (displayMode === "compact") {
    return (
      <div className="comment-thread-compact relative" style={{ paddingLeft: `${comment.level > 0 ? 1.45 : 0}rem` }}>
        <div className="flex gap-2 items-start relative">
          {comment.level > 0 && <div className="absolute -left-3 top-1 w-4 h-4 border-l-2 border-b-2 border-base-content/10 rounded-bl-lg"></div>}
          <div className="avatar w-6 h-6 shrink-0 mt-1">
            <div className="rounded-full"><img src={proxyAvatar(comment.avatar)} alt={comment.nickname} className="w-full h-full object-cover" /></div>
          </div>
          <div className="flex-1 min-w-0 bg-base-100/50 px-2 py-1 rounded-lg">
            <p className="text-sm">
              <span className="font-semibold mr-1.5">{comment.nickname}</span>
              <span className="text-base-content/80" dangerouslySetInnerHTML={{ __html: comment.content.replace(/<p>(.*?)<\/p>/g, "$1") }}></span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --- 默认(full)模式 (保持不变) ---
  return (
    <div className="comment-thread relative" style={{ paddingLeft: `${comment.level > 0 ? 2 : 0}rem` }}>
      <div className="comment relative" data-comment-id={comment.id}>
        {comment.level > 0 && <div className="absolute -left-4 top-2 w-4 h-4 border-l-2 border-b-2 border-base-content/10 rounded-bl-lg"></div>}
        <div className="flex gap-4">
          <div className="avatar flex-shrink-0">
            <div className="w-10 h-10 rounded-full"><img src={proxyAvatar(comment.avatar)} alt={comment.nickname} /></div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {comment.website ? <a href={comment.website} className="font-semibold text-primary hover:underline truncate" target="_blank" rel="noopener noreferrer">{comment.nickname}</a> : <span className="font-semibold truncate">{comment.nickname}</span>}
              {badgeMap[comment.email] && <div className="badge badge-primary badge-sm ml-2">{badgeMap[comment.email]}</div>}
            </div>
            <div className="prose prose-sm max-w-none mb-3" dangerouslySetInnerHTML={{ __html: comment.content }}></div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-base-content/60">{format(comment.createdAt, "yyyy年MM月dd日 HH:mm", { locale: zhCN })}</span>
              <div className="flex items-center gap-1">
                <button className="btn btn-ghost btn-sm rounded-lg gap-1" onClick={() => setShowReplyForm(!showReplyForm)}>
                  <i className="ri-reply-line"></i>
                  <span>{showReplyForm ? "取消回复" : "回复"}</span>
                </button>
                <button className={`btn btn-ghost btn-sm rounded-lg gap-1 ${comment.isLiked ? "text-error" : ""}`} onClick={() => onLike(comment.id)}>
                  <i className={comment.isLiked ? "ri-heart-fill" : "ri-heart-line"}></i>
                  <span>{comment.likes > 0 ? comment.likes : ""}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {showReplyForm && (
        <div className="mt-4 pl-14">
          <CommentForm identifier={comment.identifier} commentType={comment.commentType} parentId={comment.id} onCommentAdded={onCommentAdded} displayMode="full" isReply={true} onCancelReply={() => setShowReplyForm(false)} />
        </div>
      )}
    </div>
  );
};

export default CommentItemComponent;

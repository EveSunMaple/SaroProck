import React, { useState } from "react";
import CommentsWrapper from "./CommentsWrapper";

interface Props {
  identifier: string;
  commentType: "blog" | "telegram";
}

// 用于首页等列表场景：默认只显示一个按钮，点击后再加载评论组件和数据，减少首屏和滚动时的请求量
const InlineComments: React.FC<Props> = ({ identifier, commentType }) => {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          className="btn btn-xs btn-ghost gap-1 text-xs text-base-content/70"
          onClick={() => setOpen(true)}
        >
          <i className="ri-chat-3-line" />
          查看评论 / 参与讨论
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <CommentsWrapper identifier={identifier} commentType={commentType} displayMode="compact" />
    </div>
  );
};

export default InlineComments;

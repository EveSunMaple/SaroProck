import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";

interface AdminComment {
  id: string;
  content: string;
  nickname: string;
  email: string;
  identifier: string;
  createdAt: string;
  commentType: "blog" | "telegram";
  isAdmin?: boolean;
}

interface ApiResponse {
  comments: AdminComment[];
  total: number;
  page: number;
  limit: number;
}

const CommentsManager: React.FC = () => {
  const [allComments, setAllComments] = useState<AdminComment[]>([]);
  const [filteredComments, setFilteredComments] = useState<AdminComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [commentType, setCommentType] = useState<"blog" | "telegram">("blog");
  const [pendingDeletion, setPendingDeletion] = useState<{
    id: string;
    type: "blog" | "telegram";
  } | null>(null);
  const itemsPerPage = 20;

  const fetchAllComments = useCallback(async () => {
    setLoading(true);
    try {
      // 一次性获取所有评论
      const response = await fetch(
        `/api/comments?commentType=${commentType}&page=1&limit=10000`,
      );

      if (!response.ok) {
        throw new Error("无法获取评论数据");
      }

      const result: ApiResponse = await response.json();
      const comments = result.comments || [];
      setAllComments(comments);
      setFilteredComments(comments);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "加载失败";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [commentType]);

  // 根据分页截取数据
  const getPaginatedComments = () => {
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredComments.slice(start, end);
  };

  const totalPages = Math.ceil(filteredComments.length / itemsPerPage) || 1;

  useEffect(() => {
    fetchAllComments();
  }, [fetchAllComments]);

  const handleTabClick = (type: "blog" | "telegram" | "all") => {
    setCommentType(type as "blog" | "telegram");
    setPage(1);
  };

  const toggleAdminStatus = async (
    commentId: string,
    currentStatus: boolean,
  ) => {
    const updating = toast.loading("更新中...");
    try {
      const response = await fetch("/api/comments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commentId,
          isAdmin: !currentStatus,
          commentType,
        }),
      });

      if (!response.ok) {
        throw new Error("网络请求失败");
      }

      const result = await response.json();
      if (!result.success) throw new Error(result.message);

      toast.success("更新成功！", { id: updating });

      // 更新本地数据
      setAllComments((prev) =>
        prev.map((c) =>
          c.id === commentId ? { ...c, isAdmin: !currentStatus } : c,
        ),
      );
      setFilteredComments((prev) =>
        prev.map((c) =>
          c.id === commentId ? { ...c, isAdmin: !currentStatus } : c,
        ),
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "未知错误";
      toast.error(`更新失败：${message}`, { id: updating });
    }
  };

  // 更新 handleDelete 函数，直接接收要删除的 id 和 type
  const handleDelete = async (id: string, type: "blog" | "telegram") => {
    const deleting = toast.loading("正在删除评论...");
    try {
      const response = await fetch("/api/comments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId: id, commentType: type }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message);
      toast.success("删除成功！", { id: deleting });
      setPendingDeletion(null); // 删除成功后清空待确认状态

      // 从数据中移除已删除的评论
      setAllComments((prev) => prev.filter((c) => c.id !== id));
      setFilteredComments((prev) => prev.filter((c) => c.id !== id));

      // 如果当前页没有数据了，返回上一页
      if (getPaginatedComments().length === 0 && page > 1) {
        setPage(page - 1);
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "未知错误";
      toast.error(`删除失败：${message}`, { id: deleting });
      setPendingDeletion(null); // 删除失败也清空待确认状态
    }
  };

  return (
    <div className="bg-base-200/60 backdrop-blur-xl rounded-2xl p-6 border border-base-content/10 shadow-lg">
      <Toaster position="top-center" />
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <i className="ri-chat-3-line text-xl" /> 评论管理
      </h2>

      <div className="tabs tabs-boxed mb-6">
        <button
          type="button"
          className={`tab ${commentType === "blog" ? "tab-active" : ""}`}
          onClick={() => handleTabClick("blog")}
        >
          <i className="ri-article-line mr-1" /> 博客评论
        </button>
        <button
          type="button"
          className={`tab ${commentType === "telegram" ? "tab-active" : ""}`}
          onClick={() => handleTabClick("telegram")}
        >
          <i className="ri-bubble-chart-line mr-1" /> 动态评论
        </button>
      </div>

      {loading && (
        <div className="flex justify-center items-center py-20">
          <span className="loading loading-spinner" />
        </div>
      )}

      {!loading && (
        <>
          <div className="overflow-x-auto rounded-xl border border-base-content/10">
            <table className="table w-full">
              <thead className="bg-base-300/50">
                <tr>
                  <th>作者</th>
                  <th className="max-w-[400px]">内容</th>
                  <th>关联页面</th>
                  <th>时间</th>
                  <th className="text-center">状态</th>
                  <th className="text-center">操作</th>
                </tr>
              </thead>
              <tbody>
                {getPaginatedComments().map((comment) => (
                  <tr key={comment.id} className="hover">
                    <td>
                      <div className="font-semibold">{comment.nickname}</div>
                      <div className="text-xs opacity-60 truncate max-w-[140px]">
                        {comment.email}
                      </div>
                    </td>

                    <td>
                      <div
                        dangerouslySetInnerHTML={{ __html: comment.content }}
                        className="prose prose-sm max-w-none break-all max-h-24 overflow-y-auto rounded-lg p-2 bg-base-100 border border-base-content/10 scrollbar-thin scrollbar-thumb-base-300 hover:scrollbar-thumb-base-300/80"
                      />
                    </td>

                    <td>
                      <a
                        href={`/${comment.commentType === "telegram" ? "post" : "blog"}/${comment.identifier}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link link-primary text-xs hover:underline"
                      >
                        {comment.identifier}
                      </a>
                    </td>

                    <td className="whitespace-nowrap">
                      {format(new Date(comment.createdAt), "yy-MM-dd HH:mm", {
                        locale: zhCN,
                      })}
                    </td>

                    <td className="text-center">
                      {comment.isAdmin ? (
                        <span className="badge badge-primary badge-sm">
                          <i className="ri-check-line" />
                        </span>
                      ) : (
                        <span className="badge badge-ghost badge-sm">
                          <i className="ri-close-line" />
                        </span>
                      )}
                    </td>

                    <td className="text-center w-[180px]">
                      {pendingDeletion?.id === comment.id ? (
                        <div className="flex flex-col gap-1 items-center bg-error/10 p-2 rounded-lg">
                          <span className="text-xs text-error font-semibold mb-1">
                            确认删除?
                          </span>
                          <button
                            type="button"
                            className="btn btn-error btn-xs w-full"
                            onClick={() =>
                              handleDelete(comment.id, comment.commentType)
                            }
                          >
                            <i className="ri-check-line" /> 确认
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-xs w-full"
                            onClick={() => setPendingDeletion(null)}
                          >
                            <i className="ri-close-line" /> 取消
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-1 justify-center">
                          <button
                            type="button"
                            className={`btn btn-xs ${
                              comment.isAdmin ? "btn-soft" : "btn-warning"
                            }`}
                            onClick={() =>
                              toggleAdminStatus(
                                comment.id,
                                comment.isAdmin || false,
                              )
                            }
                            title={
                              comment.isAdmin ? "取消管理员标记" : "设为管理员"
                            }
                          >
                            <i
                              className={`ri-${comment.isAdmin ? "user-star-line" : "user-settings-line"}`}
                            />
                            {comment.isAdmin ? "取消管理员" : "设为管理员"}
                          </button>
                          <button
                            type="button"
                            className="btn btn-error btn-xs"
                            onClick={() =>
                              setPendingDeletion({
                                id: comment.id,
                                type: comment.commentType,
                              })
                            }
                          >
                            <i className="ri-delete-bin-line" /> 删除
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex justify-center gap-2 items-center">
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <i className="ri-arrow-left-s-line" /> 上一页
            </button>
            <span className="text-sm opacity-70">
              第 {page} / {totalPages || 1} 页
            </span>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              下一页 <i className="ri-arrow-right-s-line" />
            </button>
          </div>
        </>
      )}

      {!loading && filteredComments.length === 0 && (
        <div className="text-center py-16 text-base-content/50">
          <i className="ri-emotion-unhappy-line text-2xl mb-2" />
          <p>暂无评论</p>
        </div>
      )}
    </div>
  );
};

export default CommentsManager;

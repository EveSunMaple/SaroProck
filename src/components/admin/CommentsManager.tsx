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
  ip?: string;
  ua?: string;
  status?: "approved" | "pending" | "spam";
}

interface ApiResponse {
  comments: AdminComment[];
  total: number;
  page: number;
  limit: number;
}

interface BulkOperation {
  action: "delete" | "mark-admin" | "unmark-admin" | "update-status";
  status?: string;
}

const CommentsManager: React.FC = () => {
  const [filteredComments, setFilteredComments] = useState<AdminComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [commentType, setCommentType] = useState<"blog" | "telegram">("blog");
  const [selectedComments, setSelectedComments] = useState<Set<string>>(
    new Set(),
  );
  const [pendingDeletion, setPendingDeletion] = useState<{
    id: string;
    type: "blog" | "telegram";
  } | null>(null);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(
    new Set(),
  );

  // Filter states
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [postId, setPostId] = useState("");
  const [search, setSearch] = useState("");
  const [onlyAdmin, setOnlyAdmin] = useState(false);
  const [ipAddress, setIpAddress] = useState("");

  const itemsPerPage = 20;
  const [totalPages, setTotalPages] = useState(1);
  const [totalComments, setTotalComments] = useState(0);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        commentType: commentType,
        page: page.toString(),
        limit: itemsPerPage.toString(),
      });

      if (dateFrom) params.append("dateFrom", dateFrom);
      if (dateTo) params.append("dateTo", dateTo);
      if (postId) params.append("postId", postId);
      if (search) params.append("search", search);
      if (onlyAdmin) params.append("onlyAdmin", "true");
      if (ipAddress) params.append("ipAddress", ipAddress);

      const response = await fetch(`/api/comments?${params.toString()}`);

      if (!response.ok) {
        throw new Error("无法获取评论数据");
      }

      const result: ApiResponse = await response.json();
      setFilteredComments(result.comments || []);
      setTotalComments(result.total || 0);
      setTotalPages(Math.ceil((result.total || 0) / itemsPerPage) || 1);
      setSelectedComments(new Set()); // Clear selection when loading new page
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
  }, [
    commentType,
    page,
    dateFrom,
    dateTo,
    postId,
    search,
    onlyAdmin,
    ipAddress,
  ]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleTabClick = (type: "blog" | "telegram") => {
    setCommentType(type);
    setPage(1);
    setSelectedComments(new Set());
  };

  const handleSelectSingle = (commentId: string) => {
    setSelectedComments((prev) => {
      const newSelection = new Set(prev);
      if (newSelection.has(commentId)) {
        newSelection.delete(commentId);
      } else {
        newSelection.add(commentId);
      }
      return newSelection;
    });
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = filteredComments.map((c) => c.id);
      setSelectedComments(new Set(allIds));
    } else {
      setSelectedComments(new Set());
    }
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

  const handleBulkOperation = async (operation: BulkOperation) => {
    if (selectedComments.size === 0) {
      toast.error("请先选择评论");
      return;
    }

    const actionText = {
      delete: "删除",
      "mark-admin": "标记为管理员",
      "unmark-admin": "取消管理员标记",
      "update-status": "更新状态",
    }[operation.action];

    const confirmation = window.confirm(
      `确定要${actionText}选中的 ${selectedComments.size} 条评论吗？`,
    );
    if (!confirmation) return;

    const processing = toast.loading(`正在${actionText}...`);
    try {
      const commentIds = Array.from(selectedComments);
      const results = await Promise.all(
        commentIds.map(async (commentId) => {
          switch (operation.action) {
            case "delete":
              return await deleteComment(commentId, commentType);
            case "mark-admin":
              return await updateCommentStatus(commentId, true);
            case "unmark-admin":
              return await updateCommentStatus(commentId, false);
            case "update-status":
              return await updateCommentStatusField(
                commentId,
                operation.status || "approved",
              );
            default:
              return false;
          }
        }),
      );

      const successCount = results.filter((r) => r).length;
      toast.success(
        `${actionText}完成，成功 ${successCount}/${commentIds.length}`,
        { id: processing },
      );

      // Refresh the page
      fetchComments();
    } catch (_error) {
      toast.error(`${actionText}失败`, { id: processing });
    }
  };

  const deleteComment = async (
    commentId: string,
    type: "blog" | "telegram",
  ) => {
    try {
      const response = await fetch("/api/comments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, commentType: type }),
      });
      const result = await response.json();
      return result.success;
    } catch {
      return false;
    }
  };

  const updateCommentStatus = async (commentId: string, isAdmin: boolean) => {
    try {
      const response = await fetch("/api/comments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commentId,
          isAdmin,
          commentType,
        }),
      });
      const result = await response.json();
      return result.success;
    } catch {
      return false;
    }
  };

  const updateCommentStatusField = async (
    _commentId: string,
    _status: string,
  ) => {
    // This would require a new API endpoint to update status field
    // For now, we'll return false to indicate not implemented
    return false;
  };

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
      setPendingDeletion(null);
      fetchComments();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "未知错误";
      toast.error(`删除失败：${message}`, { id: deleting });
      setPendingDeletion(null);
    }
  };

  const toggleCommentExpansion = (commentId: string) => {
    setExpandedComments((prev) => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(commentId)) {
        newExpanded.delete(commentId);
      } else {
        newExpanded.add(commentId);
      }
      return newExpanded;
    });
  };

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setPostId("");
    setSearch("");
    setOnlyAdmin(false);
    setIpAddress("");
    setPage(1);
  };

  return (
    <>
      <Toaster position="top-right" />
      <div className="bg-base-200/60 backdrop-blur-xl rounded-2xl p-6 border border-base-content/10 shadow-lg">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <i className="ri-chat-3-line text-xl" /> 评论管理
        </h2>

        {/* Filter Controls */}
        <div className="bg-base-100/50 rounded-lg p-4 mb-6">
          <h3 className="font-semibold mb-3">
            <i className="ri-filter-3-line mr-2" /> 高级筛选
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <div>
              <label className="label" htmlFor="comments-filter-date-from">
                <span className="label-text">开始日期</span>
              </label>
              <input
                id="comments-filter-date-from"
                type="date"
                className="input input-bordered w-full input-sm"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="comments-filter-date-to">
                <span className="label-text">结束日期</span>
              </label>
              <input
                id="comments-filter-date-to"
                type="date"
                className="input input-bordered w-full input-sm"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="comments-filter-post-id">
                <span className="label-text">文章 ID/标识符</span>
              </label>
              <input
                id="comments-filter-post-id"
                type="text"
                className="input input-bordered w-full input-sm"
                placeholder="例如: post-slug 或 post-id"
                value={postId}
                onChange={(e) => setPostId(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="comments-filter-search">
                <span className="label-text">搜索（邮箱/昵称）</span>
              </label>
              <input
                id="comments-filter-search"
                type="text"
                className="input input-bordered w-full input-sm"
                placeholder="输入邮箱或昵称"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="comments-filter-ip">
                <span className="label-text">IP 地址</span>
              </label>
              <input
                id="comments-filter-ip"
                type="text"
                className="input input-bordered w-full input-sm"
                placeholder="例如: 192.168.1.1"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              <label className="cursor-pointer label flex-col items-start">
                <span className="label-text">仅显示管理员评论</span>
                <input
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={onlyAdmin}
                  onChange={(e) => setOnlyAdmin(e.target.checked)}
                />
              </label>
            </div>
            <div></div>
            <div></div>
          </div>
          <div className="flex justify-between items-center mt-4">
            <div className="text-sm text-base-content/70">
              找到 {totalComments} 条评论
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={clearFilters}
            >
              <i className="ri-refresh-line mr-1" /> 清除筛选
            </button>
          </div>
        </div>

        {/* Bulk Operations */}
        {selectedComments.size > 0 && (
          <div className="bg-base-100/50 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center">
              <span className="font-semibold">
                已选择 {selectedComments.size} 条评论
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => handleBulkOperation({ action: "mark-admin" })}
                >
                  <i className="ri-admin-line mr-1" /> 标记为管理员
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() =>
                    handleBulkOperation({ action: "unmark-admin" })
                  }
                >
                  <i className="ri-user-line mr-1" /> 取消管理员标记
                </button>
                <button
                  type="button"
                  className="btn btn-error btn-sm"
                  onClick={() => handleBulkOperation({ action: "delete" })}
                >
                  <i className="ri-delete-bin-line mr-1" /> 批量删除
                </button>
              </div>
            </div>
          </div>
        )}

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
              <table className="table w-full" style={{ tableLayout: "fixed" }}>
                <thead className="bg-base-300/50">
                  <tr>
                    <th className="w-8 p-3">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        onChange={handleSelectAll}
                        checked={
                          filteredComments.length > 0 &&
                          filteredComments.every((c) =>
                            selectedComments.has(c.id),
                          )
                        }
                      />
                    </th>
                    <th className="w-48 p-3">作者</th>
                    <th className="w-48 p-3">内容</th>
                    <th className="w-24 p-3">关联页面</th>
                    <th className="w-32 p-3">时间</th>
                    <th className="w-32 p-3">IP 地址</th>
                    <th className="w-16 text-center p-3">状态</th>
                    <th className="w-40 text-center p-3">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredComments.map((comment) => {
                    const isSelected = selectedComments.has(comment.id);
                    const isExpanded = expandedComments.has(comment.id);
                    const contentPreview =
                      comment.content.length > 200 && !isExpanded
                        ? `${comment.content.substring(0, 200)}...`
                        : comment.content;

                    return (
                      <tr key={comment.id} className="hover">
                        <td className="p-3">
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm"
                            checked={isSelected}
                            onChange={() => handleSelectSingle(comment.id)}
                          />
                        </td>
                        <td className="p-3">
                          <div className="font-semibold flex items-center gap-1">
                            {comment.nickname}
                            {comment.isAdmin && (
                              <span className="badge badge-primary badge-xs">
                                管
                              </span>
                            )}
                          </div>
                          <div className="text-xs opacity-60 truncate max-w-[140px]">
                            {comment.email}
                          </div>
                        </td>

                        <td className="p-3">
                          <div
                            dangerouslySetInnerHTML={{
                              __html: isExpanded
                                ? comment.content
                                : contentPreview,
                            }}
                            className={`prose prose-sm max-w-none break-all rounded-lg p-2 bg-base-100 border border-base-content/10 scrollbar-thin ${
                              isExpanded
                                ? "max-h-none"
                                : "max-h-24 overflow-y-auto"
                            }`}
                          />
                          {comment.content.length > 200 && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs mt-1"
                              onClick={() => toggleCommentExpansion(comment.id)}
                            >
                              {isExpanded ? (
                                <>
                                  <i className="ri-arrow-up-s-line mr-1" /> 收起
                                </>
                              ) : (
                                <>
                                  <i className="ri-arrow-down-s-line mr-1" />{" "}
                                  展开
                                </>
                              )}
                            </button>
                          )}
                        </td>

                        <td>
                          <a
                            href={`/${comment.commentType === "telegram" ? "post" : "blog"}/${
                              comment.identifier
                            }`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="link link-primary text-xs hover:underline"
                            title={comment.identifier}
                          >
                            {comment.identifier.length > 15
                              ? `${comment.identifier.substring(0, 15)}...`
                              : comment.identifier}
                          </a>
                        </td>

                        <td className="whitespace-nowrap">
                          {format(
                            new Date(comment.createdAt),
                            "yy-MM-dd HH:mm",
                            {
                              locale: zhCN,
                            },
                          )}
                        </td>

                        <td className="font-mono text-xs text-base-content/70">
                          {comment.ip || "-"}
                        </td>

                        <td className="text-center">
                          {comment.isAdmin ? (
                            <i
                              className="ri-shield-star-line text-warning"
                              title="管理员"
                            />
                          ) : (
                            <i
                              className="ri-shield-line text-base-content/40"
                              title="普通用户"
                            />
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
                                  comment.isAdmin ? "" : "btn-soft"
                                }`}
                                onClick={() =>
                                  toggleAdminStatus(
                                    comment.id,
                                    comment.isAdmin || false,
                                  )
                                }
                                title={
                                  comment.isAdmin
                                    ? "取消管理员标记"
                                    : "设为管理员"
                                }
                              >
                                <i
                                  className={
                                    comment.isAdmin
                                      ? "ri-shield-star-line"
                                      : "ri-shield-flash-line"
                                  }
                                />
                                {comment.isAdmin ? "取消" : "设为"}
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
                    );
                  })}
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
                第 {page} / {totalPages} 页
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
            <i className="ri-emotion-unhappy-line text-2xl mb-2" />{" "}
            <p>暂无评论</p>
          </div>
        )}
      </div>
    </>
  );
};

export default CommentsManager;

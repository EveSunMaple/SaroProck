import type React from "react";
import { useState } from "react";
import toast, { Toaster } from "react-hot-toast";

interface ExportOptions {
  type: "comments" | "likes" | "views";
  format: "json" | "csv";
  dateFrom?: string;
  dateTo?: string;
  postId?: string;
  commentType?: "blog" | "telegram";
}

const DataExport: React.FC = () => {
  const [options, setOptions] = useState<ExportOptions>({
    type: "comments",
    format: "json",
  });
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    setExporting(true);

    try {
      const params = new URLSearchParams();
      params.append("type", options.type);
      params.append("format", options.format);

      if (options.dateFrom) params.append("dateFrom", options.dateFrom);
      if (options.dateTo) params.append("dateTo", options.dateTo);

      const response = await fetch(`/api/admin/export?${params.toString()}`);

      if (!response.ok) {
        throw new Error("导出失败");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `export-${options.type}-${Date.now()}.${options.format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("导出成功！");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("导出失败，请重试");
    } finally {
      setLoading(false);
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-base-content">数据导出</h1>
        <p className="text-base-content/70 mt-2">
          将您的数据导出为 JSON 或 CSV 格式
        </p>
      </div>

      {/* Export Options */}
      <div className="bg-base-200/60 backdrop-blur-sm border border-base-content/10 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <i className="ri-settings-2-line" /> 导出选项
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="label" htmlFor="data-export-type">
              <span className="label-text">导出类型</span>
            </label>
            <select
              id="data-export-type"
              className="select select-bordered w-full"
              value={options.type}
              onChange={(e) =>
                setOptions({ ...options, type: e.target.value as any })
              }
            >
              <option value="comments">评论数据</option>
              <option value="likes">点赞数据</option>
              <option value="views">浏览数据</option>
            </select>
          </div>

          <div>
            <label className="label" htmlFor="data-export-format">
              <span className="label-text">文件格式</span>
            </label>
            <select
              id="data-export-format"
              className="select select-bordered w-full"
              value={options.format}
              onChange={(e) =>
                setOptions({ ...options, format: e.target.value as any })
              }
            >
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
            </select>
          </div>
        </div>

        {/* Filter Options */}
        <div className="mt-6">
          <h3 className="font-semibold mb-3">
            <i className="ri-filter-2-line mr-2" /> 筛选选项（可选）
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="label" htmlFor="data-export-date-from">
                <span className="label-text">开始日期</span>
              </label>
              <input
                id="data-export-date-from"
                type="date"
                className="input input-bordered w-full"
                onChange={(e) =>
                  setOptions({ ...options, dateFrom: e.target.value })
                }
              />
            </div>

            <div>
              <label className="label" htmlFor="data-export-date-to">
                <span className="label-text">结束日期</span>
              </label>
              <input
                id="data-export-date-to"
                type="date"
                className="input input-bordered w-full"
                onChange={(e) =>
                  setOptions({ ...options, dateTo: e.target.value })
                }
              />
            </div>
          </div>
        </div>

        {/* Action */}
        <div className="mt-8 text-center">
          <button
            className="btn btn-primary btn-lg"
            type="button"
            onClick={handleExport}
            disabled={loading || exporting}
          >
            {loading || exporting ? (
              <>
                <span className="loading loading-spinner loading-sm" />{" "}
                正在导出...
              </>
            ) : (
              <>
                <i className="ri-download-2-line mr-2" /> 开始导出
              </>
            )}
          </button>
        </div>

        {/* Help Section */}
        <div className="mt-8 alert alert-info bg-base-100/50">
          <i className="ri-information-line text-xl" />
          <div>
            <h3 className="font-semibold">导出说明</h3>
            <ul className="mt-2 list-disc list-inside text-sm">
              <li>
                <strong>JSON 格式</strong>{" "}
                ：包含完整的数据字段，适合数据备份和迁移
              </li>
              <li>
                <strong>CSV 格式</strong>：简化版本，便于在 Excel
                或其他表格软件中打开
              </li>
              <li>
                <strong>筛选功能</strong>：可选择特定日期范围进行导出
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataExport;

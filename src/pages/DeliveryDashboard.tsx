import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Mail,
  CheckCircle2,
  Eye,
  CornerUpLeft,
  Download,
  ChevronDown,
  AlertTriangle,
  Paperclip,
  Info,
} from "lucide-react";
import MyNoticesService, {
  type Notice,
  type NoticesSummary,
} from "../services/mynotices";
import moment from "moment";
import PaginationPage from "../components/NoticeManagementSystem/Pagination";

const statusOptions = [
  { value: "all", label: "All Status" },
  { value: "Sent", label: "Sent" },
  { value: "Draft", label: "Draft" },
];

const DEFAULT_PAGE_SIZE = 10;

export default function DeliveryStatusDashboard() {
  const navigate = useNavigate();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [summary, setSummary] = useState<NoticesSummary>({
    RECIPIENTS_COUNT: 0,
    RESPONSES_COUNT: 0,
    TOTAL_ATTACHMENTS: 0,
    NOTICES_WITH_RESPONSES: 0,
    TOTAL_NOTICES: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_PAGE_SIZE);

  const [noticeFilter, setNoticeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [noticeDropdownTitles, setNoticeDropdownTitles] = useState<string[]>(
    [],
  );

  const fetchNotices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: {
        search?: string;
        status?: string;
        page?: number;
        limit?: number;
      } = {
        page: currentPage,
        limit: rowsPerPage,
      };
      if (noticeFilter && noticeFilter !== "all") params.search = noticeFilter;
      if (statusFilter && statusFilter !== "all") params.status = statusFilter;
      const result = await MyNoticesService.getMyNotices(params);
      const list = result?.data ?? [];
      setNotices(list);
      setSummary(
        result?.summary ?? {
          RECIPIENTS_COUNT: 0,
          RESPONSES_COUNT: 0,
          TOTAL_ATTACHMENTS: 0,
          NOTICES_WITH_RESPONSES: 0,
          TOTAL_NOTICES: 0,
        },
      );
      setTotalCount(result?.pagination?.total ?? 0);
      setNoticeDropdownTitles((prev) =>
        Array.from(
          new Set([
            ...prev,
            ...list.map((n) => n.NOTICE_TITLE).filter(Boolean),
          ]),
        ),
      );
    } catch (err) {
      console.error("DeliveryStatusDashboard fetch error:", err);
      setError("Failed to load notices.");
      setNotices([]);
      setSummary({
        RECIPIENTS_COUNT: 0,
        RESPONSES_COUNT: 0,
        TOTAL_ATTACHMENTS: 0,
        NOTICES_WITH_RESPONSES: 0,
        TOTAL_NOTICES: 0,
      });
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [noticeFilter, statusFilter, currentPage, rowsPerPage]);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  useEffect(() => {
    setCurrentPage(1);
  }, [noticeFilter, statusFilter]);

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Notification Status Dashboard
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Monitor notice distribution and recipient engagement
            </p>
          </div>

          <button
            onClick={MyNoticesService.downloadCSVDashboard}
            className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>

        {/* Filters */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="relative w-full">
            <label className="sr-only">Notice</label>
            <select
              value={noticeFilter}
              onChange={(e) => setNoticeFilter(e.target.value)}
              className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-4 py-2 pr-10 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Notices</option>
              {noticeDropdownTitles.map((title) => (
                <option key={title} value={title}>
                  {title}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500 pointer-events-none" />
          </div>

          <div className="relative w-full">
            <label className="sr-only">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-4 py-2 pr-10 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500 pointer-events-none" />
          </div>
        </div>

        {/* Stats – from API summary (all filtered notices, not just current page) */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Sent"
            icon={<Mail className="text-blue-500" size={20} />}
            value={String(summary.RECIPIENTS_COUNT ?? 0)}
            subtitle="recipients across all notices"
          />

          <StatCard
            title="Notices with Responses"
            icon={<CheckCircle2 className="text-green-500" size={20} />}
            value={String(summary.NOTICES_WITH_RESPONSES ?? 0)}
            subtitle={`of ${summary.TOTAL_NOTICES ?? 0} notices`}
          />

          <StatCard
            title="Total Responses"
            icon={<CornerUpLeft className="text-blue-500" size={20} />}
            value={String(summary.RESPONSES_COUNT ?? 0)}
          />

          <StatCard
            title="Total Attachments"
            icon={<Paperclip className="text-purple-500" size={20} />}
            value={String(summary.TOTAL_ATTACHMENTS ?? 0)}
            subtitle="from all responses"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">
            Notice Delivery Details
          </h2>

          <div className="overflow-x-auto">
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}
            {loading ? (
              <div className="py-12 text-center text-gray-500">
                Loading notices…
              </div>
            ) : (
              <table className="w-full whitespace-nowrap">
                {/* Table Header */}
                <thead>
                  <tr className="text-sm text-gray-500 border-b">
                    <th className="text-left pb-4">Notice</th>
                    <th className="text-left pb-4">Sensitivity</th>
                    <th className="text-center pb-4">Sent</th>
                    <th className="text-center pb-4">Recipients</th>
                    <th className="text-center pb-4">Responses</th>
                    <th className="text-center pb-4">Attachments</th>
                    <th className="text-center pb-4">Status</th>
                    <th className="text-center pb-4">Actions</th>
                  </tr>
                </thead>

                {/* Table Body */}
                <tbody>
                  {!notices.length ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="py-12 text-center text-gray-500"
                      >
                        Not Data Found
                      </td>
                    </tr>
                  ) : (
                    notices.map((notice) => (
                      <tr
                        key={notice.NOTICE_ID}
                        className="border-b border-gray-200 hover:bg-gray-50"
                      >
                        {/* Notice */}
                        <td className="py-6">
                          <div className="font-semibold text-gray-900 whitespace-nowrap">
                            {notice.NOTICE_TITLE}
                          </div>
                          <div className="text-sm text-gray-500">
                            {moment(notice.CREATE_DATE).format(
                              "YYYY-MM-DD HH:mm",
                            )}
                          </div>
                        </td>

                        {/* Sensitivity */}
                        <td>
                          <SensitivityBadge
                            level={notice.SENSITIVITY_CLASSIFICATION ?? "Low"}
                          />
                        </td>

                        {/* Sent */}
                        <td className="text-sm text-gray-600 text-center">
                          {moment(notice.CREATE_DATE).format(
                            "YYYY-MM-DD HH:mm",
                          )}
                        </td>

                        {/* Recipients */}
                        <td className="text-center font-semibold text-gray-900">
                          {notice.RECIPIENTS_COUNT ?? 0}
                        </td>

                        {/* Responses */}
                        <td className="text-center font-semibold text-blue-600">
                          {notice.RESPONSES_COUNT ?? 0}
                        </td>

                        {/* Attachments – static for now */}
                        <td className="text-center font-semibold text-purple-600 whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <Paperclip size={14} />{" "}
                            {notice.TOTAL_ATTACHMENTS ?? 0}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="text-center">
                          <StatusBadge status={notice.BUTTON_STATUS} />
                        </td>

                        {/* Actions */}
                        <td className="text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() =>
                              navigate(
                                `/my-notices/view-notice/${notice.NOTICE_ID}`,
                              )
                            }
                            className="inline-flex items-center gap-1 px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-100"
                          >
                            <Eye size={14} />
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          {!loading && totalCount > 0 && (
            <PaginationPage
              totalPages={Math.max(1, Math.ceil(totalCount / rowsPerPage))}
              rowsPerPage={rowsPerPage}
              currentPage={currentPage}
              totalRows={totalCount}
              showSelectedRowCount={false}
              showRowsPerPage={true}
              handlePageChange={setCurrentPage}
              handleRowsPerPageChange={(rows) => {
                setRowsPerPage(rows);
                setCurrentPage(1);
              }}
            />
          )}
        </div>

        {/* CJIS info */}
        <div className="mt-6 rounded-lg bg-blue-50 p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600" />
            <p className="text-sm text-blue-700">
              <span className="font-semibold">CJIS Audit Logging Active</span>{" "}
              All delivery events, opens, and responses are immutably logged for
              compliance and audit purposes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  icon,
  value,
  subtitle,
}: {
  title: string;
  icon: React.ReactNode;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition">
      <p className="text-sm text-gray-600 font-medium">{title}</p>

      <div className="flex items-center gap-2 mt-3">
        {icon}

        <span className="text-2xl font-bold text-gray-900">{value}</span>
      </div>

      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}

function SensitivityBadge({ level }: { level: string }) {
  const normalized = level?.trim() ?? "";
  if (normalized.toUpperCase() === "HIGH")
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-200 text-yellow-800 text-sm font-medium">
        <AlertTriangle size={14} />
        HIGH
      </span>
    );

  if (
    normalized.toLowerCase() === "medium" ||
    normalized.toUpperCase() === "MED"
  )
    return (
      <span className="px-3 py-1 rounded-full bg-blue-600 text-white text-sm font-medium">
        MED
      </span>
    );

  if (normalized.toUpperCase() === "CJIS")
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-600 text-white text-sm font-medium">
        <AlertTriangle size={14} />
        CJIS
      </span>
    );

  return (
    <span className="px-3 py-1 rounded-full bg-gray-200 text-gray-700 text-sm font-medium">
      LOW
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "Draft")
    return (
      <span className="px-3 py-1 text-sm rounded-full bg-gray-100 text-gray-700 font-medium">
        Draft
      </span>
    );
  return (
    <span className="px-3 py-1 text-sm rounded-full bg-green-100 text-green-700 font-medium">
      Sent
    </span>
  );
}

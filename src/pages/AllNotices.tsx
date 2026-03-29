import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Eye,
  Send,
  Search,
  Plus,
  SquarePen,
  Trash2,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import Swal from "sweetalert2";

import moment from "moment";
import MyNoticesService, {
  Notice,
  NoticeStatus,
  SensitivityLevel,
} from "../services/mynotices";

import PaginationPage from "../components/NoticeManagementSystem/Pagination";

interface Props {
  openCreateNotice?: () => void;
  openViewNotice?: (noticeId?: number) => void;
  editNotice?: (noticeId?: number) => void;
}

export default function AllNotices({
  openCreateNotice: openCreateNoticeProp,
  openViewNotice: openViewNoticeProp,
  editNotice: editNoticeProp,
}: Props) {
  const navigate = useNavigate();
  const openCreateNotice = openCreateNoticeProp ?? (() => navigate('/my-notices/create'));
  const openViewNotice = openViewNoticeProp ?? ((noticeId?: number) => navigate(noticeId ? `/my-notices/view-notice/${noticeId}` : '/my-notices/view-notice'));
  const editNotice = editNoticeProp ?? ((noticeId?: number) => navigate(noticeId ? `/my-notices/edit/${noticeId}` : '/my-notices/create'));
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<NoticeStatus | "All">("All");
  const [sensitivityFilter, setSensitivityFilter] = useState<
    SensitivityLevel | "All"
  >("All");

  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // ⭐ Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const isFirstFilterRun = useRef(true);

  const fetchNotices = async (
    overridePage?: number,
    overrideLimit?: number,
  ) => {
    try {
      setLoading(true);
      const page = overridePage ?? currentPage;
      const limit = overrideLimit ?? rowsPerPage;

      const result = await MyNoticesService.getMyNotices({
        search: searchTerm || undefined,
        status:
          statusFilter && statusFilter !== "All" ? statusFilter : undefined,
        sensitivity:
          sensitivityFilter && sensitivityFilter !== "All"
            ? sensitivityFilter
            : undefined,
        page,
        limit,
      });

      setNotices(result.data);
      setTotalCount(result.pagination.total);
    } catch (error) {
      console.error("Failed to fetch notices", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch when page or rowsPerPage changes (including initial load)
  useEffect(() => {
    fetchNotices();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchNotices uses currentPage/rowsPerPage from closure; we only want to re-run when these change
  }, [currentPage, rowsPerPage]);

  // Debounced filters: reset to page 1 and refetch with current filters
  useEffect(() => {
    if (isFirstFilterRun.current) {
      isFirstFilterRun.current = false;
      return;
    }

    const timer = setTimeout(() => {
      setCurrentPage(1);
      fetchNotices(1, rowsPerPage);
    }, 400);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally debounced; fetchNotices(1, rowsPerPage) uses current filter state
  }, [searchTerm, statusFilter, sensitivityFilter]);

  const handleDelete = async (noticeId: number, title: string) => {
    const result = await Swal.fire({
      title: "Delete Notice?",
      text: `Are you sure you want to delete "${title}"? This cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
    });
    if (!result.isConfirmed) return;
    try {
      await MyNoticesService.deleteNotice(noticeId);
      await Swal.fire({ icon: "success", title: "Deleted", text: "Notice deleted successfully", timer: 1500, showConfirmButton: false });
      fetchNotices();
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Failed to delete notice";
      await Swal.fire({ icon: "error", title: "Error", text: msg });
    }
  };

  // Server-side pagination: API returns current page only
  const totalPages = Math.max(1, Math.ceil(totalCount / rowsPerPage));
  const paginatedNotices = notices;

  const sensitivityStyle = (level: SensitivityLevel): string => {
    switch (level) {
      case "CJIS":
        return "bg-red-500 text-white";
      case "Medium":
        return "bg-blue-700 text-white";
      case "High":
        return "bg-yellow-100 text-yellow-700";
      case "Low":
        return "bg-gray-200 text-gray-700";
      default:
        return "bg-gray-200 text-gray-700";
    }
  };

  const statusStyle = (status: NoticeStatus): string =>
    status === "Sent"
      ? "bg-green-100 text-green-700"
      : "bg-gray-200 text-gray-700";

  return (
    <div className="min-h-screen bg-gray-50 p-[16px] md:p-5">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">
              Notice Management
            </h1>
            <p className="text-gray-500 mt-1">
              Create, manage, and track notices with compliance
            </p>
          </div>

          <button
            onClick={openCreateNotice}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            <Plus size={16} />
            Create Notice
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search notices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as NoticeStatus | "All")
            }
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Status</option>
            <option value="Sent">Sent</option>
            <option value="Draft">Draft</option>
          </select>

          <select
            value={sensitivityFilter}
            onChange={(e) =>
              setSensitivityFilter(e.target.value as SensitivityLevel | "All")
            }
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="All">All Sensitivity Levels</option>
            <option value="CJIS">CJIS</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Low">Low</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-6">
            Notices ({totalCount})
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-gray-600 border-b">
                <tr>
                  <th className="pb-4">Title</th>
                  <th className="pb-4">Sensitivity</th>
                  <th className="pb-4 text-center">Status</th>
                  <th className="pb-4 text-center">Type</th>
                  <th className="pb-4 text-center whitespace-nowrap">
                    Created By
                  </th>
                  <th className="pb-4 text-center">Created</th>
                  <th className="pb-4 text-center">Recipients</th>
                  <th className="pb-4 text-center">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {!loading && paginatedNotices.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-500">
                      No notices found
                    </td>
                  </tr>
                )}

                {!loading &&
                  paginatedNotices.map((notice) => (
                    <tr
                      key={notice.NOTICE_ID}
                      className="hover:bg-gray-50 whitespace-nowrap"
                    >
                      <td className="py-4 font-medium text-gray-800">
                        {notice.NOTICE_TITLE}
                      </td>

                      <td>
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 text-xs rounded-full font-medium  ${sensitivityStyle(
                            notice.SENSITIVITY_CLASSIFICATION as SensitivityLevel,
                          )}`}
                        >
                          {(notice.SENSITIVITY_CLASSIFICATION === "CJIS" ||
                            notice.SENSITIVITY_CLASSIFICATION === "High") && (
                            <AlertTriangle size={12} />
                          )}
                          {notice.SENSITIVITY_CLASSIFICATION}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 text-xs rounded-full font-medium text-center ${statusStyle(
                            notice.BUTTON_STATUS as NoticeStatus,
                          )}`}
                        >
                          {notice.BUTTON_STATUS === "Sent" ? (
                            <Send size={12} />
                          ) : (
                            <SquarePen size={12} />
                          )}
                          {notice.BUTTON_STATUS}
                        </span>
                      </td>

                      <td className="text-center ">
                        {notice.DISTRIBUTION_TYPE}
                      </td>
                      <td className="text-center px-0 sm:px-2">
                        {notice.CREATE_USER_NAME}
                      </td>

                      <td className="text-center px-0 sm:px-2">
                        {moment(notice.CREATE_DATE).format("YYYY-MM-DD HH:mm")}
                      </td>

                      <td className="font-semibold text-center">
                        {notice.RECIPIENTS_COUNT}
                      </td>

                      <td className="text-center">
                        <div className="inline-flex items-center gap-2">
                          {notice.BUTTON_STATUS === "Sent" ? (
                            <button
                              onClick={() => openViewNotice(notice.NOTICE_ID)}
                              className="inline-flex items-center gap-2 border px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50"
                            >
                              <Eye size={14} />
                              View
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => editNotice(notice.NOTICE_ID)}
                                className="inline-flex items-center gap-2 border px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50"
                              >
                                <SquarePen size={14} />
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(notice.NOTICE_ID, notice.NOTICE_TITLE)}
                                className="inline-flex items-center gap-2 border border-red-200 text-red-600 px-3 py-1.5 rounded-lg text-sm hover:bg-red-50"
                              >
                                <Trash2 size={14} />
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <PaginationPage
            totalPages={totalPages}
            rowsPerPage={rowsPerPage}
            currentPage={currentPage}
            totalRows={totalCount}
            selectedRows={0}
            handlePageChange={(page) => setCurrentPage(page)}
            handleRowsPerPageChange={(rows) => {
              setRowsPerPage(rows);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-300 rounded-lg p-4 flex items-start gap-3">
        <CheckCircle className="text-blue-600 w-5 h-5 mt-1" />
        <div>
          <h4 className="text-blue-800 font-semibold text-sm">
            Role-Based Access Active
          </h4>
          <p className="text-blue-700 text-sm mt-1">
            All actions are logged for compliance.
          </p>
        </div>
      </div>
    </div>
  );
}

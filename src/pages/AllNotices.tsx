import { useState, useEffect, useRef } from "react";
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
import { Modal } from "react-bootstrap";
import DataTable, { TableColumn } from "react-data-table-component";
import "../styles/StatusBadge.css";

import moment from "moment";
import MyNoticesService, {
  Notice,
  NoticeStatus,
  SensitivityLevel,
} from "../services/mynotices";

import CreateNotice from "./CreateNotice";
import ViewNotice from "./ViewNotice";
import CreateNoticeModalV2 from "../components/CreateNoticeModalV2";

export default function AllNotices() {
  const [modalType, setModalType] = useState<'create' | 'edit' | 'view' | null>(null);
  const [selectedNoticeId, setSelectedNoticeId] = useState<number | undefined>();
  const [showV2, setShowV2] = useState(false);

  const openCreateNotice = () => { setShowV2(true); };
  const openViewNotice = (noticeId?: number) => { setModalType('view'); setSelectedNoticeId(noticeId); };
  const editNotice = (noticeId?: number) => { setModalType('edit'); setSelectedNoticeId(noticeId); };
  const closeModal = () => { setModalType(null); setSelectedNoticeId(undefined); };

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<NoticeStatus | "All">("All");
  const [sensitivityFilter, setSensitivityFilter] = useState<
    SensitivityLevel | "All"
  >("All");

  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Pagination states
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const sensitivityStyle = (level: SensitivityLevel): string => {
    switch (level) {
      case "CJIS":
        return "status-badge status-badge--cancelled";
      case "High":
        return "status-badge status-badge--pending";
      case "Medium":
        return "status-badge status-badge--active";
      case "Low":
        return "status-badge status-badge--onhold";
      default:
        return "status-badge";
    }
  };

  const statusStyle = (status: NoticeStatus): string => {
    switch (status) {
      case "Sent":
        return "status-badge status-badge--sent";
      case "Draft":
        return "status-badge status-badge--draft";
      case "Published":
        return "status-badge status-badge--published";
      default:
        return "status-badge status-badge--active";
    }
  };

  // DataTable columns definition
  const columns: TableColumn<Notice>[] = [
    {
      name: "Title",
      selector: (row) => row.NOTICE_TITLE,
      sortable: true,
      grow: 2,
      cell: (row) => (
        <span style={{ fontWeight: 500 }}>{row.NOTICE_TITLE}</span>
      ),
    },
    {
      name: "Sensitivity",
      selector: (row) => row.SENSITIVITY_CLASSIFICATION || "",
      sortable: true,
      width: "140px",
      cell: (row) => (
        <span className={sensitivityStyle(row.SENSITIVITY_CLASSIFICATION as SensitivityLevel)}>
          {row.SENSITIVITY_CLASSIFICATION}
        </span>
      ),
    },
    {
      name: "Status",
      selector: (row) => row.BUTTON_STATUS || "",
      sortable: true,
      width: "120px",
      cell: (row) => (
        <span className={statusStyle(row.BUTTON_STATUS as NoticeStatus)}>
          {row.BUTTON_STATUS}
        </span>
      ),
    },
    {
      name: "Type",
      selector: (row) => row.DISTRIBUTION_TYPE || "",
      sortable: true,
      width: "120px",
    },
    {
      name: "Created By",
      selector: (row) => row.CREATE_USER_NAME || "",
      sortable: true,
      width: "150px",
    },
    {
      name: "Created",
      selector: (row) => row.CREATE_DATE || "",
      sortable: true,
      width: "160px",
      cell: (row) => moment(row.CREATE_DATE).format("YYYY-MM-DD HH:mm"),
    },
    {
      name: "Recipients",
      selector: (row) => row.RECIPIENTS_COUNT || 0,
      sortable: true,
      width: "110px",
      cell: (row) => (
        <span style={{ fontWeight: 600, display: 'block', textAlign: 'center', width: '100%' }}>{row.RECIPIENTS_COUNT}</span>
      ),
    },
    {
      name: "Actions",
      sortable: false,
      width: "200px",
      cell: (row) => (
        <div className="d-flex align-items-center gap-1">
          {row.BUTTON_STATUS === "Sent" ? (
            <button
              onClick={(e) => { e.stopPropagation(); openViewNotice(row.NOTICE_ID); }}
              className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1"
            >
              <Eye size={14} />
              View
            </button>
          ) : (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); editNotice(row.NOTICE_ID); }}
                className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1"
              >
                <SquarePen size={14} />
                Edit
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(row.NOTICE_ID, row.NOTICE_TITLE); }}
                className="btn btn-outline-danger btn-sm d-inline-flex align-items-center gap-1"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="container">
      {/* Page Title - matches Request Dashboard */}
      <h1 className="text-2xl font-bold uppercase fs-2 mb-8">Notices Dashboard</h1>

      {/* Section Header with divider bar */}
      <div className="mb-3">
        <div className="d-flex align-items-center">
          <div className="bg-secondary" style={{ width: '4px', height: '20px', marginRight: '12px' }}></div>
          <div>
            <h3 className="mb-1" style={{ fontSize: '20px', fontWeight: '600', color: '#2c3e50' }}>
              All Notices
            </h3>
            <p className="mb-0 text-muted" style={{ fontSize: '13px' }}>
              Create, manage, and track notices with compliance
            </p>
          </div>
        </div>
      </div>

      {/* Toolbar - matches Request Dashboard layout */}
      <div className="request-dashboard-header mb-3 d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center gap-2">
          <button
            className="btn btn-outline-secondary"
            style={{
              minWidth: 100,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap'
            }}
            onClick={() => fetchNotices()}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-arrow-clockwise me-1" viewBox="0 0 16 16">
              <path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z" />
              <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z" />
            </svg>
            Refresh
          </button>

          <button
            onClick={openCreateNotice}
            className="btn bg-warning text-dark ms-2"
            style={{ minWidth: 140 }}
          >
            Create Notice
          </button>
        </div>

        {/* Search Input */}
        <div className="d-flex align-items-center">
          <input
            type="text"
            className="form-control"
            style={{ maxWidth: 260 }}
            placeholder="Search notices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* DataTable - sortable columns, matches Request Dashboard */}
      <DataTable
        columns={columns}
        data={notices}
        pagination
        paginationServer
        paginationTotalRows={totalCount}
        paginationPerPage={rowsPerPage}
        paginationDefaultPage={currentPage}
        onChangePage={(page) => setCurrentPage(page)}
        onChangeRowsPerPage={(perPage) => {
          setRowsPerPage(perPage);
          setCurrentPage(1);
        }}
        progressPending={loading}
        persistTableHead
        highlightOnHover
        pointerOnHover
        responsive
        striped
        defaultSortFieldId={1}
        defaultSortAsc={false}
        customStyles={{
          table: {
            style: {
              width: '100%',
            },
          },
          cells: {
            style: {
              paddingLeft: '8px',
              paddingRight: '8px',
              overflow: 'visible',
              whiteSpace: 'normal',
            },
          },
          headCells: {
            style: {
              paddingLeft: '8px',
              paddingRight: '8px',
              fontWeight: 'bold',
            },
          },
        }}
        noDataComponent={
          <div className="p-4 text-center">
            No notices found
          </div>
        }
      />

      {/* Notice Modal (Create / Edit / View) */}
      <Modal show={modalType !== null} onHide={closeModal} size="lg" scrollable centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {modalType === 'create' && 'Create Notice - Save as draft or send.'}
            {modalType === 'edit' && 'Edit Notice - Save as draft or send.'}
            {modalType === 'view' && 'Notice Details & Responses'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {(modalType === 'create' || modalType === 'edit') && (
            <CreateNotice
              modalMode
              editNoticeId={modalType === 'edit' ? selectedNoticeId : undefined}
              onClose={closeModal}
              onSuccess={() => { closeModal(); fetchNotices(); }}
            />
          )}
          {modalType === 'view' && selectedNoticeId && (
            <ViewNotice
              modalMode
              noticeId={selectedNoticeId}
              onClose={closeModal}
            />
          )}
        </Modal.Body>
      </Modal>

      <CreateNoticeModalV2
        isOpen={showV2}
        onClose={() => setShowV2(false)}
        onCreated={() => { setShowV2(false); fetchNotices(); }}
      />
    </div>
  );
}

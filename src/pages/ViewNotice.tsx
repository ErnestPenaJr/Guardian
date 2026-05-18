import DOMPurify from "dompurify";
import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useFormik } from "formik";
import {
  AlertTriangle,
  MessageSquare,
  ArrowLeft,
  User,
  Clock,
  Paperclip,
  Download,
  CheckCircle,
  FileText,
  Upload,
  X,
} from "lucide-react";
import { OverlayTrigger, Tooltip } from "react-bootstrap";
import { useDropzone } from "react-dropzone";
import MyNoticesService, { Notice } from "../services/mynotices";
import moment from "moment";
import Swal from "sweetalert2";
import { useAuth } from "../hooks/useAuth";
import { can } from "../utils/permissions";
import api from "../utils/api";

type ResponseFormValues = {
  response: string;
  attachment: File | null;
};

function validateResponseForm(
  values: ResponseFormValues,
): Partial<Record<keyof ResponseFormValues, string>> {
  const errors: Partial<Record<keyof ResponseFormValues, string>> = {};
  const trimmed = (values.response ?? "").trim();

  if (!trimmed) errors.response = "Response is required.";
  else if (trimmed.length < 10)
    errors.response = "Response must be at least 10 characters.";
  else if (trimmed.length > 5000)
    errors.response = "Response must be at most 5,000 characters.";

  return errors;
}

function sensitivityBadgeClass(classification: string): string {
  switch (classification) {
    case "CJIS":
      return "bg-red-600 text-white";
    case "Medium":
      return "bg-blue-700 text-white";
    case "High":
      return "bg-yellow-100 text-yellow-800 border border-yellow-300";
    default:
      return "bg-gray-200 text-gray-700";
  }
}

/* Dropzone sub-component matching site-wide upload pattern */
function ResponseDropzone({
  file,
  onFileChange,
  disabled,
}: {
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled: boolean;
}) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length > 0) onFileChange(accepted[0]);
    },
    [onFileChange],
  );

  const { getRootProps, getInputProps, isDragActive, isDragAccept, isDragReject } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "text/plain": [".txt"],
      "text/csv": [".csv"],
    },
    maxSize: 10 * 1024 * 1024,
    multiple: false,
    disabled,
  });

  const baseStyle = "border-2 border-dashed rounded-lg p-4 text-center transition-all cursor-pointer mt-4";
  const zoneClass = disabled
    ? `${baseStyle} border-gray-200 bg-gray-50 cursor-not-allowed opacity-50`
    : isDragAccept
      ? `${baseStyle} border-green-400 bg-green-50 text-green-600`
      : isDragReject
        ? `${baseStyle} border-red-400 bg-red-50 text-red-600`
        : isDragActive
          ? `${baseStyle} border-blue-400 bg-blue-50 text-blue-600`
          : `${baseStyle} border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500`;

  return (
    <div>
      <div {...getRootProps()} className={zoneClass}>
        <input {...getInputProps()} />
        <div className="py-1">
          {isDragActive ? (
            isDragAccept ? (
              <>
                <Upload size={24} className="mx-auto mb-1 text-green-500" />
                <p className="text-sm font-medium text-green-600">Drop file here</p>
              </>
            ) : (
              <>
                <X size={24} className="mx-auto mb-1 text-red-500" />
                <p className="text-sm font-medium text-red-600">File type not supported</p>
              </>
            )
          ) : (
            <>
              <Upload size={24} className="mx-auto mb-1" />
              <p className="text-sm font-medium">Drag & drop a file here, or click to browse</p>
              <p className="text-xs text-gray-400 mt-0.5">
                PDF, DOC/DOCX, XLS/XLSX, TXT, Images — Max 10MB
              </p>
            </>
          )}
        </div>
      </div>

      {/* Selected file preview */}
      {file && (
        <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mt-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={16} className="text-gray-500 flex-shrink-0" />
            <span className="text-sm text-gray-700 truncate">{file.name}</span>
            <span className="text-xs text-gray-400 flex-shrink-0">
              {(file.size / 1024).toFixed(0)} KB
            </span>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onFileChange(null); }}
            className="text-gray-400 hover:text-red-500 flex-shrink-0 ml-2"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

interface ViewNoticeProps {
  modalMode?: boolean;
  noticeId?: number;
  onClose?: () => void;
}

export default function ViewNotice({
  modalMode = false,
  noticeId: noticeIdProp,
  onClose,
}: ViewNoticeProps = {}) {
  const { id: paramId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const id = modalMode ? (noticeIdProp ? String(noticeIdProp) : undefined) : paramId;

  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const responseForm = useFormik<ResponseFormValues>({
    initialValues: { response: "", attachment: null },
    validate: validateResponseForm,

    onSubmit: async (values) => {
      if (!notice?.NOTICE_ID) return;

      try {
        await MyNoticesService.submitNoticeResponse(
          notice.NOTICE_ID,
          values.response.trim(),
          values.attachment ?? undefined,
        );
        const updated = await MyNoticesService.getNoticeById(notice.NOTICE_ID);
        if (updated) setNotice(updated);
        responseForm.resetForm();
        await Swal.fire({
          icon: "success",
          title: "Success",
          text: "Your response has been submitted successfully.",
          confirmButtonColor: "#2563eb",
        });
      } catch (err) {
        console.error("Submit response failed:", err);
        const errMsg =
          (
            err as {
              response?: { data?: { error?: string; message?: string } };
            }
          )?.response?.data?.error ??
          (err as { response?: { data?: { message?: string } } })?.response
            ?.data?.message ??
          (err as Error)?.message ??
          "Submission failed. Please try again.";
        await Swal.fire({
          icon: "error",
          title: "Submission Failed",
          text: errMsg,
          confirmButtonColor: "#d33",
        });
      }
    },
  });

  useEffect(() => {
    if (!id) return;

    const fetchNotice = async () => {
      
      try {
        setLoading(true);
        setError(null);

        const data = await MyNoticesService.getNoticeById(Number(id));
        setNotice(data);
      } catch (err: any) {
        setError("Failed to load notice");

        await Swal.fire({
          icon: "error",
          title: "Could not load notice",
          text: "This notice could not be loaded. It may have been removed or you may not have access.",
          confirmButtonColor: "#2563eb",
        });
        console.log(err);
      } finally {
        setLoading(false);
      }
    };

    fetchNotice();
  }, [id]);
  // No notice ID provided
  if (!id) {
    if (modalMode) return <p className="text-center text-gray-500 py-8">No notice selected.</p>;
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4 flex justify-center items-center">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            No notice selected
          </h2>
          <p className="text-gray-600 mb-6">
            Go to All Notices and click <strong>View</strong> on a notice to see
            its details and responses here.
          </p>
          <button
            type="button"
            onClick={() => navigate("/my-notices")}
            className="inline-flex items-center gap-2 border border-gray-300 bg-white px-4 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft size={16} />
            Back to All Notices
          </button>
        </div>
      </div>
    );
  }

  if (loading) return <div className="text-center py-10">Loading...</div>;

  if (error || !notice) {
    if (modalMode) return <p className="text-center text-red-600 py-8">{error ?? "Failed to load notice."}</p>;
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4 flex justify-center items-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">
            {error ?? "Failed to load notice."}
          </p>
          <button
            type="button"
            onClick={() => navigate("/my-notices")}
            className="inline-flex items-center gap-2 border border-gray-300 bg-white px-4 py-2 rounded-md text-sm"
          >
            <ArrowLeft size={16} />
            Back to All Notices
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={modalMode ? "" : "min-h-screen bg-gray-50 py-8 px-4 flex justify-center"}>
      <div className={modalMode ? "space-y-6" : "w-full max-w-6xl space-y-6"}>
        {/* HEADER */}
        {!modalMode && (
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() =>
                navigate("/my-notices/notification-status-dashboard")
              }
              className="flex items-center gap-2 border px-3 py-2 rounded-md bg-white text-sm"
            >
              <ArrowLeft size={16} />
              Back to Dashboard
            </button>

            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Notice Details & Responses
              </h1>

              <p className="text-sm text-gray-500">
                View notice content, responses, and attachments
              </p>
            </div>
          </div>

          <button
            onClick={() =>
              MyNoticesService.downloadSingleNoticeCSV(parseInt(id))
            }
            className="bg-blue-600 text-white px-4 py-2 rounded-md flex items-center gap-2 text-sm w-full md:w-auto justify-center"
          >
            <Download size={16} />
            Export All Responses
          </button>
        </div>
        )}

        {/* NOTICE CARD */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-3">
          {/* Header row: title + sensitivity + KPIs */}
          <div className="flex justify-between items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-900 truncate">
                  {notice.NOTICE_TITLE}
                </h2>
                <span
                  className={`flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${sensitivityBadgeClass(
                    notice.SENSITIVITY_CLASSIFICATION,
                  )}`}
                >
                  <AlertTriangle size={10} />
                  {notice.SENSITIVITY_CLASSIFICATION}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-0.5">
                <span className="flex items-center gap-1"><User size={10} />{notice.CREATE_USER_NAME}</span>
                <span className="flex items-center gap-1"><Clock size={10} />{moment(notice.CREATE_DATE).format("YYYY-MM-DD HH:mm")}</span>
              </div>
            </div>
            {/* KPI pills */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <OverlayTrigger placement="bottom" overlay={<Tooltip>Total Recipients</Tooltip>}>
                <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-md px-2 py-1 cursor-default">
                  <User size={11} className="text-gray-400" />
                  <span className="text-xs font-semibold text-gray-700">{notice.RECIPIENTS_COUNT ?? 0}</span>
                </div>
              </OverlayTrigger>
              <OverlayTrigger placement="bottom" overlay={<Tooltip>Responses Received</Tooltip>}>
                <div className="flex items-center gap-1 bg-blue-50 border border-blue-100 rounded-md px-2 py-1 cursor-default">
                  <MessageSquare size={11} className="text-blue-500" />
                  <span className="text-xs font-semibold text-blue-700">{notice.RESPONSES_COUNT ?? 0}</span>
                </div>
              </OverlayTrigger>
              <OverlayTrigger placement="bottom" overlay={<Tooltip>Total Attachments</Tooltip>}>
                <div className="flex items-center gap-1 bg-purple-50 border border-purple-100 rounded-md px-2 py-1 cursor-default">
                  <Paperclip size={11} className="text-purple-500" />
                  <span className="text-xs font-semibold text-purple-700">{notice.TOTAL_ATTACHMENTS ?? 0}</span>
                </div>
              </OverlayTrigger>
            </div>
          </div>

          {/* WARNING – shown when sensitivity is High or CJIS */}
          {(notice.SENSITIVITY_CLASSIFICATION === "High" ||
            notice.SENSITIVITY_CLASSIFICATION === "CJIS") && (
            <div className="border border-red-300 bg-red-50 rounded-lg p-3 mb-3 flex gap-2">
              <AlertTriangle className="text-red-600 flex-shrink-0" size={16} />
              <div>
                <p className="text-red-700 text-sm font-medium">
                  Classified Content Warning
                </p>
                <p className="text-red-600 text-xs">
                  This notice contains {notice.SENSITIVITY_CLASSIFICATION}{" "}
                  sensitivity information. All access is logged. Do not share or
                  distribute without proper authorization.
                </p>
              </div>
            </div>
          )}

          {/* NOTICE BODY */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700">
            <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(notice.NOTICE_BODY) }} />
          </div>

          {/* Securities Fraud Notice — Phase 5 control gating (US-SNT-06).
              Only renders when the underlying record has the workflow fields
              populated. Buttons are individually gated by `can(user, ...)`. */}
          {(() => {
            const sec = notice as unknown as {
              TEMPLATE_FORM_ID?: number | null;
              NOTICE_STATUS?: string | null;
              SUBMITTED_BY?: number | null;
              REJECTION_REASON?: string | null;
              ATTACHED_SUBPOENA_ATTACHMENT_ID?: number | null;
            };
            const isSecurities = !!(sec.TEMPLATE_FORM_ID || sec.NOTICE_STATUS);
            if (!isSecurities) return null;
            const status = sec.NOTICE_STATUS ?? '';
            const showSend =
              can(user, 'securitiesNotice.send') &&
              (status === '' || status === 'DRAFT' || status === 'RETURNED_FOR_REVISION');
            const showSubmit =
              can(user, 'securitiesNotice.submit') &&
              (status === 'DRAFT' || status === 'RETURNED_FOR_REVISION');
            const showApprove =
              can(user, 'securitiesNotice.approve') && status === 'PENDING_APPROVAL';
            // Phase 7 / US-SRB-04 — Mark Records Released. Visible only when
            // notice is in SUBPOENA_RECEIVED_PENDING_REVIEW AND the caller has
            // the markRecordsReleased permission (Processor or Manager).
            const showRecordsReleased =
              can(user, 'securitiesNotice.markRecordsReleased') &&
              status === 'SUBPOENA_RECEIVED_PENDING_REVIEW';
            // Subpoena download link visible only to Processor/Manager/Admin
            // (anyone holding securitiesNotice.view). GENERAL_USER (role 2,
            // who has viewReadOnly but NOT view) is excluded — per US-SRB-04.
            const showSubpoenaDownload =
              can(user, 'securitiesNotice.view') &&
              !!sec.ATTACHED_SUBPOENA_ATTACHMENT_ID;
            if (
              !showSend &&
              !showSubmit &&
              !showApprove &&
              !showRecordsReleased &&
              !showSubpoenaDownload &&
              !sec.REJECTION_REASON
            )
              return null;
            return (
              <div className="mt-3 border border-blue-200 bg-blue-50 rounded-lg p-3 flex flex-wrap gap-2 items-center">
                <span className="text-xs font-semibold text-blue-800 mr-2">
                  Securities Notice
                  {status ? ` — ${status}` : ''}
                </span>
                {sec.REJECTION_REASON && (
                  <span className="text-xs text-amber-700 italic">
                    Returned for revision: {sec.REJECTION_REASON}
                  </span>
                )}
                {showSend && (
                  <button
                    type="button"
                    onClick={() => navigate(`/securities-notices/new?noticeId=${notice.NOTICE_ID}`)}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-xs"
                  >
                    Send
                  </button>
                )}
                {showSubmit && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await api.put(`/api/securities-notices/${notice.NOTICE_ID}/submit`);
                        await Swal.fire({ icon: 'success', title: 'Submitted for approval' });
                      } catch (e: unknown) {
                        const err = e as { response?: { data?: { error?: string } } };
                        await Swal.fire({
                          icon: 'error',
                          title: 'Submit failed',
                          text: err?.response?.data?.error ?? 'Server error',
                        });
                      }
                    }}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-xs"
                  >
                    Submit for Approval
                  </button>
                )}
                {showApprove && (
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/securities-notices/approvals?id=${notice.NOTICE_ID}`)
                    }
                    className="bg-green-600 text-white px-3 py-1 rounded text-xs"
                  >
                    Review for Approval
                  </button>
                )}
                {showSubpoenaDownload && (
                  <a
                    href={`/api/attachments/${sec.ATTACHED_SUBPOENA_ATTACHMENT_ID}`}
                    className="bg-gray-200 text-gray-800 px-3 py-1 rounded text-xs hover:bg-gray-300"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Download Executed Subpoena
                  </a>
                )}
                {showRecordsReleased && (
                  <button
                    type="button"
                    onClick={async () => {
                      const confirm = await Swal.fire({
                        icon: 'question',
                        title: 'Mark records released?',
                        text:
                          'This confirms that records covered by the subpoena have been released to the requesting party.',
                        showCancelButton: true,
                        confirmButtonText: 'Confirm',
                      });
                      if (!confirm.isConfirmed) return;
                      try {
                        await api.put(`/api/securities-notices/${notice.NOTICE_ID}/records-released`);
                        await Swal.fire({ icon: 'success', title: 'Records released' });
                        // Refresh to pick up new NOTICE_STATUS.
                        window.location.reload();
                      } catch (e: unknown) {
                        const err = e as { response?: { data?: { error?: string } } };
                        await Swal.fire({
                          icon: 'error',
                          title: 'Failed to mark records released',
                          text: err?.response?.data?.error ?? 'Server error',
                        });
                      }
                    }}
                    className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700"
                  >
                    Mark Records Released
                  </button>
                )}
              </div>
            );
          })()}

          {/* RECIPIENT RESPONSES – inside notice card, below body */}
          <div className="border-t border-gray-200 mt-4 pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <MessageSquare size={14} className="text-blue-500" />
              Responses ({notice.RESPONSES_COUNT ?? notice.RESPONSES?.length ?? 0})
            </h3>

            {(notice.RESPONSES?.length ?? 0) === 0 ? (
              <p className="text-xs text-gray-400 py-2">No responses yet.</p>
            ) : (
              <div className="space-y-3">
                {(notice.RESPONSES ?? []).map((resp) => (
                  <div
                    key={resp.RESPONSE_MY_NOTICE_ID}
                    className="border border-gray-200 rounded-lg p-3 bg-gray-50"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                          <User size={14} />
                        </div>
                        <div>
                          <p className="text-sm font-medium leading-tight">
                            {resp.USER?.FIRST_NAME ?? "—"}
                          </p>
                          <p className="text-[11px] text-gray-400">
                            {resp.USER?.EMAIL ?? "—"} &middot; {resp.CREATE_DATE
                              ? moment(resp.CREATE_DATE).format("YYYY-MM-DD HH:mm")
                              : "—"}
                          </p>
                        </div>
                      </div>
                      <span className="flex items-center gap-1 text-[11px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        <CheckCircle size={12} />
                        Acknowledged
                      </span>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-md p-2.5 text-sm text-gray-700 mt-2">
                      {resp.RESPONSE_TEXT ?? "—"}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* SUBMIT RESPONSE – inline below responses */}
            <form onSubmit={responseForm.handleSubmit} className="mt-4">
              <textarea
                name="response"
                rows={3}
                placeholder="Enter your response (at least 10 characters)..."
                value={responseForm.values.response}
                onChange={responseForm.handleChange}
                onBlur={responseForm.handleBlur}
                className={`w-full border rounded-md p-3 text-sm ${
                  (responseForm.touched.response ||
                    responseForm.submitCount > 0) &&
                  responseForm.errors.response
                    ? "border-red-500 focus:ring-red-500"
                    : "border-gray-300"
                }`}
              />
              <div className="flex justify-between items-center mt-1">
                <div>
                  {(responseForm.touched.response || responseForm.submitCount > 0) &&
                    responseForm.errors.response && (
                      <p className="text-xs text-red-600" role="alert">
                        {responseForm.errors.response}
                      </p>
                    )}
                </div>
                <span className={`text-xs ${
                  (responseForm.values.response ?? '').trim().length < 10
                    ? 'text-red-500'
                    : (responseForm.values.response ?? '').trim().length > 4500
                      ? 'text-yellow-600'
                      : 'text-gray-400'
                }`}>
                  {(responseForm.values.response ?? '').length} / 5,000 {(responseForm.values.response ?? '').trim().length < 10 && '(min 10)'}
                </span>
              </div>
              <button
                type="submit"
                disabled={responseForm.isSubmitting}
                className="mt-2 bg-blue-600 text-white px-4 py-2 rounded-md flex items-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <MessageSquare size={14} />
                {responseForm.isSubmitting ? "Submitting…" : "Submit Response"}
              </button>
            </form>
          </div>
        </div>

        {/* ATTACHMENTS & UPLOAD – combined container */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Paperclip size={14} className="text-purple-500" />
            Attachments
          </h3>

          {/* Existing attachments from responses */}
          {(() => {
            const allAttachments = (notice.RESPONSES ?? [])
              .filter((r) => r.ATTACHMENT)
              .map((r) => ({ attachment: r.ATTACHMENT!, userName: r.USER?.FIRST_NAME ?? "—", date: r.CREATE_DATE }));
            return allAttachments.length > 0 ? (
              <div className="space-y-2 mb-4">
                {allAttachments.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between border border-purple-200 bg-purple-50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText size={16} className="text-purple-600 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{item.attachment.FILE_NAME}</p>
                        <p className="text-[11px] text-gray-400">
                          {item.userName} &middot; {item.date ? moment(item.date).format("YYYY-MM-DD HH:mm") : "—"}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => MyNoticesService.handleAttachmentDownload(item.attachment)}
                      className="border border-gray-300 rounded-md p-1.5 bg-white hover:bg-gray-100 flex-shrink-0 ml-2"
                      title="Download"
                    >
                      <Download size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 mb-3">No attachments yet.</p>
            );
          })()}

          {/* Dropzone upload */}
          <ResponseDropzone
            file={responseForm.values.attachment}
            onFileChange={(file) => responseForm.setFieldValue("attachment", file)}
            disabled={responseForm.isSubmitting}
          />
        </div>
      </div>
    </div>
  );
}

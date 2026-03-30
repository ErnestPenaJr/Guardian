import DOMPurify from "dompurify";
import { useEffect, useState } from "react";
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
} from "lucide-react";
import MyNoticesService, { Notice } from "../services/mynotices";
import moment from "moment";
import Swal from "sweetalert2";

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
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {notice.NOTICE_TITLE}
              </h2>

              <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                <span className="flex items-center gap-1">
                  <User size={12} />
                  {notice.CREATE_USER_NAME} (Processor)
                </span>

                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  Sent: {moment(notice.CREATE_DATE).format("YYYY-MM-DD HH:mm")}
                </span>
              </div>
            </div>

            <span
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${sensitivityBadgeClass(
                notice.SENSITIVITY_CLASSIFICATION,
              )}`}
            >
              <AlertTriangle size={12} />
              {notice.SENSITIVITY_CLASSIFICATION}
            </span>
          </div>

          {/* WARNING – shown when sensitivity is High or CJIS, text from API */}
          {(notice.SENSITIVITY_CLASSIFICATION === "High" ||
            notice.SENSITIVITY_CLASSIFICATION === "CJIS") && (
            <div className="border border-red-300 bg-red-50 rounded-lg p-4 mb-4 flex gap-2">
              <AlertTriangle className="text-red-600" size={18} />

              <div>
                <p className="text-red-700 text-sm font-medium">
                  Classified Content Warning
                </p>

                <p className="text-red-600 text-sm">
                  This notice contains {notice.SENSITIVITY_CLASSIFICATION}{" "}
                  sensitivity information. All access is logged. Do not share or
                  distribute without proper authorization.
                </p>
              </div>
            </div>
          )}

          {/* NOTICE BODY */}
          <div className="bg-gray-100 border rounded-lg p-4 text-sm text-gray-700">
            <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(notice.NOTICE_BODY) }} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 border-t pt-6 mt-6">
            {/* Total Recipients – from API */}
            <div className="flex flex-col items-center sm:items-start">
              <p className="text-xs text-gray-500">Total Recipients</p>
              <p className="text-xl font-semibold">
                {notice.RECIPIENTS_COUNT ?? 0}
              </p>
            </div>

            {/* Responses Received – from API */}
            <div className="flex flex-col items-center sm:items-start">
              <p className="text-xs text-gray-500">Responses Received</p>
              <p className="text-xl font-semibold text-blue-600">
                {notice.RESPONSES_COUNT ?? 0}
              </p>
            </div>

            {/* Total Attachments – static UI */}
            <div className="flex flex-col items-center sm:items-start">
              <p className="text-xs text-gray-500">Total Attachments</p>
              <p className="text-xl font-semibold text-purple-600">
                {notice.TOTAL_ATTACHMENTS ?? 0}
              </p>
              <p className="text-xs text-gray-400">from responses</p>
            </div>
          </div>
        </div>

        {/* RECIPIENT RESPONSES – list from API; Attachments block static per card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">
            Recipient Responses (
            {notice.RESPONSES_COUNT ?? notice.RESPONSES?.length ?? 0})
          </h2>

          {(notice.RESPONSES?.length ?? 0) === 0 ? (
            <p className="text-sm text-gray-500 py-4">No responses yet.</p>
          ) : (
            <div className="space-y-6">
              {(notice.RESPONSES ?? []).map((resp) => (
                <div
                  key={resp.RESPONSE_MY_NOTICE_ID}
                  className="border rounded-xl p-4 sm:p-5 bg-gray-50"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                        <User size={18} />
                      </div>

                      <div>
                        <p className="text-sm font-semibold">
                          {resp.USER?.FIRST_NAME ?? "—"}
                        </p>

                        <p className="text-xs text-gray-500">
                          {resp.USER?.EMAIL ?? "—"}
                        </p>

                        <p className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                          <Clock size={12} />
                          {resp.CREATE_DATE
                            ? moment(resp.CREATE_DATE).format(
                                "YYYY-MM-DD HH:mm",
                              )
                            : "—"}
                        </p>
                      </div>
                    </div>

                    <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full">
                      <CheckCircle size={14} />
                      Acknowledged
                    </span>
                  </div>

                  <div className="bg-gray-200 rounded-md p-3 text-sm text-gray-700 mt-4">
                    {resp.RESPONSE_TEXT ?? "—"}
                  </div>

                  {/* Attachments section – from API */}
                  <div className="mt-4">
                    <p className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                      <Paperclip size={14} />
                      Attachments ({resp.ATTACHMENT ? 1 : 0})
                    </p>

                    {resp.ATTACHMENT && (
                      <div className="flex items-center justify-between border border-purple-300 bg-purple-50 rounded-lg px-3 py-3 w-full sm:w-1/2">
                        <div className="flex items-center gap-3">
                          <div className="text-purple-600">
                            <FileText size={18} />
                          </div>

                          <div>
                            <p className="text-sm font-medium">
                              {resp.ATTACHMENT.FILE_NAME}
                            </p>

                            <p className="text-xs text-gray-500">
                              {resp.CREATE_DATE
                                ? moment(resp.CREATE_DATE).format(
                                    "YYYY-MM-DD HH:mm",
                                  )
                                : "—"}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            MyNoticesService.handleAttachmentDownload(
                              resp.ATTACHMENT!,
                            )
                          }
                          className="border border-gray-300 rounded-md p-2 bg-white hover:bg-gray-100"
                          title="Download"
                        >
                          <Download size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SUBMIT RESPONSE */}
        <form
          className="bg-white rounded-lg border border-gray-300 shadow-sm p-6"
          onSubmit={responseForm.handleSubmit}
        >
          <h3 className="text-lg font-semibold flex gap-2 items-center mb-4">
            <MessageSquare size={18} />
            Submit Response
          </h3>

          <div>
            <textarea
              name="response"
              rows={4}
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
            {(responseForm.touched.response || responseForm.submitCount > 0) &&
              responseForm.errors.response && (
                <p className="mt-1 text-sm text-red-600" role="alert">
                  {responseForm.errors.response}
                </p>
              )}
          </div>

          <input
            type="file"
            className="mt-4"
            onChange={(e) =>
              responseForm.setFieldValue(
                "attachment",
                e.target.files?.[0] ?? null,
              )
            }
          />

          <button
            type="submit"
            disabled={responseForm.isSubmitting}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <MessageSquare size={16} />
            {responseForm.isSubmitting ? "Submitting…" : "Submit Response"}
          </button>
        </form>
      </div>
    </div>
  );
}

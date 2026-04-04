import { Send, Save } from "lucide-react";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import CommonEditor from "../components/CommonEditor";
import { useState, useEffect, useMemo } from "react";
import userService from "../services/userService";
import Swal from "sweetalert2";
import MyNoticesService, {
  CreateNoticePayload,
  Notice,
} from "../services/mynotices";
import Select, { MultiValue } from "react-select";

const NoticeSchema = Yup.object().shape({
  title: Yup.string().required("Notice title is required"),
  classification: Yup.string().required(
    "Sensitivity Classification is required",
  ),
  distribution: Yup.string().required("DistribType type is required"),
  recipients: Yup.array()
    .min(1, "At least one recipient is required")
    .required("Recipients required"),
  noticeBody: Yup.string()
    .min(10, "Notice body must be at least 10 characters")
    .required("Notice body is required"),
});

const defaultInitialValues = {
  title: "",
  classification: "Low",
  distribution: "Internal Only",
  recipients: [] as number[],
  noticeBody: "",
};

type UserOption = {
  value: number;
  label: string;
  name: string;
  email: string;
};

interface CreateNoticeProps {
  modalMode?: boolean;
  editNoticeId?: number;
  onClose?: () => void;
  onSuccess?: () => void;
}

export default function CreateNotice({
  modalMode = false,
  editNoticeId: editNoticeIdProp,
  onClose,
  onSuccess,
}: CreateNoticeProps = {}) {
  const navigate = useNavigate();
  const { id: paramId } = useParams<{ id: string }>();
  const location = useLocation();

  const stateId = (location.state as { editNoticeId?: number } | null)
    ?.editNoticeId;

  const numParam = paramId ? Number(paramId) : undefined;

  const editNoticeId = modalMode
    ? editNoticeIdProp
    : (numParam != null && !Number.isNaN(numParam) ? numParam : stateId);

  const [users, setUsers] = useState<{ id: number; name: string; email: string }[]>([]);
  const [sendNotice, setSendNotice] = useState(false);
  const [noticeData, setNoticeData] = useState<Notice | null>(null);
  const [loadingNotice, setLoadingNotice] = useState(false);

  const fetchUsers = async () => {
    try {
      const allUser = await userService.getUsers();
      const mapped = (allUser || []).map((u) => ({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`.trim(),
        email: u.email,
      }));
      setUsers(mapped);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (!editNoticeId) {
      setNoticeData(null);
      return;
    }

    let cancelled = false;

    setLoadingNotice(true);

    MyNoticesService.getNoticeById(editNoticeId)
      .then((notice) => {
        if (!cancelled && notice) {
          setNoticeData(notice);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingNotice(false);
      });

    return () => {
      cancelled = true;
    };
  }, [editNoticeId]);

  const initialValues = useMemo(() => {
    if (!noticeData) return defaultInitialValues;

    const recipientIds =
      noticeData.RECIPIENTS?.map((r: { USER_ID: number }) => r.USER_ID) ?? [];

    return {
      title: noticeData.NOTICE_TITLE ?? "",
      classification:
        noticeData.SENSITIVITY_CLASSIFICATION ??
        defaultInitialValues.classification,
      distribution:
        noticeData.DISTRIBUTION_TYPE ?? defaultInitialValues.distribution,
      recipients: recipientIds,
      noticeBody: noticeData.NOTICE_BODY ?? "",
    };
  }, [noticeData]);

  const isEditMode = editNoticeId != null;

  const userOptions = users.map((user) => ({
    value: user.id,
    label: `${user.name} (${user.email})`,
    name: user.name,
    email: user.email,
  }));

  return (
    <div className={modalMode ? "" : "min-h-screen bg-gray-100 flex justify-center p-6"}>
      <div className={modalMode ? "" : "w-full max-w-4xl bg-white rounded-2xl shadow-sm border border-gray-200 p-8"}>
        {!modalMode && (
          <>
            <h1 className="text-xl font-semibold text-gray-800">
              {isEditMode ? "Edit Notice" : "Create New Notice"}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {isEditMode
                ? "Update the notice and save or send."
                : "Draft and distribute notices to workspace members with CJS compliance"}
            </p>
          </>
        )}

        {isEditMode && loadingNotice ? (
          <p className="text-sm text-gray-500 mt-2">Loading notice...</p>
        ) : (
          <Formik
            key={isEditMode ? `edit-${editNoticeId}` : "create"}
            initialValues={initialValues}
            enableReinitialize
            validationSchema={NoticeSchema}
            onSubmit={async (values, { resetForm }) => {
              try {
                const payload = {
                  NOTICE_TITLE: values.title,
                  SENSITIVITY_CLASSIFICATION: values.classification,
                  DISTRIBUTION_TYPE: values.distribution,
                  BUTTON_STATUS: sendNotice ? "Sent" : "Draft",
                  RECIPIENTS: values.recipients,
                  NOTICE_BODY: values.noticeBody,
                  SEND_NOTICE: sendNotice,
                };

                if (isEditMode && editNoticeId != null) {
                  await MyNoticesService.updateNotice(
                    editNoticeId,
                    payload as CreateNoticePayload,
                  );

                  await Swal.fire({
                    icon: "success",
                    title: sendNotice ? "Notice Sent" : "Draft Updated",
                    text: sendNotice
                      ? "Notice has been sent successfully."
                      : "Notice updated successfully.",
                    confirmButtonColor: "#2563eb",
                  });

                  if (modalMode) {
                    onSuccess?.();
                  } else {
                    navigate("/my-notices");
                  }
                } else {
                  await MyNoticesService.createNotice(
                    payload as CreateNoticePayload,
                  );

                  await Swal.fire({
                    icon: "success",
                    title: sendNotice ? "Notice Sent" : "Draft Saved",
                    text: sendNotice
                      ? "Notice has been sent successfully."
                      : "Notice saved as draft successfully.",
                    confirmButtonColor: "#2563eb",
                  });

                  if (modalMode) {
                    onSuccess?.();
                  }
                }

                resetForm();
              } catch (error) {
                console.error("Create/update notice error:", error);

                Swal.fire({
                  icon: "error",
                  title: "Error",
                  text:
                    (error as { response?: { data?: { message?: string } } })
                      ?.response?.data?.message ||
                    "Something went wrong while saving the notice.",
                  confirmButtonColor: "#d33",
                });
              }
            }}
          >
            {({ values, setFieldValue }) => (
              <Form className="mt-4 space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notice Title *
                  </label>

                  <Field
                    name="title"
                    type="text"
                    placeholder="Enter notice title"
                    className="w-full h-10 border border-gray-300 rounded-lg px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  <ErrorMessage
                    name="title"
                    component="p"
                    className="text-xs text-red-500 mt-1"
                  />
                </div>

                {/* Classification + Distribution - side by side */}
                <div className="d-flex gap-3" style={{ flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 0', minWidth: '200px' }}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sensitivity Classification *
                    </label>
                    <Field
                      as="select"
                      name="classification"
                      className="h-10 w-full border border-gray-300 rounded-lg px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option>Low</option>
                      <option>Medium</option>
                      <option>High</option>
                      <option>CJIS</option>
                    </Field>
                  </div>

                  <div style={{ flex: '1 1 0', minWidth: '200px' }}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Distribution Type *
                    </label>
                    <Field
                      as="select"
                      name="distribution"
                      className="h-10 w-full border border-gray-300 rounded-lg px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option>Internal Only</option>
                      <option>External Only</option>
                      <option>Mixed (Internal + External)</option>
                    </Field>
                  </div>
                </div>

                {/* Recipients */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Recipients *
                  </label>

                  <Select<UserOption, true>
                    isMulti
                    options={userOptions}
                    value={userOptions.filter((opt) =>
                      values.recipients.includes(opt.value),
                    )}
                    onChange={(selected: MultiValue<UserOption>) => {
                      const ids = selected.map((item) => item.value);
                      setFieldValue("recipients", ids);
                    }}
                    placeholder="Search recipients by name or email..."
                    className="text-sm"
                    filterOption={(option, inputValue) => {
                      const search = inputValue.toLowerCase();
                      const name = option.data.name?.toLowerCase() || "";
                      const email = option.data.email?.toLowerCase() || "";

                      return name.includes(search) || email.includes(search);
                    }}
                    styles={{
                      control: (base) => ({
                        ...base,
                        cursor: "pointer",
                        minHeight: "40px",
                        borderRadius: "8px",
                      }),
                      option: (base) => ({
                        ...base,
                        cursor: "pointer",
                      }),
                      multiValue: (base) => ({
                        ...base,
                        cursor: "pointer",
                      }),
                    }}
                  />

                  <ErrorMessage
                    name="recipients"
                    component="p"
                    className="text-xs text-red-500 mt-1"
                  />
                </div>

                {/* Notice Body */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notice Body *
                  </label>

                  <CommonEditor
                    value={values.noticeBody}
                    onChange={(content) => setFieldValue("noticeBody", content)}
                  />

                  <ErrorMessage
                    name="noticeBody"
                    component="p"
                    className="text-xs text-red-500 mt-1"
                  />
                </div>

                {/* Footer */}
                <div className="mt-4 flex flex-col gap-3 lg:flex-row md:justify-between md:items-center">
                  <div className="text-xs text-gray-500 md:flex md:flex-col">
                    <p>* Required fields</p>
                    <p>All actions are logged for CJS audit compliance</p>
                  </div>

                  <div className="flex flex-col gap-3 md:flex-row">
                    <button
                      type="submit"
                      onClick={() => setSendNotice(false)}
                      className="flex items-center gap-2 border border-gray-300 px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 md:whitespace-nowrap"
                    >
                      <Save size={16} />
                      Save Draft
                    </button>

                    <button
                      type="submit"
                      onClick={() => setSendNotice(true)}
                      className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 md:whitespace-nowrap"
                    >
                      <Send size={16} />
                      Send Notice
                    </button>
                  </div>
                </div>
              </Form>
            )}
          </Formik>
        )}
      </div>
    </div>
  );
}

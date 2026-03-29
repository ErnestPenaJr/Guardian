import axios from "axios";
import api from "../utils/api";

export type SensitivityLevel = "CJIS" | "Medium" | "High" | "Low";

export type NoticeStatus = "Sent" | "Draft";

type DistributionType =
  | "Internal Only"
  | "External Only"
  | "Mixed (Internal + External)";

/** Common user structure used across notice objects */
export interface NoticeUser {
  FIRST_NAME: string;
  USER_ID?: number;
  EMAIL?: string;
}

/** User who created the notice */
export type CreateUser = NoticeUser;

/** Notice recipient */
export interface NoticeRecipient {
  NOTICE_RECIPIENT_ID: number;
  NOTICE_ID: number;
  USER_ID: number;
  USER: NoticeUser;
}

/** Attachment on a response (from GET notice by id) */
export interface NoticeResponseAttachment {
  ATTACHMENT_ID: number;
  FILE_NAME: string;
  downloadUrl: string;
}

/** Notice response */
export interface NoticeResponse {
  RESPONSE_MY_NOTICE_ID: number;
  CREATE_DATE: string;
  RESPONSE_TEXT: string;
  USER: NoticeUser;
  ATTACHMENT?: NoticeResponseAttachment | null;
}

/** Main Notice model */
export interface Notice {
  NOTICE_ID: number;
  NOTICE_TITLE: string;

  SENSITIVITY_CLASSIFICATION: SensitivityLevel;
  BUTTON_STATUS: NoticeStatus;
  DISTRIBUTION_TYPE: DistributionType;

  NOTICE_BODY: string;

  CREATE_USER_ID: number;
  UPDATE_USER_ID: number | null;

  CREATE_DATE: string;
  UPDATE_DATE: string;

  CREATE_USER: CreateUser;
  CREATE_USER_NAME: string;

  RECIPIENTS: NoticeRecipient[];
  RECIPIENTS_COUNT: number;

  RESPONSES: NoticeResponse[];
  RESPONSES_COUNT: number;
  TOTAL_ATTACHMENTS: number;

  /** Optional response submitted by logged-in user */
  RESPONSE?: string | null;

  /** Stored attachment filename/path */
  ATTACHMENT?: string | null;

  /** Generated download URL for attachment */
  attachmentUrl?: string | null;
}

export interface NoticesSummary {
  RECIPIENTS_COUNT: number;
  RESPONSES_COUNT: number;
  TOTAL_ATTACHMENTS: number;
  NOTICES_WITH_RESPONSES: number;
  TOTAL_NOTICES: number;
}

/** API response when fetching notices (list with pagination) */
export interface NoticesListResponse {
  data: Notice[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  summary: NoticesSummary;
}

/** Payload for creating notice */
export interface CreateNoticePayload {
  NOTICE_TITLE: string;
  SENSITIVITY_CLASSIFICATION: SensitivityLevel;
  DISTRIBUTION_TYPE: DistributionType;
  BUTTON_STATUS: NoticeStatus;
  RECIPIENTS: number[];
  NOTICE_BODY: string;
  SEND_NOTICE: boolean;
}
const MyNoticesService = {
  getMyNotices: async (filters?: {
    search?: string;
    status?: string;
    sensitivity?: string;
    page?: number;
    limit?: number;
  }): Promise<NoticesListResponse> => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        console.warn("No authentication token found");
        return {
          data: [],
          summary: {
            RECIPIENTS_COUNT: 0,
            RESPONSES_COUNT: 0,
            TOTAL_ATTACHMENTS: 0,
            NOTICES_WITH_RESPONSES: 0,
            TOTAL_NOTICES: 0,
          },
          pagination: { total: 0, page: 1, limit: 10, totalPages: 0 },
        };
      }

      const response = await axios.get("/api/my-notices", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          search: filters?.search,
          status: filters?.status,
          sensitivity: filters?.sensitivity,
          page: filters?.page ?? 1,
          limit: filters?.limit ?? 10,
        },
      });

      const payload = response.data;
      const data = Array.isArray(payload?.data) ? payload.data : [];
      const summary = payload?.summary ?? {
        RECIPIENTS_COUNT: 0,
        RESPONSES_COUNT: 0,
        TOTAL_ATTACHMENTS: 0,
        NOTICES_WITH_RESPONSES: 0,
        TOTAL_NOTICES: 0,
      };
      const pagination = payload?.pagination ?? {
        total: data.length,
        page: 1,
        limit: filters?.limit ?? 10,
        totalPages: 1,
      };
      return { data, pagination, summary };
    } catch (error) {
      console.error("Error fetching my notices:", error);
      return {
        data: [],
        summary: {
          RECIPIENTS_COUNT: 0,
          RESPONSES_COUNT: 0,
          TOTAL_ATTACHMENTS: 0,
          NOTICES_WITH_RESPONSES: 0,
          TOTAL_NOTICES: 0,
        },
        pagination: { total: 0, page: 1, limit: 10, totalPages: 0 },
      };
    }
  },

  getNoticeById: async (id: number): Promise<Notice | null> => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return null;
      const response = await axios.get(`/api/my-notices/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data ?? null;
    } catch (error) {
      console.error("Error fetching notice by id:", error);
      return null;
    }
  },

  createNotice: async (noticeData: CreateNoticePayload): Promise<void> => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        console.warn("No authentication token found");
        return;
      }

      await axios.post("/api/my-notices", noticeData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (error) {
      console.error("Error creating my-notice:", error);
      throw error;
    }
  },

  updateNotice: async (
    id: number,
    noticeData: CreateNoticePayload,
  ): Promise<void> => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.warn("No authentication token found");
        return;
      }
      await axios.put(`/api/my-notices/${id}`, noticeData, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      console.error("Error updating notice:", error);
      throw error;
    }
  },

  deleteNotice: async (id: number): Promise<void> => {
    const token = localStorage.getItem("token");
    if (!token) throw new Error("Not authenticated");
    await axios.delete(`/api/my-notices/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  /** PATCH /my-notices/:id – submit response (required) and optional attachment(s). */
  submitNoticeResponse: async (
    noticeId: number,
    response: string,
    attachment?: File | null,
  ): Promise<{
    message: string;
    responseId: number;
    attachments: number[];
  }> => {
    const token = localStorage.getItem("token");
    if (!token) throw new Error("Not authenticated");
    const formData = new FormData();
    formData.append("response", response);
    if (attachment) formData.append("attachment", attachment);
    const res = await axios.patch(`/api/my-notices/${noticeId}`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "multipart/form-data",
      },
    });
    return res.data;
  },

  downloadCSVDashboard: async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await axios.get("/api/my-notices/export-csv", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        responseType: "blob", // important for file download
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");

      link.href = url;
      link.setAttribute("download", "notice-delivery-details.csv");
      document.body.appendChild(link);
      link.click();

      link.remove();
    } catch (error) {
      console.error("CSV download error downloadCSVDashboard:", error);
    }
  },

  downloadSingleNoticeCSV: async (id: number) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const response = await axios.get(`/api/my-notices/export-csv/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `notice_${id}_details.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (error) {
      console.error("CSV download error downloadSingleNoticeCSV:", error);
    }
  },

  handleAttachmentDownload: async (att: NoticeResponseAttachment) => {
    try {
      if (!att?.downloadUrl || !att?.FILE_NAME) return;

      const res = await api.get(att.downloadUrl, {
        responseType: "blob",
      });

      // Preserve blob type from response Content-Type so images download as image/*, not .txt
      const contentType =
        (res.headers["content-type"] as string) || "application/octet-stream";
      const blob =
        res.data instanceof Blob
          ? new Blob([res.data], { type: contentType })
          : new Blob([res.data], { type: contentType });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = att.FILE_NAME || "attachment";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed handleAttachmentDownload:", err);
    }
  },
};

export default MyNoticesService;

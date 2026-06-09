import express from "express";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { Resend } from "resend";
import multer from "multer";
import { canCreateNotice } from "../middleware/canCreateNotice.js";
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf', 'image/jpeg', 'image/png', 'image/gif',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'text/csv'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, images, Word, Excel, and text files are allowed.'));
    }
  }
});
import { Parser } from "json2csv";

const router = express.Router();
import prisma from "../prisma-client.js";

/** Strip dangerous HTML tags (script, iframe, object, embed, form) from notice body before emailing */
function sanitizeHtmlForEmail(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^>]*>.*?<\/iframe>/gi, "")
    .replace(/<object\b[^>]*>.*?<\/object>/gi, "")
    .replace(/<embed\b[^>]*\/?>/gi, "")
    .replace(/<form\b[^>]*>.*?<\/form>/gi, "")
    .replace(/on\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/on\w+\s*=\s*'[^']*'/gi, "");
}
// RESEND_API_KEY is the canonical name; SMTP_PASSWORD is the legacy alias (see .env.example)
const RESEND_API_KEY = process.env.RESEND_API_KEY || process.env.SMTP_PASSWORD;
const EMAIL_FROM = process.env.EMAIL_FROM || "support@shieldlytics.com";
const resend = new Resend(RESEND_API_KEY);
const NoticeSchema = z.object({
  NOTICE_TITLE: z.string().min(1, "Notice title is required"),
  SENSITIVITY_CLASSIFICATION: z
    .string()
    .min(1, "Sensitivity classification is required"),
  BUTTON_STATUS: z.string().min(1, "Button status is required"),
  DISTRIBUTION_TYPE: z.string().min(1, "Distribution type is required"),
  RECIPIENTS: z.array(z.number()), // array of user IDs
  NOTICE_BODY: z.string().min(1, "Notice body is required"),
  SEND_NOTICE: z.boolean().optional(),
});

router.get("/export-csv", requireAuth, async (req, res) => {
  try {
    const companyId = (req.user as any).COMPANY_ID;
    const notices = await prisma.mY_NOTICES.findMany({
      where: { COMPANY_ID: companyId },
      include: {
        RECIPIENTS: true,
        RESPONSES: {
          include: {
            ATTACHMENT: true,
          },
        },
      },
      orderBy: { CREATE_DATE: "desc" },
    });

    const data = notices.map((notice) => {
      const totalAttachments = notice.RESPONSES.reduce(
        (count: number, resp: { ATTACHMENT: unknown }) => (resp.ATTACHMENT ? count + 1 : count),
        0,
      );

      return {
        Notice: notice.NOTICE_TITLE,
        Sensitivity: notice.SENSITIVITY_CLASSIFICATION,
        Sent: notice.CREATE_DATE,
        Recipients: notice.RECIPIENTS.length,
        Responses: notice.RESPONSES.length,
        Attachments: totalAttachments,
        Status: notice.BUTTON_STATUS,
      };
    });

    // TOTALS
    const RECIPIENTS_COUNT = data.reduce((sum, row) => sum + row.Recipients, 0);
    const RESPONSES_COUNT = data.reduce((sum, row) => sum + row.Responses, 0);
    const TOTAL_ATTACHMENTS = data.reduce(
      (sum, row) => sum + row.Attachments,
      0,
    );

    // Add totals row
    data.push({
      Notice: "TOTAL",
      Sensitivity: "",
      Sent: new Date(),
      Recipients: RECIPIENTS_COUNT,
      Responses: RESPONSES_COUNT,
      Attachments: TOTAL_ATTACHMENTS,
      Status: "",
    });

    const fields = [
      "Notice",
      "Sensitivity",
      "Sent",
      "Recipients",
      "Responses",
      "Attachments",
      "Status",
    ];

    const parser = new Parser({ fields });
    const csv = parser.parse(data);

    res.header("Content-Type", "text/csv");
    res.attachment("notice-delivery-details.csv");

    return res.send(csv);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "CSV export failed" });
  }
});

router.get("/export-csv/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: "Invalid notice id 1" });
    }

    const companyId = (req.user as any).COMPANY_ID;
    const notice = await prisma.mY_NOTICES.findUnique({
      where: { NOTICE_ID: id },
      include: {
        CREATE_USER: { select: { FIRST_NAME: true, COMPANY_ID: true } },
        RECIPIENTS: { include: { USER: { select: { FIRST_NAME: true } } } },
        RESPONSES: {
          include: {
            USER: { select: { FIRST_NAME: true, EMAIL: true } },
            ATTACHMENT: { select: { ATTACHMENT_ID: true, FILE_NAME: true } },
          },
        },
      },
    });

    if (!notice) return res.status(404).json({ error: "Notice not found" });
    if (notice.COMPANY_ID !== companyId) return res.status(403).json({ error: "Access denied" });

    // Calculate totals
    const totalAttachments = notice.RESPONSES.reduce(
      (count: number, resp: { ATTACHMENT: unknown }) => (resp.ATTACHMENT ? count + 1 : count),
      0,
    );

    // Flatten notice main info + recipients count + responses count
    const noticeInfo = {
      Notice_ID: notice.NOTICE_ID,
      Title: notice.NOTICE_TITLE,
      Sensitivity: notice.SENSITIVITY_CLASSIFICATION,
      Status: notice.BUTTON_STATUS,
      Distribution: notice.DISTRIBUTION_TYPE,
      Created_By: notice.CREATE_USER?.FIRST_NAME || "Unknown",
      Created_At: notice.CREATE_DATE.toISOString(),
      Recipients_Count: notice.RECIPIENTS.length,
      Responses_Count: notice.RESPONSES.length,
      Total_Attachments: totalAttachments,
    };

    // Prepare response details for CSV, one row per response
    // If no responses, send one row with empty response details
    const responseRows =
      notice.RESPONSES.length > 0
        ? notice.RESPONSES.map((resp) => ({
            ...noticeInfo,
            Response_ID: resp.RESPONSE_MY_NOTICE_ID,
            Response_Text: resp.RESPONSE_TEXT || "",
            Response_Date: resp.CREATE_DATE.toISOString(),
            Response_User: resp.USER?.FIRST_NAME || "",
            Attachment_FileName: resp.ATTACHMENT?.FILE_NAME || "",
          }))
        : [
            {
              ...noticeInfo,
              Response_ID: "",
              Response_Text: "",
              Response_Date: "",
              Response_User: "",
              Attachment_FileName: "",
            },
          ];

    const fields = [
      "Notice_ID",
      "Title",
      "Sensitivity",
      "Status",
      "Distribution",
      "Created_By",
      "Created_At",
      "Recipients_Count",
      "Responses_Count",
      "Total_Attachments",
      "Response_ID",
      "Response_Text",
      "Response_Date",
      "Response_User",
      "Attachment_FileName",
    ];

    const parser = new Parser({ fields });
    const csv = parser.parse(responseRows);

    res.header("Content-Type", "text/csv");
    res.attachment(`notice_${id}_details.csv`);

    return res.send(csv);
  } catch (error) {
    console.error("CSV export error:", error);
    res.status(500).json({ error: "Failed to export CSV" });
  }
});

router.get("/", requireAuth, async (req, res) => {
  try {
    const {
      search,
      status,
      sensitivity,
      distribution,
      page = "1",
      limit = "10",
    } = req.query;

    const pageNumber = Math.max(1, parseInt(String(page), 10) || 1);
    const rawLimit = parseInt(String(limit), 10) || 10;
    const pageSize = Math.min(100, Math.max(1, rawLimit));
    const skip = (pageNumber - 1) * pageSize;

    /* ---------- FILTER ---------- */
    const companyId = (req.user as any).COMPANY_ID;
    const whereCondition = {
      AND: [
        { CREATE_USER: { COMPANY_ID: companyId } },
        search ? { NOTICE_TITLE: { contains: String(search) } } : {},
        status && status !== "All" ? { BUTTON_STATUS: String(status) } : {},
        sensitivity && sensitivity !== "All"
          ? { SENSITIVITY_CLASSIFICATION: String(sensitivity) }
          : {},
        distribution && distribution !== "All"
          ? { DISTRIBUTION_TYPE: String(distribution) }
          : {},
      ],
    };

    /* ---------- DB CALLS ---------- */
    const [notices, total, recipientCount, responseCount, attachmentCount, noticesWithResponses] = await Promise.all([
      // ✅ PAGINATED DATA (for UI)
      prisma.mY_NOTICES.findMany({
        where: whereCondition,
        include: {
          CREATE_USER: { select: { FIRST_NAME: true } },
          RECIPIENTS: {
            include: { USER: { select: { FIRST_NAME: true } } },
          },
          RESPONSES: {
            include: {
              USER: {
                select: {
                  FIRST_NAME: true,
                  EMAIL: true,
                },
              },
              ATTACHMENT: {
                select: {
                  ATTACHMENT_ID: true,
                  FILE_NAME: true,
                },
              },
            },
          },
        },
        orderBy: { CREATE_DATE: "desc" },
        skip,
        take: pageSize,
      }),

      // ✅ TOTAL COUNT (pagination)
      prisma.mY_NOTICES.count({
        where: whereCondition,
      }),

      // ✅ SUMMARY COUNTS (efficient aggregation instead of loading all data)
      prisma.mY_NOTICE_RECIPIENTS.count({
        where: { MY_NOTICE: { ...whereCondition } },
      }),
      prisma.rESPONSE_MY_NOTICE.count({
        where: { MY_NOTICE: { ...whereCondition } },
      }),
      prisma.rESPONSE_MY_NOTICE.count({
        where: { MY_NOTICE: { ...whereCondition }, ATTACHMENT_ID: { not: null } },
      }),
      prisma.mY_NOTICES.count({
        where: { ...whereCondition, RESPONSES: { some: {} } },
      }),
    ]);

    /* ---------- FORMAT PAGINATED DATA ---------- */
    const formattedNotices = notices.map((notice) => {
      const totalAttachments = notice.RESPONSES.reduce(
        (count: number, resp: { ATTACHMENT: unknown }) => (resp.ATTACHMENT ? count + 1 : count),
        0,
      );

      return {
        ...notice,
        CREATE_USER_NAME: notice.CREATE_USER?.FIRST_NAME || null,
        RECIPIENTS_COUNT: notice.RECIPIENTS.length,
        RESPONSES_COUNT: notice.RESPONSES.length,
        TOTAL_ATTACHMENTS: totalAttachments,

        RESPONSES: notice.RESPONSES.map((resp) => ({
          RESPONSE_MY_NOTICE_ID: resp.RESPONSE_MY_NOTICE_ID,
          CREATE_DATE: resp.CREATE_DATE,
          USER: resp.USER,
          ATTACHMENT: resp.ATTACHMENT
            ? {
                ATTACHMENT_ID: resp.ATTACHMENT.ATTACHMENT_ID,
                FILE_NAME: resp.ATTACHMENT.FILE_NAME,
                downloadUrl: `/api/attachments/${resp.ATTACHMENT.ATTACHMENT_ID}/download`,
              }
            : null,
        })),
      };
    });

    /* ---------- SUMMARY FROM AGGREGATION ---------- */
    const summary = {
      RECIPIENTS_COUNT: recipientCount,
      RESPONSES_COUNT: responseCount,
      TOTAL_ATTACHMENTS: attachmentCount,
      NOTICES_WITH_RESPONSES: noticesWithResponses,
      TOTAL_NOTICES: total,
    };

    /* ---------- RESPONSE ---------- */
    res.json({
      data: formattedNotices,
      summary,
      pagination: {
        total,
        page: pageNumber,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error: any) {
    console.error("Error fetching notices:", error);
    res.status(500).json({
      error: "Failed to fetch notices",
      details: error?.message || String(error),
    });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: "Invalid notice id" });
    }

    // Fetch notice with recipients and responses
    const notice = await prisma.mY_NOTICES.findUnique({
      where: { NOTICE_ID: id },
      include: {
        CREATE_USER: { select: { FIRST_NAME: true, COMPANY_ID: true } }, // creator
        RECIPIENTS: { include: { USER: { select: { FIRST_NAME: true } } } },
        RESPONSES: {
          include: {
            USER: { select: { FIRST_NAME: true, EMAIL: true } },
            ATTACHMENT: { select: { ATTACHMENT_ID: true, FILE_NAME: true } },
          },
        },
      },
    });

    if (!notice) return res.status(404).json({ error: "Notice not found" });
    if (notice.COMPANY_ID !== (req.user as any).COMPANY_ID) return res.status(403).json({ error: "Access denied" });
    const totalAttachments = notice.RESPONSES?.reduce((count: number, resp: { ATTACHMENT: unknown }) => {
      return count + (resp.ATTACHMENT ? 1 : 0);
    }, 0);
    // Format response safely
    const formattedNotice = {
      ...notice,
      CREATE_USER_NAME: notice.CREATE_USER?.FIRST_NAME || null,
      RECIPIENTS_COUNT: notice.RECIPIENTS?.length ?? 0,
      RESPONSES_COUNT: notice.RESPONSES?.length ?? 0,
      TOTAL_ATTACHMENTS: totalAttachments,
      RESPONSES:
        notice.RESPONSES?.map((resp) => ({
          RESPONSE_MY_NOTICE_ID: resp.RESPONSE_MY_NOTICE_ID,
          RESPONSE_TEXT: resp.RESPONSE_TEXT,
          CREATE_DATE: resp.CREATE_DATE,
          USER: resp.USER,
          ATTACHMENT: resp.ATTACHMENT
            ? {
                ATTACHMENT_ID: resp.ATTACHMENT.ATTACHMENT_ID,
                FILE_NAME: resp.ATTACHMENT.FILE_NAME,
                downloadUrl: `/api/my-notices/attachments/${resp.ATTACHMENT.ATTACHMENT_ID}/download`,
              }
            : null,
        })) ?? [],
    };

    res.json(formattedNotice);
  } catch (error) {
    console.error("Error fetching notice:", error);
    res.status(500).json({ error: "Failed to fetch notice" });
  }
});

router.post("/", requireAuth, canCreateNotice, async (req, res) => {
  try {
    const data = NoticeSchema.parse(req.body);

    const noticeCompanyId = (req.user as any).COMPANY_ID;

    // Validate recipients belong to the same company
    if (data.RECIPIENTS.length > 0) {
      const validRecipients = await prisma.uSERS.findMany({
        where: { USER_ID: { in: data.RECIPIENTS }, COMPANY_ID: noticeCompanyId },
        select: { USER_ID: true },
      });
      const validIds = new Set(validRecipients.map((r) => r.USER_ID));
      const invalidIds = data.RECIPIENTS.filter((id) => !validIds.has(id));
      if (invalidIds.length > 0) {
        return res.status(400).json({
          error: "Some recipients do not belong to your company",
          invalidIds,
        });
      }
    }

    const existingNotice = await prisma.mY_NOTICES.findFirst({
      where: { NOTICE_TITLE: data.NOTICE_TITLE, COMPANY_ID: noticeCompanyId },
    });
    if (existingNotice) {
      return res.status(400).json({
        message: "Notice with this title already exists",
      });
    }

    const notice = await prisma.mY_NOTICES.create({
      data: {
        NOTICE_TITLE: data.NOTICE_TITLE,
        SENSITIVITY_CLASSIFICATION: data.SENSITIVITY_CLASSIFICATION,
        BUTTON_STATUS: data.BUTTON_STATUS,
        DISTRIBUTION_TYPE: data.DISTRIBUTION_TYPE,
        NOTICE_BODY: data.NOTICE_BODY,
        COMPANY_ID: noticeCompanyId,
        CREATE_USER_ID: (req.user as { id?: number })?.id ?? null,
        UPDATE_USER_ID: (req.user as { id?: number })?.id ?? null,
        RECIPIENTS: {
          create: data.RECIPIENTS.map((userId) => ({ USER_ID: userId })),
        },
      },
      include: { RECIPIENTS: true },
    });

    if (data.SEND_NOTICE && data.RECIPIENTS.length > 0) {
      const users = await prisma.uSERS.findMany({
        where: { USER_ID: { in: data.RECIPIENTS } },
        select: { EMAIL: true },
      });
      const emails = users.map((u) => u.EMAIL).filter(Boolean);
      if (emails.length > 0) {
        await resend.emails.send({
          from: EMAIL_FROM,
          to: emails,
          subject: notice.NOTICE_TITLE,
          html: sanitizeHtmlForEmail(notice.NOTICE_BODY || ""),
        });
      }
    }

    res.status(201).json({
      message: "Notice created successfully",
      data: notice,
    });
  } catch (error) {
    console.error("Error creating notice:", error);
    res.status(500).json({ error: "Failed to create notice" });
  }
});

router.put("/:id", requireAuth, canCreateNotice, async (req: any, res: any) => {
  const { id } = req.params;

  try {
    const data = NoticeSchema.parse(req.body);

    const putCompanyId = (req.user as any).COMPANY_ID;
    const existingNoticeForUpdate = await prisma.mY_NOTICES.findUnique({
      where: { NOTICE_ID: parseInt(id) },
      select: { COMPANY_ID: true },
    });
    if (!existingNoticeForUpdate) return res.status(404).json({ error: "Notice not found" });
    if (existingNoticeForUpdate.COMPANY_ID !== putCompanyId) return res.status(403).json({ error: "Access denied" });

    // Update Notice + Recipients
    const updatedNotice = await prisma.mY_NOTICES.update({
      where: {
        NOTICE_ID: parseInt(id),
      },
      data: {
        NOTICE_TITLE: data.NOTICE_TITLE,
        SENSITIVITY_CLASSIFICATION: data.SENSITIVITY_CLASSIFICATION,
        BUTTON_STATUS: data.BUTTON_STATUS,
        DISTRIBUTION_TYPE: data.DISTRIBUTION_TYPE,
        NOTICE_BODY: data.NOTICE_BODY,
        UPDATE_USER_ID: req.user?.id || null,
        UPDATE_DATE: new Date(),

        RECIPIENTS: {
          deleteMany: {}, // remove old recipients
          create: data.RECIPIENTS.map((userId) => ({
            USER_ID: userId,
          })),
        },
      },
      include: {
        RECIPIENTS: true,
      },
    });

    // Send Email (same logic as POST)
    if (data.SEND_NOTICE && data.RECIPIENTS.length > 0) {
      const users = await prisma.uSERS.findMany({
        where: {
          USER_ID: {
            in: data.RECIPIENTS,
          },
        },
        select: {
          EMAIL: true,
        },
      });

      const emails = users.map((u) => u.EMAIL).filter(Boolean);

      if (emails.length > 0) {
        await resend.emails.send({
          from: EMAIL_FROM,
          to: emails,
          subject: updatedNotice.NOTICE_TITLE,
          html: sanitizeHtmlForEmail(updatedNotice.NOTICE_BODY || ""),
        });
      }
    }

    res.json({
      message: "Notice updated successfully",
      data: updatedNotice,
    });
  } catch (error) {
    console.error("Error updating notice:", error);

    res.status(500).json({
      error: "Failed to update notice",
    });
  }
});

router.patch(
  "/:id",
  requireAuth,
  upload.array("attachment"),
  async (req, res) => {
    const noticeId = Number(req.params.id);
    const userId = (req.user as any)?.id || null;

    const responseText =
      typeof req.body?.response === "string" ? req.body.response.trim() : "";

    if (!responseText || responseText.length < 10) {
      return res.status(400).json({
        error: "RESPONSE_TEXT must be at least 10 characters",
      });
    }

    const files = req.files as Express.Multer.File[] | undefined;

    try {
      const patchCompanyId = (req.user as any).COMPANY_ID;
      const patchUserId = (req.user as any).id;

      // Verify notice belongs to user's company (via creator's company)
      const noticeForPatch = await prisma.mY_NOTICES.findFirst({
        where: { NOTICE_ID: noticeId, COMPANY_ID: patchCompanyId },
      });
      if (!noticeForPatch) return res.status(404).json({ error: "Notice not found or access denied" });

      // Verify the authenticated user is a recipient of this notice
      const recipientRecord = await prisma.mY_NOTICE_RECIPIENTS.findFirst({
        where: { NOTICE_ID: noticeId, USER_ID: patchUserId },
      });
      if (!recipientRecord) return res.status(403).json({ error: "You are not a recipient of this notice" });

      // Use a transaction to ensure atomicity
      const result = await prisma.$transaction(async (tx) => {
        // 1️⃣ Create response
        const responseRecord = await tx.rESPONSE_MY_NOTICE.create({
          data: {
            MY_NOTICE_ID: noticeId,
            USER_ID: userId,
            RESPONSE_TEXT: responseText,
            COMPANY_ID: patchCompanyId,
          },
        });

        const attachmentIds: number[] = [];

        // 2️⃣ Store files as attachments
        if (files && files.length > 0) {
          for (const file of files) {
            const attachment = await tx.aTTACHMENTS.create({
              data: {
                REQUEST_ID: noticeId,
                FILE_NAME: file.originalname,
                ATTACHMENT: file.buffer,
                CREATE_USER_ID: userId,
              },
            });

            attachmentIds.push(attachment.ATTACHMENT_ID);
          }

          // 3️⃣ Link the first attachment to the response
          await tx.rESPONSE_MY_NOTICE.update({
            where: {
              RESPONSE_MY_NOTICE_ID: responseRecord.RESPONSE_MY_NOTICE_ID,
            },
            data: {
              ATTACHMENT_ID: attachmentIds[0],
            },
          });
        }

        // 4️⃣ Phase 6 / US-CCL-03 — upgrade the responder's verification status.
        // Treat any response insert as acknowledgement per the MVP plan; this
        // flips the recipient from FIRST_TIME → PREVIOUSLY_VERIFIED for the
        // calling company, so future sends skip the first-time intercept modal.
        if (patchUserId) {
          await tx.rECIPIENT_VERIFICATIONS.upsert({
            where: {
              RECIPIENT_USER_ID_COMPANY_ID: {
                RECIPIENT_USER_ID: patchUserId,
                COMPANY_ID: patchCompanyId,
              },
            },
            update: {
              VERIFIED_STATUS: 'PREVIOUSLY_VERIFIED',
              VERIFIED_AT: new Date(),
            },
            create: {
              RECIPIENT_USER_ID: patchUserId,
              COMPANY_ID: patchCompanyId,
              VERIFIED_STATUS: 'PREVIOUSLY_VERIFIED',
              VERIFIED_AT: new Date(),
              FIRST_NOTICE_ID: noticeId,
            },
          });
        }

        return {
          responseRecord,
          attachmentIds,
        };
      });

      res.json({
        message: "Response saved successfully",
        responseId: result.responseRecord.RESPONSE_MY_NOTICE_ID,
        attachments: result.attachmentIds,
      });
    } catch (error) {
      console.error("Error saving response:", error);
      res.status(500).json({ error: "Failed to save response" });
    }
  },
);

// DELETE /my-notices/:id — delete a draft notice (only drafts can be deleted)
router.delete("/:id", requireAuth, canCreateNotice, async (req, res) => {
  try {
    const noticeId = Number(req.params.id);
    if (!noticeId || isNaN(noticeId)) {
      return res.status(400).json({ error: "Invalid notice ID" });
    }

    const companyId = (req.user as any).COMPANY_ID;
    const notice = await prisma.mY_NOTICES.findUnique({
      where: { NOTICE_ID: noticeId },
    });

    if (!notice) return res.status(404).json({ error: "Notice not found" });
    if (notice.COMPANY_ID !== companyId) return res.status(403).json({ error: "Access denied" });
    if (notice.BUTTON_STATUS === "Sent") {
      return res.status(400).json({ error: "Cannot delete a sent notice" });
    }

    // Delete recipients first (FK constraint), then the notice
    await prisma.mY_NOTICE_RECIPIENTS.deleteMany({ where: { NOTICE_ID: noticeId } });
    await prisma.rESPONSE_MY_NOTICE.deleteMany({ where: { MY_NOTICE_ID: noticeId } });
    await prisma.mY_NOTICES.delete({ where: { NOTICE_ID: noticeId } });

    res.json({ message: "Notice deleted successfully" });
  } catch (error) {
    console.error("Error deleting notice:", error);
    res.status(500).json({ error: "Failed to delete notice" });
  }
});

// --- Helpers for attachment download (correct Content-Type so images don't download as .txt) ---
function getContentTypeFromFileName(
  fileName: string | null | undefined,
): string {
  if (!fileName || typeof fileName !== "string")
    return "application/octet-stream";
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    bmp: "image/bmp",
    ico: "image/x-icon",
    pdf: "application/pdf",
  };
  return map[ext] ?? "application/octet-stream";
}

function toBuffer(data: unknown): Buffer {
  if (data == null) return Buffer.alloc(0);
  if (Buffer.isBuffer(data)) return data;
  if (Array.isArray(data)) return Buffer.from(data);
  if (data instanceof ArrayBuffer || ArrayBuffer.isView(data))
    return Buffer.from(data as ArrayBuffer);
  if (typeof data === "string") return Buffer.from(data, "base64");
  return Buffer.from(data as ArrayBuffer);
}

// Download notice response attachment by ID (serves with correct Content-Type for images)
router.get("/attachments/:id/download", requireAuth, async (req, res) => {
  try {
    const attachmentId = Number(req.params.id);
    if (!attachmentId || Number.isNaN(attachmentId)) {
      return res.status(400).json({ error: "Invalid attachment id" });
    }

    // Verify the attachment belongs to a notice in the caller's company
    const companyId = (req.user as any).COMPANY_ID;
    const responseWithAttachment = await prisma.rESPONSE_MY_NOTICE.findFirst({
      where: { ATTACHMENT_ID: attachmentId, MY_NOTICE: { COMPANY_ID: companyId } },
      select: { RESPONSE_MY_NOTICE_ID: true },
    });
    if (!responseWithAttachment) {
      return res.status(403).json({ error: "Access denied" });
    }

    const row = await prisma.aTTACHMENTS.findUnique({
      where: { ATTACHMENT_ID: attachmentId },
      select: { FILE_NAME: true, ATTACHMENT: true },
    });

    if (!row || row.ATTACHMENT == null) {
      return res.status(404).json({ error: "Attachment not found" });
    }

    const buffer = toBuffer(row.ATTACHMENT);
    const contentType = getContentTypeFromFileName(row.FILE_NAME);

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${row.FILE_NAME}"`,
    );
    res.setHeader("Content-Type", contentType);
    res.end(buffer, "binary");
  } catch (error) {
    console.error("Error downloading notice attachment:", error);
    res.status(500).json({ error: "Failed to download attachment" });
  }
});

export default router;

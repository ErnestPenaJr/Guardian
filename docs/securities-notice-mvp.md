# Securities Notice MVP — User Guide

This guide covers the three features delivered in the Securities Notice MVP:

1. **Securities Fraud Notice Template** — a notice subtype with built-in
   compliance fields and an optional manager-approval workflow.
2. **Subpoena Rider Builder** — reusable subpoena language templates that can
   be merged into a notice and shared with law enforcement.
3. **Compliance Control Layer** — platform-wide field locks, disclaimer text,
   recipient verification warnings, file-type restrictions, and an immutable
   audit log.

Audience: User Admin (role 1), Manager (role 4), Processor (role 3), General
User (role 2), External User (role 5), Super Admin / JAFAR (role 6).

---

## 1. Roles at a glance

| Role          | ID | Securities Notice MVP capabilities |
|---------------|----|------------------------------------|
| User Admin    | 1  | Create / edit Securities Fraud Notice templates; configure subpoena language; view full company audit log + export. |
| General User  | 2  | View notices addressed to them (read-only). Cannot send or approve. |
| Processor     | 3  | Send notices; submit for approval; generate subpoena riders; mark records released; confirm first-time recipients. |
| Manager       | 4  | Everything a Processor can do, plus approve or reject notices submitted for approval; view scoped audit log. |
| External User | 5  | View notices assigned to them; attach an executed subpoena; request a follow-up call. |
| JAFAR (Super) | 6  | Inherits Admin permissions. Owns platform-level compliance config: disclaimer text, locked fields, permitted subpoena file types. Sees the full audit log including cross-tenant JAFAR events. |

---

## 2. Creating a Securities Fraud Notice template

**Who:** User Admin or JAFAR.

1. Sign in and open the **Workflows** screen.
2. Click **New Template** and pick **Notice → Securities Fraud Notice**.
3. Set a name, choose the fraud type (e.g. *Pump & Dump*, *Account Takeover*,
   *Wire Fraud*), and add fields. Fields flagged as **PII** are scanned for
   sensitive content and locked-field rules from JAFAR are enforced.
4. Toggle **Requires manager approval before send** if processors must submit
   for approval rather than send directly.
5. Toggle **Show compliance disclaimer** to display the JAFAR-managed
   disclaimer text when the notice is composed and sent.
6. Save. The template appears under **Securities Fraud Notices**.

Every save writes a `TEMPLATE_CREATED` or `TEMPLATE_MODIFIED` audit row,
including which fields were flagged PII and whether the disclaimer / approval
toggle changed.

---

## 3. Sending a notice

**Who:** Processor or Manager.

### Path A — Direct send (template does not require approval)

1. Open the template, click **Send Notice**.
2. Fill in recipient(s), subject, body. The disclaimer banner shows if the
   template enables it.
3. If any recipient has **never received a notice from your company before**,
   you'll see a *first-time recipient* warning. Confirm the recipient is
   correct before continuing. This writes a `FIRST_TIME_RECIPIENT_CONFIRMED`
   audit row.
4. Click **Send**. The notice goes out (Resend) and a `NOTICE_SENT` audit row
   is written. Status: `SENT_AWAITING_RESPONSE`.

### Path B — Submit for approval (template requires approval)

1. Compose the notice as above.
2. Click **Submit for Approval**, pick the approving Manager from the
   dropdown. Status moves to `PENDING_APPROVAL`. Audit:
   `NOTICE_SUBMITTED_FOR_APPROVAL`.
3. The Manager receives an in-app notification.

### Approving / rejecting (Manager only)

1. Open the notice from the **Pending Approvals** queue.
2. Click **Approve** to send the notice immediately. Audit:
   `NOTICE_APPROVED` + `NOTICE_SENT`. Status moves to
   `SENT_AWAITING_RESPONSE`.
3. Click **Reject** to send it back. You must enter a reason. Audit:
   `NOTICE_REJECTED`. Status moves to `RETURNED_FOR_REVISION` so the
   Processor can edit and re-submit.

---

## 4. Subpoena Rider Builder

### Configuring language templates (one-time, User Admin)

1. Go to **Templates → Subpoena Language**.
2. Click **New Language Template**. Choose a fraud type, name it, and write
   the boilerplate language. Supported tokens (auto-filled at generation
   time) include `{{NOTICE_ID}}`, `{{RECIPIENT_NAME}}`, `{{FRAUD_TYPE}}`,
   `{{SENT_AT}}`.
3. The body is scanned by the PII guard; obvious SSN / DOB / account-number
   patterns are blocked.
4. Save. Audit: `TEMPLATE_CREATED` (target type `TEMPLATE`, subtype
   `SUBPOENA_RIDER`).

### Generating a rider for a notice (Processor / Manager)

1. Open a sent or pending notice.
2. Click **Generate Subpoena Rider**. Pick the language template (filtered
   by the notice's fraud type).
3. The system populates tokens and creates a `SUBPOENA_RIDERS` row. Audit:
   `SUBPOENA_RIDER_GENERATED`.
4. Download the rider as PDF, or share the link with the external user
   assigned to the notice.

---

## 5. External User portal

**Who:** External User (e.g. law enforcement contact).

1. Sign in with the credentials the company sent you.
2. The **My Notices** page lists only the notices your account is assigned
   to (read-only).
3. Open a notice. You can:
   - **Attach Subpoena** — upload an executed PDF / TIFF / DOCX (limits set
     by JAFAR). The notice status moves to
     `SUBPOENA_RECEIVED_PENDING_REVIEW`. Audit: `SUBPOENA_RECEIVED`.
   - **Request a Call** — submit one or more proposed times for a follow-up
     conversation.

---

## 6. Records released

**Who:** Processor or Manager who originally sent the notice.

1. After uploading the requested records (typically via the existing
   request fulfillment flow), open the notice.
2. Click **Mark Records Released**. The notice transitions from
   `SUBPOENA_RECEIVED_PENDING_REVIEW` → `RECORDS_RELEASED`. Audit:
   `RECORDS_RELEASED`.
3. The notice is now closed; no further status transitions are allowed.

---

## 7. Compliance disclaimer (JAFAR)

**Who:** JAFAR (Super Admin) only.

1. Open **Platform Admin → Disclaimer**.
2. Edit the text. It applies to every tenant on the platform — there is no
   per-company override.
3. Save. Audit: `JAFAR_DISCLAIMER_UPDATED` (no `COMPANY_ID`).

The disclaimer is shown in two places:
- On the **template builder**, when **Show compliance disclaimer** is on.
- On the **send notice** screen, as a banner above the body.

---

## 8. Field locks and file-type restrictions (JAFAR)

**Who:** JAFAR.

- **Lock a field** (`PUT /api/platform/fields/:name/lock`) — prevents
  removal from any Securities Fraud Notice template. Audit:
  `JAFAR_FIELD_LOCKED`.
- **Permitted subpoena file types** (`PUT /api/platform/file-types`) —
  controls which MIME types external users may upload. Audit:
  `JAFAR_FILE_TYPES_UPDATED`.

---

## 9. Audit log

**Who:** User Admin (full), Manager (scoped to same-company), JAFAR (full
+ platform-level rows).

1. Open **Admin → Audit Log**.
2. Filter by date range, event type, actor user, actor role, target ID.
3. Click **Export → CSV** or **Export → PDF** (User Admin / JAFAR only).
4. The log is **immutable** — there is no edit or delete UI.

### Event types

`TEMPLATE_CREATED`, `TEMPLATE_MODIFIED`, `FIELD_RESTRICTION_CHANGED`,
`DISCLAIMER_TOGGLED`, `MANAGER_APPROVAL_CONFIG_CHANGED`,
`NOTICE_SUBMITTED_FOR_APPROVAL`, `NOTICE_APPROVED`, `NOTICE_REJECTED`,
`NOTICE_SENT`, `SUBPOENA_RIDER_GENERATED`, `SUBPOENA_RECEIVED`,
`RECORDS_RELEASED`, `FIRST_TIME_RECIPIENT_CONFIRMED`, `JAFAR_FIELD_LOCKED`,
`JAFAR_DISCLAIMER_UPDATED`, `JAFAR_FILE_TYPES_UPDATED`.

---

## 10. Recipient verification warnings

Whenever a Processor sends or submits a notice, every recipient is checked
against `GUARDIAN.RECIPIENT_VERIFICATIONS`. If a recipient has not been seen
before for the sending company, the UI shows a yellow "first-time recipient"
banner and requires explicit confirmation. The confirmation is logged as
`FIRST_TIME_RECIPIENT_CONFIRMED` for an after-the-fact compliance review.

---

## 11. Quick reference — notice status flow

```
DRAFT
  -> PENDING_APPROVAL                 (Processor submits, template requires approval)
  -> SENT_AWAITING_RESPONSE           (Processor sends directly, template does not require approval)

PENDING_APPROVAL
  -> SENT_AWAITING_RESPONSE           (Manager approves)
  -> RETURNED_FOR_REVISION            (Manager rejects)

RETURNED_FOR_REVISION
  -> PENDING_APPROVAL                 (Processor re-submits)

SENT_AWAITING_RESPONSE
  -> SUBPOENA_RECEIVED_PENDING_REVIEW (External user attaches subpoena)

SUBPOENA_RECEIVED_PENDING_REVIEW
  -> RECORDS_RELEASED                 (Processor / Manager marks records released)
```

`RECORDS_RELEASED` is terminal.

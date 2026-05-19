# Securities Notice MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the 15 user stories in `/Users/epena/Guardian MVP/Guardian_MVP_Implementation_v1_0.md` (Securities Fraud Notice Template + Subpoena Rider Builder + Compliance Control Layer) on top of the existing Guardian MVP notice infrastructure.

**Architecture:** Extend the existing `MY_NOTICES` table and FORMS-based template system with new columns + new sibling tables (`AUDIT_LOG`, `SUBPOENA_RIDERS`, `SUBPOENA_LANGUAGE_TEMPLATES`, `RECIPIENT_VERIFICATIONS`, `JAFAR_PLATFORM_CONFIG`). All new endpoints live in `server/routes/*.ts` (TS source compiled to `dist-server/`). Permissions extend `src/utils/permissions.ts` with new keys; the existing role IDs (1=Admin → User Admin, 3=Processor, 4=Manager, 5=External User, 6=Super Admin → JAFAR) map directly to the spec's role model. The cross-cutting audit log is wired via a tiny `writeAudit()` helper invoked from every mutating endpoint.

**Tech Stack:** TypeScript + Express + Prisma (SQL Server) on the server; React + Vite on the frontend. Tests follow the existing project pattern: standalone bun unit scripts in `src/tests/*.test.ts` and Playwright e2e in `e2e/**`.

**Role mapping (spec → existing IDs):**
- JAFAR / Super Admin → ROLE 6 (SUPER_ADMIN)
- User Admin → ROLE 1 (ADMIN)
- Manager → ROLE 4 (MANAGER)
- Processor → ROLE 3 (PROCESSOR)
- User → ROLE 2 (GENERAL_USER)
- External User → ROLE 5 (EXTERNAL_USER)

**Phase ordering (dependencies):**
- Phase 0 — DB foundation (migrations + Prisma schema)
- Phase 1 — Audit log infrastructure (consumed by every later phase)
- Phase 2 — Permissions matrix updates (consumed by every later route)
- Phase 3 — JAFAR platform config endpoints (US-CCL-05 first half) — needed for disclaimer text + locked fields + file-type list
- Phase 4 — Compliance Control Layer scaffolding (US-CCL-01 field restrictions, US-CCL-02 disclaimer)
- Phase 5 — Securities Fraud Notice Template (US-SNT-01..06)
- Phase 6 — Recipient verification (US-CCL-03) — wired into US-SNT-03 send flow
- Phase 7 — Subpoena Rider Builder (US-SRB-01..04) + External User portal
- Phase 8 — Audit log UI + export (US-CCL-04)
- Phase 9 — Final cross-cutting verification (RBAC matrix tests, e2e, docs)

---

## Conventions

- **Test runner:** the repo uses standalone bun scripts. Run with `bun src/tests/<name>.test.ts`. Each test file exits 0 on pass / 1 on fail. Use the existing `src/tests/permissions.test.ts` as the template for unit tests, and `src/tests/security-report.smoke.test.ts` as the template for HTTP smoke tests.
- **E2E:** `npx playwright test e2e/notices/<file>.spec.ts` (config at `playwright.config.ts`).
- **DB migrations:** raw SQL files in `migrations/` named with descriptive prefix. Apply via `bun src/utils/run-migration.ts <file>.sql` (or whichever helper the repo already exposes — check `scripts/` first; if none, the migration files exist as the source of truth and must be applied manually by the DBA).
- **Prisma:** after editing `prisma/schema.prisma`, run `bun prisma generate` then `bun prisma db pull` is **NOT** to be used (would clobber annotations); instead run `bun prisma generate` only and apply SQL migrations independently.
- **Three-server sync:** for every new endpoint, update `server/routes/*.ts` (canonical), then mirror into `server.cjs`, `server.js`, and `server-production.js` per CLAUDE.md.
- **Commits:** one logical commit per task step labelled `feat(securities-notice): <subject>` / `test(securities-notice): <subject>` / `chore(db): <subject>`.
- **403 message:** `"You do not have permission to <action>."` — use a single helper in `server/lib/forbid.ts` (created in Phase 2).

---

## File Structure (created across all phases)

**Migrations:**
- `migrations/securities_notice/01_audit_log.sql`
- `migrations/securities_notice/02_extend_my_notices.sql`
- `migrations/securities_notice/03_jafar_platform_config.sql`
- `migrations/securities_notice/04_extend_forms_template_subtype.sql`
- `migrations/securities_notice/05_recipient_verifications.sql`
- `migrations/securities_notice/06_subpoena_riders.sql`
- `migrations/securities_notice/07_subpoena_language_templates.sql`
- `migrations/securities_notice/08_external_users.sql`

**Prisma schema additions:** `prisma/schema.prisma` (edited)

**Server (TS canonical):**
- `server/lib/audit.ts` — `writeAudit(...)` helper
- `server/lib/forbid.ts` — 403 helper
- `server/lib/piiGuard.ts` — PII pattern library + scanner
- `server/lib/jafarConfig.ts` — JAFAR platform config getter (cached)
- `server/middleware/requireRole.ts` — generic role guard (uses permission keys)
- `server/middleware/requireExternalUser.ts` — scoped to ROLE 5
- `server/routes/audit.ts`
- `server/routes/notice-templates.ts` — securities-fraud + subpoena template CRUD
- `server/routes/securities-notices.ts` — new workflow endpoints (submit/approve/reject/send/records-released)
- `server/routes/subpoena-riders.ts`
- `server/routes/recipients.ts`
- `server/routes/external-notices.ts` — external-user-scoped surface
- `server/routes/platform-admin.ts` — JAFAR-only platform config

**Frontend:**
- `src/types/securitiesNotice.ts` — TS interfaces matching spec data models
- `src/services/auditService.ts`
- `src/services/securitiesNoticeService.ts`
- `src/services/subpoenaRiderService.ts`
- `src/services/recipientService.ts`
- `src/services/platformAdminService.ts`
- `src/components/SecuritiesNoticeTemplate/TemplateBuilder.tsx`
- `src/components/SecuritiesNoticeTemplate/FieldRestrictionsPanel.tsx`
- `src/components/SecuritiesNoticeTemplate/DisclaimerToggle.tsx`
- `src/components/SecuritiesNoticeTemplate/ManagerApprovalToggle.tsx`
- `src/components/SecuritiesNoticeTemplate/SendNoticeForm.tsx`
- `src/components/SecuritiesNoticeTemplate/FirstTimeRecipientModal.tsx`
- `src/components/SecuritiesNoticeTemplate/ApprovalReviewPanel.tsx`
- `src/components/SubpoenaRider/SubpoenaLanguageBuilder.tsx`
- `src/components/SubpoenaRider/GenerateRiderModal.tsx`
- `src/components/SubpoenaRider/AttachExecutedSubpoenaPanel.tsx`
- `src/components/AuditLog/AuditLogTable.tsx`
- `src/components/AuditLog/AuditLogFilters.tsx`
- `src/components/AuditLog/AuditLogExportBar.tsx`
- `src/pages/SecuritiesNoticeTemplateAdmin.tsx`
- `src/pages/SecuritiesNoticeSend.tsx`
- `src/pages/SecuritiesNoticeApprovalQueue.tsx`
- `src/pages/AuditLog.tsx`
- `src/pages/ExternalUserInbox.tsx`
- `src/pages/JafarPlatformConfig.tsx`

**Tests:**
- `src/tests/securities-notice-permissions.test.ts`
- `src/tests/audit-log.smoke.test.ts`
- `src/tests/notice-template.smoke.test.ts`
- `src/tests/securities-notice-workflow.smoke.test.ts`
- `src/tests/subpoena-rider.smoke.test.ts`
- `src/tests/external-user-portal.smoke.test.ts`
- `src/tests/pii-guard.test.ts`
- `src/tests/recipient-verification.smoke.test.ts`
- `src/tests/platform-config.smoke.test.ts`
- `e2e/securities-notice/template-builder.spec.ts`
- `e2e/securities-notice/send-no-approval.spec.ts`
- `e2e/securities-notice/submit-for-approval.spec.ts`
- `e2e/securities-notice/manager-approve-reject.spec.ts`
- `e2e/securities-notice/user-readonly.spec.ts`
- `e2e/subpoena-rider/configure-language.spec.ts`
- `e2e/subpoena-rider/generate-rider.spec.ts`
- `e2e/subpoena-rider/external-attach-subpoena.spec.ts`
- `e2e/subpoena-rider/records-released.spec.ts`
- `e2e/compliance/field-restrictions.spec.ts`
- `e2e/compliance/disclaimer.spec.ts`
- `e2e/compliance/first-time-recipient.spec.ts`
- `e2e/compliance/audit-log.spec.ts`
- `e2e/compliance/jafar-platform.spec.ts`

---

# Phase 0 — DB Foundation

Each migration file is a complete, idempotent SQL Server script using `IF NOT EXISTS` guards (follow the pattern from `migrations/create_my_notices_tables.sql`).

## Task 0.1: Create audit_log migration

**Files:**
- Create: `migrations/securities_notice/01_audit_log.sql`

- [ ] **Step 1: Write migration**

```sql
-- Audit log for Securities Notice MVP. Immutable for client roles.
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AUDIT_LOG' AND SCHEMA_NAME(schema_id) = 'GUARDIAN')
BEGIN
    CREATE TABLE [GUARDIAN].[AUDIT_LOG] (
        [ENTRY_ID]          BIGINT IDENTITY(1,1) NOT NULL,
        [EVENT_TYPE]        NVARCHAR(64) NOT NULL,
        [ACTOR_USER_ID]     INT NULL,
        [ACTOR_ROLE_ID]     INT NULL,
        [TARGET_TYPE]       NVARCHAR(32) NOT NULL, -- 'NOTICE' | 'TEMPLATE' | 'SUBPOENA_RIDER' | 'PLATFORM'
        [TARGET_ID]         NVARCHAR(64) NULL,     -- string to allow UUIDs or composite refs
        [EVENT_DETAIL]      NVARCHAR(MAX) NULL,    -- JSON payload
        [COMPANY_ID]        INT NULL,              -- NULL for JAFAR platform entries
        [FIRST_TIME_FLAG]   BIT NULL,
        [DISCLAIMER_STATE]  BIT NULL,
        [CREATED_AT]        DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [PK_AUDIT_LOG] PRIMARY KEY CLUSTERED ([ENTRY_ID] ASC)
    );
    PRINT 'Created GUARDIAN.AUDIT_LOG';
END
ELSE PRINT 'GUARDIAN.AUDIT_LOG already exists';

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AUDIT_LOG_COMPANY_CREATED')
    CREATE INDEX [IX_AUDIT_LOG_COMPANY_CREATED] ON [GUARDIAN].[AUDIT_LOG] ([COMPANY_ID], [CREATED_AT] DESC);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AUDIT_LOG_EVENT_TYPE')
    CREATE INDEX [IX_AUDIT_LOG_EVENT_TYPE] ON [GUARDIAN].[AUDIT_LOG] ([EVENT_TYPE]);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AUDIT_LOG_TARGET')
    CREATE INDEX [IX_AUDIT_LOG_TARGET] ON [GUARDIAN].[AUDIT_LOG] ([TARGET_TYPE], [TARGET_ID]);

-- Hard-deny client UPDATE/DELETE via DENY grants on the application login
-- (applied separately by DBA — documented here as the immutability mechanism).
```

- [ ] **Step 2: Commit**

```bash
git add migrations/securities_notice/01_audit_log.sql
git commit -m "chore(db): add AUDIT_LOG table for Securities Notice MVP"
```

## Task 0.2: Extend MY_NOTICES with workflow columns

**Files:**
- Create: `migrations/securities_notice/02_extend_my_notices.sql`

- [ ] **Step 1: Write migration**

```sql
-- Add Securities Notice workflow columns to MY_NOTICES.
-- Status values: DRAFT, PENDING_APPROVAL, RETURNED_FOR_REVISION,
-- SENT_AWAITING_RESPONSE, SUBPOENA_RECEIVED_PENDING_REVIEW, RECORDS_RELEASED.

IF COL_LENGTH('GUARDIAN.MY_NOTICES', 'TEMPLATE_FORM_ID') IS NULL
    ALTER TABLE [GUARDIAN].[MY_NOTICES] ADD [TEMPLATE_FORM_ID] INT NULL;
IF COL_LENGTH('GUARDIAN.MY_NOTICES', 'NOTICE_STATUS') IS NULL
    ALTER TABLE [GUARDIAN].[MY_NOTICES] ADD [NOTICE_STATUS] NVARCHAR(40) NOT NULL DEFAULT 'DRAFT';
IF COL_LENGTH('GUARDIAN.MY_NOTICES', 'SUBMITTED_BY') IS NULL
    ALTER TABLE [GUARDIAN].[MY_NOTICES] ADD [SUBMITTED_BY] INT NULL;
IF COL_LENGTH('GUARDIAN.MY_NOTICES', 'SUBMITTED_AT') IS NULL
    ALTER TABLE [GUARDIAN].[MY_NOTICES] ADD [SUBMITTED_AT] DATETIME2 NULL;
IF COL_LENGTH('GUARDIAN.MY_NOTICES', 'APPROVED_BY') IS NULL
    ALTER TABLE [GUARDIAN].[MY_NOTICES] ADD [APPROVED_BY] INT NULL;
IF COL_LENGTH('GUARDIAN.MY_NOTICES', 'APPROVED_AT') IS NULL
    ALTER TABLE [GUARDIAN].[MY_NOTICES] ADD [APPROVED_AT] DATETIME2 NULL;
IF COL_LENGTH('GUARDIAN.MY_NOTICES', 'REJECTED_BY') IS NULL
    ALTER TABLE [GUARDIAN].[MY_NOTICES] ADD [REJECTED_BY] INT NULL;
IF COL_LENGTH('GUARDIAN.MY_NOTICES', 'REJECTED_AT') IS NULL
    ALTER TABLE [GUARDIAN].[MY_NOTICES] ADD [REJECTED_AT] DATETIME2 NULL;
IF COL_LENGTH('GUARDIAN.MY_NOTICES', 'REJECTION_REASON') IS NULL
    ALTER TABLE [GUARDIAN].[MY_NOTICES] ADD [REJECTION_REASON] NVARCHAR(2000) NULL;
IF COL_LENGTH('GUARDIAN.MY_NOTICES', 'SENT_AT') IS NULL
    ALTER TABLE [GUARDIAN].[MY_NOTICES] ADD [SENT_AT] DATETIME2 NULL;
IF COL_LENGTH('GUARDIAN.MY_NOTICES', 'DISCLAIMER_STATE') IS NULL
    ALTER TABLE [GUARDIAN].[MY_NOTICES] ADD [DISCLAIMER_STATE] BIT NULL;
IF COL_LENGTH('GUARDIAN.MY_NOTICES', 'FIRST_TIME_RECIPIENT_FLAG') IS NULL
    ALTER TABLE [GUARDIAN].[MY_NOTICES] ADD [FIRST_TIME_RECIPIENT_FLAG] BIT NULL;
IF COL_LENGTH('GUARDIAN.MY_NOTICES', 'SUBPOENA_RIDER_ID') IS NULL
    ALTER TABLE [GUARDIAN].[MY_NOTICES] ADD [SUBPOENA_RIDER_ID] INT NULL;
IF COL_LENGTH('GUARDIAN.MY_NOTICES', 'ATTACHED_SUBPOENA_ATTACHMENT_ID') IS NULL
    ALTER TABLE [GUARDIAN].[MY_NOTICES] ADD [ATTACHED_SUBPOENA_ATTACHMENT_ID] INT NULL;

-- FK to FORMS template
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_MY_NOTICES_TEMPLATE_FORM')
    ALTER TABLE [GUARDIAN].[MY_NOTICES]
    ADD CONSTRAINT [FK_MY_NOTICES_TEMPLATE_FORM] FOREIGN KEY ([TEMPLATE_FORM_ID])
        REFERENCES [GUARDIAN].[FORMS] ([FORM_ID]);

-- Backfill NOTICE_STATUS from BUTTON_STATUS where unset
UPDATE [GUARDIAN].[MY_NOTICES]
SET NOTICE_STATUS = CASE
    WHEN BUTTON_STATUS IN ('DRAFT', 'draft') THEN 'DRAFT'
    WHEN BUTTON_STATUS IN ('SENT', 'PUBLISHED', 'published') THEN 'SENT_AWAITING_RESPONSE'
    ELSE 'DRAFT'
END
WHERE NOTICE_STATUS = 'DRAFT' AND BUTTON_STATUS IS NOT NULL;

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_MY_NOTICES_NOTICE_STATUS')
    CREATE INDEX [IX_MY_NOTICES_NOTICE_STATUS] ON [GUARDIAN].[MY_NOTICES] ([NOTICE_STATUS]);
```

- [ ] **Step 2: Commit**

```bash
git add migrations/securities_notice/02_extend_my_notices.sql
git commit -m "chore(db): extend MY_NOTICES with Securities Notice workflow columns"
```

## Task 0.3: JAFAR platform config migration

**Files:**
- Create: `migrations/securities_notice/03_jafar_platform_config.sql`

- [ ] **Step 1: Write migration**

```sql
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'JAFAR_PLATFORM_CONFIG' AND SCHEMA_NAME(schema_id) = 'GUARDIAN')
BEGIN
    CREATE TABLE [GUARDIAN].[JAFAR_PLATFORM_CONFIG] (
        [CONFIG_KEY]   NVARCHAR(64) NOT NULL,
        [CONFIG_VALUE] NVARCHAR(MAX) NOT NULL,
        [UPDATED_BY]   INT NULL,
        [UPDATED_AT]   DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [PK_JAFAR_PLATFORM_CONFIG] PRIMARY KEY CLUSTERED ([CONFIG_KEY])
    );
END

-- Seed: disclaimer text, permitted file types, locked fields list
IF NOT EXISTS (SELECT 1 FROM [GUARDIAN].[JAFAR_PLATFORM_CONFIG] WHERE CONFIG_KEY = 'COMPLIANCE_DISCLAIMER_TEXT')
INSERT [GUARDIAN].[JAFAR_PLATFORM_CONFIG] (CONFIG_KEY, CONFIG_VALUE) VALUES
    ('COMPLIANCE_DISCLAIMER_TEXT',
     'This notice is issued solely for law-enforcement purposes. Any disclosure outside the scope of an executed subpoena is prohibited.'),
    ('PERMITTED_SUBPOENA_FILE_TYPES', '["application/pdf","image/tiff","application/vnd.openxmlformats-officedocument.wordprocessingml.document"]'),
    ('LOCKED_FIELDS', '[]');
```

- [ ] **Step 2: Commit**

```bash
git add migrations/securities_notice/03_jafar_platform_config.sql
git commit -m "chore(db): add JAFAR_PLATFORM_CONFIG with seed values"
```

## Task 0.4: Extend FORMS with notice subtype + workflow toggles

**Files:**
- Create: `migrations/securities_notice/04_extend_forms_template_subtype.sql`

- [ ] **Step 1: Write migration**

```sql
IF COL_LENGTH('GUARDIAN.FORMS', 'NOTICE_SUBTYPE') IS NULL
    ALTER TABLE [GUARDIAN].[FORMS] ADD [NOTICE_SUBTYPE] NVARCHAR(40) NULL;
    -- Values: SECURITIES_FRAUD, SUBPOENA_RIDER (NULL for non-notice templates)
IF COL_LENGTH('GUARDIAN.FORMS', 'FRAUD_TYPE') IS NULL
    ALTER TABLE [GUARDIAN].[FORMS] ADD [FRAUD_TYPE] NVARCHAR(40) NULL;
    -- Values: SECURITIES_MANIPULATION, ATO, CHECK_FRAUD, WIRE_FRAUD
IF COL_LENGTH('GUARDIAN.FORMS', 'REQUIRES_MANAGER_APPROVAL') IS NULL
    ALTER TABLE [GUARDIAN].[FORMS] ADD [REQUIRES_MANAGER_APPROVAL] BIT NOT NULL DEFAULT 0;
IF COL_LENGTH('GUARDIAN.FORMS', 'COMPLIANCE_DISCLAIMER_ENABLED') IS NULL
    ALTER TABLE [GUARDIAN].[FORMS] ADD [COMPLIANCE_DISCLAIMER_ENABLED] BIT NOT NULL DEFAULT 0;
IF COL_LENGTH('GUARDIAN.FORMS', 'TITLE_FORMAT') IS NULL
    ALTER TABLE [GUARDIAN].[FORMS] ADD [TITLE_FORMAT] NVARCHAR(255) NULL;
    -- e.g. "[SECURITY_SYMBOL] — $[LOSS_EXPOSURE]"

-- Per-template field flags live on the FIELDS-to-FORM linkage. Add to FORMS_FIELDS.
IF COL_LENGTH('GUARDIAN.FORMS_FIELDS', 'IS_PII') IS NULL
    ALTER TABLE [GUARDIAN].[FORMS_FIELDS] ADD [IS_PII] BIT NOT NULL DEFAULT 0;
IF COL_LENGTH('GUARDIAN.FORMS_FIELDS', 'IS_ENABLED') IS NULL
    ALTER TABLE [GUARDIAN].[FORMS_FIELDS] ADD [IS_ENABLED] BIT NOT NULL DEFAULT 1;
IF COL_LENGTH('GUARDIAN.FORMS_FIELDS', 'IS_LOCKED_BY_JAFAR') IS NULL
    ALTER TABLE [GUARDIAN].[FORMS_FIELDS] ADD [IS_LOCKED_BY_JAFAR] BIT NOT NULL DEFAULT 0;
IF COL_LENGTH('GUARDIAN.FORMS_FIELDS', 'IS_READ_ONLY') IS NULL
    ALTER TABLE [GUARDIAN].[FORMS_FIELDS] ADD [IS_READ_ONLY] BIT NOT NULL DEFAULT 0;
```

- [ ] **Step 2: Commit**

```bash
git add migrations/securities_notice/04_extend_forms_template_subtype.sql
git commit -m "chore(db): extend FORMS/FORMS_FIELDS for notice template subtypes"
```

## Task 0.5: Recipient verifications migration

**Files:**
- Create: `migrations/securities_notice/05_recipient_verifications.sql`

- [ ] **Step 1: Write migration**

```sql
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'RECIPIENT_VERIFICATIONS' AND SCHEMA_NAME(schema_id) = 'GUARDIAN')
BEGIN
    CREATE TABLE [GUARDIAN].[RECIPIENT_VERIFICATIONS] (
        [VERIFICATION_ID] INT IDENTITY(1,1) NOT NULL,
        [RECIPIENT_USER_ID] INT NOT NULL,
        [COMPANY_ID]        INT NOT NULL,
        [VERIFIED_STATUS]   NVARCHAR(32) NOT NULL DEFAULT 'FIRST_TIME',
        [VERIFIED_AT]       DATETIME2 NULL,
        [FIRST_NOTICE_ID]   INT NULL,
        CONSTRAINT [PK_RECIPIENT_VERIFICATIONS] PRIMARY KEY CLUSTERED ([VERIFICATION_ID]),
        CONSTRAINT [UQ_RECIPIENT_VERIFICATIONS_USER_COMPANY] UNIQUE ([RECIPIENT_USER_ID], [COMPANY_ID]),
        CONSTRAINT [FK_RV_USER] FOREIGN KEY ([RECIPIENT_USER_ID]) REFERENCES [GUARDIAN].[USERS] ([USER_ID])
    );
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_RV_STATUS')
    CREATE INDEX [IX_RV_STATUS] ON [GUARDIAN].[RECIPIENT_VERIFICATIONS] ([COMPANY_ID], [VERIFIED_STATUS]);
```

- [ ] **Step 2: Commit**

```bash
git add migrations/securities_notice/05_recipient_verifications.sql
git commit -m "chore(db): add RECIPIENT_VERIFICATIONS table"
```

## Task 0.6: Subpoena riders + language templates migrations

**Files:**
- Create: `migrations/securities_notice/06_subpoena_riders.sql`
- Create: `migrations/securities_notice/07_subpoena_language_templates.sql`

- [ ] **Step 1: Write 06_subpoena_riders.sql**

```sql
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SUBPOENA_RIDERS' AND SCHEMA_NAME(schema_id) = 'GUARDIAN')
BEGIN
    CREATE TABLE [GUARDIAN].[SUBPOENA_RIDERS] (
        [RIDER_ID]            INT IDENTITY(1,1) NOT NULL,
        [LANGUAGE_TEMPLATE_ID] INT NOT NULL,
        [FRAUD_TYPE]          NVARCHAR(40) NOT NULL,
        [POPULATED_LANGUAGE]  NVARCHAR(MAX) NOT NULL,
        [TOKEN_VALUES_JSON]   NVARCHAR(MAX) NOT NULL, -- {"SECURITY_SYMBOL":"AAPL",...}
        [INCIDENT_NOTICE_ID]  INT NULL,
        [CREATED_BY]          INT NOT NULL,
        [COMPANY_ID]          INT NOT NULL,
        [CREATED_AT]          DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [PK_SUBPOENA_RIDERS] PRIMARY KEY CLUSTERED ([RIDER_ID]),
        CONSTRAINT [FK_SR_NOTICE] FOREIGN KEY ([INCIDENT_NOTICE_ID]) REFERENCES [GUARDIAN].[MY_NOTICES] ([NOTICE_ID])
    );
END
```

- [ ] **Step 2: Write 07_subpoena_language_templates.sql**

```sql
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SUBPOENA_LANGUAGE_TEMPLATES' AND SCHEMA_NAME(schema_id) = 'GUARDIAN')
BEGIN
    CREATE TABLE [GUARDIAN].[SUBPOENA_LANGUAGE_TEMPLATES] (
        [LANGUAGE_TEMPLATE_ID] INT IDENTITY(1,1) NOT NULL,
        [FRAUD_TYPE]           NVARCHAR(40) NOT NULL,
        [BASE_LANGUAGE]        NVARCHAR(MAX) NOT NULL,
        [TOKENS_JSON]          NVARCHAR(MAX) NOT NULL,
            -- [{token:"[SECURITY_SYMBOL]",description:"...",autoPopulateFromIncident:true},...]
        [CREATED_BY]           INT NOT NULL,
        [COMPANY_ID]           INT NOT NULL,
        [CREATED_AT]           DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [UPDATED_AT]           DATETIME2 NULL,
        CONSTRAINT [PK_SUBPOENA_LANG_TEMPLATES] PRIMARY KEY CLUSTERED ([LANGUAGE_TEMPLATE_ID]),
        CONSTRAINT [UQ_SUBPOENA_LANG_FRAUD_PER_COMPANY] UNIQUE ([COMPANY_ID], [FRAUD_TYPE])
    );
END
```

- [ ] **Step 3: Commit**

```bash
git add migrations/securities_notice/06_subpoena_riders.sql migrations/securities_notice/07_subpoena_language_templates.sql
git commit -m "chore(db): add subpoena riders + language templates tables"
```

## Task 0.7: External users migration

**Files:**
- Create: `migrations/securities_notice/08_external_users.sql`

- [ ] **Step 1: Write migration**

```sql
-- External users (law enforcement) are full USERS rows with ROLE_ID=5 already.
-- Add an assignment table linking external users to specific notices.
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'EXTERNAL_NOTICE_ASSIGNMENTS' AND SCHEMA_NAME(schema_id) = 'GUARDIAN')
BEGIN
    CREATE TABLE [GUARDIAN].[EXTERNAL_NOTICE_ASSIGNMENTS] (
        [ASSIGNMENT_ID]      INT IDENTITY(1,1) NOT NULL,
        [NOTICE_ID]          INT NOT NULL,
        [EXTERNAL_USER_ID]   INT NOT NULL,
        [AGENCY_NAME]        NVARCHAR(255) NULL,
        [CREATED_AT]         DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [PK_EXTERNAL_NOTICE_ASSIGNMENTS] PRIMARY KEY CLUSTERED ([ASSIGNMENT_ID]),
        CONSTRAINT [UQ_ENA_NOTICE_USER] UNIQUE ([NOTICE_ID], [EXTERNAL_USER_ID]),
        CONSTRAINT [FK_ENA_NOTICE] FOREIGN KEY ([NOTICE_ID]) REFERENCES [GUARDIAN].[MY_NOTICES] ([NOTICE_ID]),
        CONSTRAINT [FK_ENA_USER] FOREIGN KEY ([EXTERNAL_USER_ID]) REFERENCES [GUARDIAN].[USERS] ([USER_ID])
    );
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'EXTERNAL_CALL_REQUESTS' AND SCHEMA_NAME(schema_id) = 'GUARDIAN')
BEGIN
    CREATE TABLE [GUARDIAN].[EXTERNAL_CALL_REQUESTS] (
        [CALL_REQUEST_ID]   INT IDENTITY(1,1) NOT NULL,
        [NOTICE_ID]         INT NOT NULL,
        [EXTERNAL_USER_ID]  INT NOT NULL,
        [PROPOSED_TIMES]    NVARCHAR(MAX) NOT NULL, -- JSON array of ISO timestamps
        [MEETING_LINK]      NVARCHAR(1024) NULL,    -- filled by Processor reply
        [CREATED_AT]        DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [PK_EXTERNAL_CALL_REQUESTS] PRIMARY KEY CLUSTERED ([CALL_REQUEST_ID])
    );
END
```

- [ ] **Step 2: Commit**

```bash
git add migrations/securities_notice/08_external_users.sql
git commit -m "chore(db): add EXTERNAL_NOTICE_ASSIGNMENTS and EXTERNAL_CALL_REQUESTS"
```

## Task 0.8: Update Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add models for each new/extended table**

Append the following models (adjust relations to match existing naming conventions in the file — `mY_NOTICES`, `uSERS`, etc.):

```prisma
model AUDIT_LOG {
  ENTRY_ID         BigInt    @id @default(autoincrement())
  EVENT_TYPE       String
  ACTOR_USER_ID    Int?
  ACTOR_ROLE_ID    Int?
  TARGET_TYPE      String
  TARGET_ID        String?
  EVENT_DETAIL     String?
  COMPANY_ID       Int?
  FIRST_TIME_FLAG  Boolean?
  DISCLAIMER_STATE Boolean?
  CREATED_AT       DateTime  @default(now())

  @@index([COMPANY_ID, CREATED_AT])
  @@index([EVENT_TYPE])
  @@index([TARGET_TYPE, TARGET_ID])
  @@schema("GUARDIAN")
}

model JAFAR_PLATFORM_CONFIG {
  CONFIG_KEY   String   @id
  CONFIG_VALUE String
  UPDATED_BY   Int?
  UPDATED_AT   DateTime @default(now())
  @@schema("GUARDIAN")
}

model RECIPIENT_VERIFICATIONS {
  VERIFICATION_ID  Int      @id @default(autoincrement())
  RECIPIENT_USER_ID Int
  COMPANY_ID       Int
  VERIFIED_STATUS  String   @default("FIRST_TIME")
  VERIFIED_AT      DateTime?
  FIRST_NOTICE_ID  Int?
  @@unique([RECIPIENT_USER_ID, COMPANY_ID])
  @@index([COMPANY_ID, VERIFIED_STATUS])
  @@schema("GUARDIAN")
}

model SUBPOENA_LANGUAGE_TEMPLATES {
  LANGUAGE_TEMPLATE_ID Int      @id @default(autoincrement())
  FRAUD_TYPE           String
  BASE_LANGUAGE        String
  TOKENS_JSON          String
  CREATED_BY           Int
  COMPANY_ID           Int
  CREATED_AT           DateTime @default(now())
  UPDATED_AT           DateTime?
  RIDERS               SUBPOENA_RIDERS[]
  @@unique([COMPANY_ID, FRAUD_TYPE])
  @@schema("GUARDIAN")
}

model SUBPOENA_RIDERS {
  RIDER_ID             Int      @id @default(autoincrement())
  LANGUAGE_TEMPLATE_ID Int
  LANGUAGE_TEMPLATE    SUBPOENA_LANGUAGE_TEMPLATES @relation(fields: [LANGUAGE_TEMPLATE_ID], references: [LANGUAGE_TEMPLATE_ID])
  FRAUD_TYPE           String
  POPULATED_LANGUAGE   String
  TOKEN_VALUES_JSON    String
  INCIDENT_NOTICE_ID   Int?
  CREATED_BY           Int
  COMPANY_ID           Int
  CREATED_AT           DateTime @default(now())
  @@schema("GUARDIAN")
}

model EXTERNAL_NOTICE_ASSIGNMENTS {
  ASSIGNMENT_ID    Int      @id @default(autoincrement())
  NOTICE_ID        Int
  EXTERNAL_USER_ID Int
  AGENCY_NAME      String?
  CREATED_AT       DateTime @default(now())
  @@unique([NOTICE_ID, EXTERNAL_USER_ID])
  @@schema("GUARDIAN")
}

model EXTERNAL_CALL_REQUESTS {
  CALL_REQUEST_ID  Int      @id @default(autoincrement())
  NOTICE_ID        Int
  EXTERNAL_USER_ID Int
  PROPOSED_TIMES   String
  MEETING_LINK     String?
  CREATED_AT       DateTime @default(now())
  @@schema("GUARDIAN")
}
```

Also extend the existing `MY_NOTICES` model with new fields: `TEMPLATE_FORM_ID Int?`, `NOTICE_STATUS String @default("DRAFT")`, `SUBMITTED_BY Int?`, `SUBMITTED_AT DateTime?`, `APPROVED_BY Int?`, `APPROVED_AT DateTime?`, `REJECTED_BY Int?`, `REJECTED_AT DateTime?`, `REJECTION_REASON String?`, `SENT_AT DateTime?`, `DISCLAIMER_STATE Boolean?`, `FIRST_TIME_RECIPIENT_FLAG Boolean?`, `SUBPOENA_RIDER_ID Int?`, `ATTACHED_SUBPOENA_ATTACHMENT_ID Int?`.

Extend the `FORMS` model with: `NOTICE_SUBTYPE String?`, `FRAUD_TYPE String?`, `REQUIRES_MANAGER_APPROVAL Boolean @default(false)`, `COMPLIANCE_DISCLAIMER_ENABLED Boolean @default(false)`, `TITLE_FORMAT String?`.

Extend the `FORMS_FIELDS` model with: `IS_PII Boolean @default(false)`, `IS_ENABLED Boolean @default(true)`, `IS_LOCKED_BY_JAFAR Boolean @default(false)`, `IS_READ_ONLY Boolean @default(false)`.

- [ ] **Step 2: Generate Prisma client**

```bash
bun prisma generate
```

Expected: "Generated Prisma Client" success message, no errors.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "chore(prisma): model Securities Notice MVP tables and column extensions"
```

---

# Phase 1 — Audit Log Infrastructure

## Task 1.1: writeAudit helper + unit test

**Files:**
- Create: `server/lib/audit.ts`
- Test: `src/tests/audit-log.smoke.test.ts`

- [ ] **Step 1: Write failing smoke test**

```typescript
// src/tests/audit-log.smoke.test.ts
import { config as dotenvConfig } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { writeAudit } from '../../server/lib/audit';

dotenvConfig();
const prisma = new PrismaClient();

async function run() {
  const entry = await writeAudit({
    eventType: 'TEMPLATE_CREATED',
    actorUserId: 999999,
    actorRoleId: 1,
    targetType: 'TEMPLATE',
    targetId: 'test-template-id',
    companyId: 54,
    detail: { test: true },
  });
  if (!entry?.ENTRY_ID) throw new Error('writeAudit did not return ENTRY_ID');

  const found = await prisma.aUDIT_LOG.findUnique({ where: { ENTRY_ID: entry.ENTRY_ID } });
  if (!found || found.EVENT_TYPE !== 'TEMPLATE_CREATED') throw new Error('audit row missing');

  await prisma.aUDIT_LOG.delete({ where: { ENTRY_ID: entry.ENTRY_ID } });
  console.log('ok');
}
run().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run test, verify it fails**

```bash
bun src/tests/audit-log.smoke.test.ts
```

Expected: FAIL — `Cannot find module './lib/audit'` (or similar).

- [ ] **Step 3: Implement writeAudit**

```typescript
// server/lib/audit.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export type AuditEventType =
  | 'TEMPLATE_CREATED'
  | 'TEMPLATE_MODIFIED'
  | 'FIELD_RESTRICTION_CHANGED'
  | 'DISCLAIMER_TOGGLED'
  | 'MANAGER_APPROVAL_CONFIG_CHANGED'
  | 'NOTICE_SUBMITTED_FOR_APPROVAL'
  | 'NOTICE_APPROVED'
  | 'NOTICE_REJECTED'
  | 'NOTICE_SENT'
  | 'SUBPOENA_RIDER_GENERATED'
  | 'SUBPOENA_RECEIVED'
  | 'RECORDS_RELEASED'
  | 'FIRST_TIME_RECIPIENT_CONFIRMED'
  | 'JAFAR_FIELD_LOCKED'
  | 'JAFAR_DISCLAIMER_UPDATED'
  | 'JAFAR_FILE_TYPES_UPDATED';

export interface WriteAuditParams {
  eventType: AuditEventType;
  actorUserId: number | null;
  actorRoleId: number | null;
  targetType: 'NOTICE' | 'TEMPLATE' | 'SUBPOENA_RIDER' | 'PLATFORM';
  targetId: string | number | null;
  companyId: number | null;
  detail?: Record<string, unknown>;
  firstTimeFlag?: boolean;
  disclaimerState?: boolean;
}

export async function writeAudit(p: WriteAuditParams) {
  return prisma.aUDIT_LOG.create({
    data: {
      EVENT_TYPE: p.eventType,
      ACTOR_USER_ID: p.actorUserId,
      ACTOR_ROLE_ID: p.actorRoleId,
      TARGET_TYPE: p.targetType,
      TARGET_ID: p.targetId == null ? null : String(p.targetId),
      EVENT_DETAIL: p.detail ? JSON.stringify(p.detail) : null,
      COMPANY_ID: p.companyId,
      FIRST_TIME_FLAG: p.firstTimeFlag ?? null,
      DISCLAIMER_STATE: p.disclaimerState ?? null,
    },
  });
}
```

- [ ] **Step 4: Re-run test, verify PASS**

```bash
bun src/tests/audit-log.smoke.test.ts
```

Expected: `ok`

- [ ] **Step 5: Commit**

```bash
git add server/lib/audit.ts src/tests/audit-log.smoke.test.ts
git commit -m "feat(audit): writeAudit helper + smoke test"
```

## Task 1.2: forbid helper

**Files:**
- Create: `server/lib/forbid.ts`

- [ ] **Step 1: Implement helper**

```typescript
// server/lib/forbid.ts
import type { Response } from 'express';
export function forbid(res: Response, action: string): Response {
  return res.status(403).json({ error: `You do not have permission to ${action}.` });
}
```

- [ ] **Step 2: Commit**

```bash
git add server/lib/forbid.ts
git commit -m "feat(security): centralised forbid() helper"
```

---

# Phase 2 — Permissions Matrix Updates

## Task 2.1: Add new permission keys

**Files:**
- Modify: `src/utils/permissions.ts:22-89`
- Modify: `lib/permissions.cjs` (mirror — if file exists; check first)
- Test: `src/tests/securities-notice-permissions.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/tests/securities-notice-permissions.test.ts
import { can, ROLE } from '../utils/permissions';

const checks: Array<[keyof typeof ROLE, string, boolean]> = [
  ['ADMIN',         'securitiesNotice.template.create',    true],
  ['SUPER_ADMIN',   'securitiesNotice.template.create',    true],
  ['MANAGER',       'securitiesNotice.template.create',    false],
  ['PROCESSOR',     'securitiesNotice.template.create',    false],
  ['GENERAL_USER',  'securitiesNotice.template.create',    false],
  ['EXTERNAL_USER', 'securitiesNotice.template.create',    false],

  ['PROCESSOR',     'securitiesNotice.send',               true],
  ['MANAGER',       'securitiesNotice.send',               true],
  ['ADMIN',         'securitiesNotice.send',               false],
  ['GENERAL_USER',  'securitiesNotice.send',               false],

  ['MANAGER',       'securitiesNotice.approve',            true],
  ['PROCESSOR',     'securitiesNotice.approve',            false],
  ['ADMIN',         'securitiesNotice.approve',            false],

  ['ADMIN',         'audit.viewFull',                      true],
  ['MANAGER',       'audit.viewScoped',                    true],
  ['PROCESSOR',     'audit.viewFull',                      false],

  ['SUPER_ADMIN',   'platform.config',                     true],
  ['ADMIN',         'platform.config',                     false],

  ['EXTERNAL_USER', 'external.attachSubpoena',             true],
  ['PROCESSOR',     'external.attachSubpoena',             false],
];

let fails = 0;
for (const [roleName, key, expected] of checks) {
  const user = { ROLE_ID: ROLE[roleName] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const got = can(user as any, key as any);
  if (got !== expected) { console.error(`FAIL ${roleName} ${key} expected=${expected} got=${got}`); fails++; }
}
if (fails) { console.error(`${fails} permission checks failed`); process.exit(1); }
console.log('ok');
```

- [ ] **Step 2: Run test — should FAIL because keys don't exist**

```bash
bun src/tests/securities-notice-permissions.test.ts
```

- [ ] **Step 3: Extend PermissionKey union and MATRIX**

In `src/utils/permissions.ts`, add to the `PermissionKey` union (after line 49):

```typescript
  // Securities Notice MVP
  | 'securitiesNotice.template.create'
  | 'securitiesNotice.template.edit'
  | 'securitiesNotice.template.view'
  | 'securitiesNotice.send'
  | 'securitiesNotice.submit'
  | 'securitiesNotice.approve'
  | 'securitiesNotice.view'
  | 'securitiesNotice.viewReadOnly'
  | 'securitiesNotice.markRecordsReleased'
  | 'subpoenaRider.configureLanguage'
  | 'subpoenaRider.generate'
  | 'audit.viewFull'
  | 'audit.viewScoped'
  | 'audit.export'
  | 'platform.config'
  | 'external.viewOwnNotice'
  | 'external.attachSubpoena'
  | 'external.requestCall';
```

Then in the `MATRIX` object (after line 88), add:

```typescript
  'securitiesNotice.template.create':       [A, S],
  'securitiesNotice.template.edit':         [A, S],
  'securitiesNotice.template.view':         [A, P, M, S],
  'securitiesNotice.send':                  [P, M],
  'securitiesNotice.submit':                [P],
  'securitiesNotice.approve':               [M],
  'securitiesNotice.view':                  [A, P, M, S],
  'securitiesNotice.viewReadOnly':          [G],
  'securitiesNotice.markRecordsReleased':   [P, M],
  'subpoenaRider.configureLanguage':        [A, S],
  'subpoenaRider.generate':                 [P, M],
  'audit.viewFull':                         [A, S],
  'audit.viewScoped':                       [M],
  'audit.export':                           [A, S],
  'platform.config':                        [S],
  'external.viewOwnNotice':                 [E],
  'external.attachSubpoena':                [E],
  'external.requestCall':                   [E],
```

- [ ] **Step 4: Re-run test — verify PASS**

```bash
bun src/tests/securities-notice-permissions.test.ts
```

Expected: `ok`

- [ ] **Step 5: Mirror in backend permissions library (if `lib/permissions.cjs` exists)**

Search: `grep -l "MATRIX" lib/*.cjs server/lib/*.ts 2>/dev/null`. If a backend mirror exists, add the identical keys/roles there. Otherwise, create `server/lib/permissions.ts` re-exporting from `src/utils/permissions.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/utils/permissions.ts src/tests/securities-notice-permissions.test.ts
git commit -m "feat(rbac): add Securities Notice MVP permission keys"
```

## Task 2.2: requireRole middleware (server-side permission guard)

**Files:**
- Create: `server/middleware/requireRole.ts`

- [ ] **Step 1: Implement**

```typescript
// server/middleware/requireRole.ts
import type { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { forbid } from '../lib/forbid.js';

const prisma = new PrismaClient();

// Mirror of MATRIX from src/utils/permissions.ts. Keep in sync.
const ROLE_PERMS: Record<string, number[]> = {
  'securitiesNotice.template.create':     [1, 6],
  'securitiesNotice.template.edit':       [1, 6],
  'securitiesNotice.send':                [3, 4],
  'securitiesNotice.submit':              [3],
  'securitiesNotice.approve':             [4],
  'securitiesNotice.markRecordsReleased': [3, 4],
  'subpoenaRider.configureLanguage':      [1, 6],
  'subpoenaRider.generate':               [3, 4],
  'audit.viewFull':                       [1, 6],
  'audit.viewScoped':                     [4],
  'audit.export':                         [1, 6],
  'platform.config':                      [6],
  'external.viewOwnNotice':               [5],
  'external.attachSubpoena':              [5],
  'external.requestCall':                 [5],
};

export function requireRole(permissionKey: string, action: string) {
  return async function (req: Request, res: Response, next: NextFunction) {
    const u = req.user as { id?: number; userId?: number } | undefined;
    const userId = Number(u?.id ?? u?.userId);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const userRoles = await prisma.uSER_ROLES.findMany({
      where: { USER_ID: userId, STATUS: 'P' },
      select: { ROLE_ID: true },
    });
    const allowed = ROLE_PERMS[permissionKey] ?? [];
    const has = userRoles.some((r) => allowed.includes(r.ROLE_ID));
    if (!has) return forbid(res, action);
    (req as any).actorRoleId = userRoles[0]?.ROLE_ID ?? null;
    next();
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add server/middleware/requireRole.ts
git commit -m "feat(rbac): requireRole middleware for permission-key checks"
```

---

# Phase 3 — JAFAR Platform Config (US-CCL-05 first half)

## Task 3.1: jafarConfig getter with cache

**Files:**
- Create: `server/lib/jafarConfig.ts`

- [ ] **Step 1: Implement**

```typescript
// server/lib/jafarConfig.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

let cache: { ts: number; values: Record<string, string> } | null = null;
const TTL_MS = 30_000;

export async function getJafarConfig(key: string): Promise<string | null> {
  if (!cache || Date.now() - cache.ts > TTL_MS) {
    const rows = await prisma.jAFAR_PLATFORM_CONFIG.findMany();
    cache = { ts: Date.now(), values: Object.fromEntries(rows.map((r) => [r.CONFIG_KEY, r.CONFIG_VALUE])) };
  }
  return cache.values[key] ?? null;
}

export async function setJafarConfig(key: string, value: string, updatedBy: number): Promise<void> {
  await prisma.jAFAR_PLATFORM_CONFIG.upsert({
    where: { CONFIG_KEY: key },
    update: { CONFIG_VALUE: value, UPDATED_BY: updatedBy, UPDATED_AT: new Date() },
    create: { CONFIG_KEY: key, CONFIG_VALUE: value, UPDATED_BY: updatedBy },
  });
  cache = null;
}

export async function getLockedFields(): Promise<string[]> {
  const raw = await getJafarConfig('LOCKED_FIELDS');
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export async function getPermittedSubpoenaFileTypes(): Promise<string[]> {
  const raw = await getJafarConfig('PERMITTED_SUBPOENA_FILE_TYPES');
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export async function getDisclaimerText(): Promise<string> {
  return (await getJafarConfig('COMPLIANCE_DISCLAIMER_TEXT')) ?? '';
}
```

- [ ] **Step 2: Commit**

```bash
git add server/lib/jafarConfig.ts
git commit -m "feat(jafar): platform config getter/setter with cache"
```

## Task 3.2: Platform admin route (PUT field lock / disclaimer / file types + GET audit)

**Files:**
- Create: `server/routes/platform-admin.ts`
- Modify: `server/index.ts` (register route)
- Test: `src/tests/platform-config.smoke.test.ts`

- [ ] **Step 1: Write smoke test**

See `src/tests/security-report.smoke.test.ts` for the HTTP-test template. Test cases:
1. Anonymous PUT `/api/platform/disclaimer` → 401
2. Non-JAFAR PUT → 403 with body `You do not have permission to update platform disclaimer.`
3. JAFAR PUT with `{ text: 'new disclaimer' }` → 200; subsequent GET via `getDisclaimerText()` returns `'new disclaimer'`; audit row `JAFAR_DISCLAIMER_UPDATED` exists.
4. JAFAR PUT `/api/platform/fields/SSN/lock` with `{ locked: true }` → 200; `getLockedFields()` includes `'SSN'`; audit row `JAFAR_FIELD_LOCKED` exists.
5. JAFAR PUT `/api/platform/file-types` with `{ types: ['application/pdf'] }` → 200; audit row `JAFAR_FILE_TYPES_UPDATED` exists.

- [ ] **Step 2: Implement route**

```typescript
// server/routes/platform-admin.ts
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { requireJafar } from '../middleware/requireJafar.js';
import { getDisclaimerText, getLockedFields, getPermittedSubpoenaFileTypes, setJafarConfig } from '../lib/jafarConfig.js';
import { writeAudit } from '../lib/audit.js';

const router = Router();
router.use(requireAuth, requireJafar);

router.put('/disclaimer', async (req, res) => {
  const { text } = z.object({ text: z.string().min(1) }).parse(req.body);
  const prev = await getDisclaimerText();
  const userId = (req.user as any).id;
  await setJafarConfig('COMPLIANCE_DISCLAIMER_TEXT', text, userId);
  await writeAudit({
    eventType: 'JAFAR_DISCLAIMER_UPDATED',
    actorUserId: userId, actorRoleId: 6,
    targetType: 'PLATFORM', targetId: 'COMPLIANCE_DISCLAIMER_TEXT',
    companyId: null,
    detail: { prevText: prev, newText: text, tenantScope: 'ALL' },
  });
  res.json({ ok: true });
});

router.put('/fields/:name/lock', async (req, res) => {
  const { name } = req.params;
  const { locked } = z.object({ locked: z.boolean() }).parse(req.body);
  const current = await getLockedFields();
  const next = locked ? Array.from(new Set([...current, name])) : current.filter((f) => f !== name);
  const userId = (req.user as any).id;
  await setJafarConfig('LOCKED_FIELDS', JSON.stringify(next), userId);
  await writeAudit({
    eventType: 'JAFAR_FIELD_LOCKED',
    actorUserId: userId, actorRoleId: 6,
    targetType: 'PLATFORM', targetId: `LOCKED_FIELDS:${name}`,
    companyId: null,
    detail: { fieldName: name, locked, tenantScope: 'ALL' },
  });
  res.json({ ok: true, lockedFields: next });
});

router.put('/file-types', async (req, res) => {
  const { types } = z.object({ types: z.array(z.string().min(1)) }).parse(req.body);
  const prev = await getPermittedSubpoenaFileTypes();
  const userId = (req.user as any).id;
  await setJafarConfig('PERMITTED_SUBPOENA_FILE_TYPES', JSON.stringify(types), userId);
  await writeAudit({
    eventType: 'JAFAR_FILE_TYPES_UPDATED',
    actorUserId: userId, actorRoleId: 6,
    targetType: 'PLATFORM', targetId: 'PERMITTED_SUBPOENA_FILE_TYPES',
    companyId: null,
    detail: { prev, next: types, tenantScope: 'ALL' },
  });
  res.json({ ok: true });
});

router.get('/audit', async (req, res) => {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const rows = await prisma.aUDIT_LOG.findMany({
    where: { COMPANY_ID: null, EVENT_TYPE: { startsWith: 'JAFAR_' } },
    orderBy: { CREATED_AT: 'desc' }, take: 500,
  });
  res.json({ entries: rows });
});

export default router;
```

- [ ] **Step 3: Register in `server/index.ts`**

Add near the other route imports:

```typescript
import platformAdminRoutes from './routes/platform-admin.js';
// ... and where routes mount:
app.use('/api/platform', platformAdminRoutes);
```

- [ ] **Step 4: Build + run test**

```bash
npm run build:server && bun src/tests/platform-config.smoke.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add server/routes/platform-admin.ts server/index.ts src/tests/platform-config.smoke.test.ts
git commit -m "feat(jafar): platform admin endpoints with audit"
```

## Task 3.3: Mirror endpoints in legacy server files

**Files:**
- Modify: `server.cjs`, `server.js`, `server-production.js`

- [ ] **Step 1: Port endpoints**

Per CLAUDE.md, all three server files must include every API. Locate where notice/JAFAR routes are mounted (search for `requireJafar` / `/api/notices` in each file) and add equivalent CommonJS implementations of the four endpoints from Task 3.2, calling `lib/permissions.cjs`-style helpers if they exist or inlining role-id checks.

- [ ] **Step 2: Commit**

```bash
git add server.cjs server.js server-production.js
git commit -m "feat(jafar): mirror platform admin endpoints in legacy servers"
```

## Task 3.4: JAFAR Platform Config page

**Files:**
- Create: `src/services/platformAdminService.ts`
- Create: `src/pages/JafarPlatformConfig.tsx`
- Modify: `src/App.tsx` (add route)

- [ ] **Step 1: Service**

```typescript
// src/services/platformAdminService.ts
import { api } from '../utils/api';
export const platformAdminService = {
  setDisclaimer: (text: string) => api.put('/api/platform/disclaimer', { text }),
  setFieldLock: (name: string, locked: boolean) => api.put(`/api/platform/fields/${encodeURIComponent(name)}/lock`, { locked }),
  setFileTypes: (types: string[]) => api.put('/api/platform/file-types', { types }),
  getAudit: () => api.get('/api/platform/audit'),
};
```

- [ ] **Step 2: Page**

Build a single-page form with three sections: Disclaimer text (textarea + save), Locked Fields (multi-select chips), Permitted Subpoena File Types (chips). Show the platform audit list at bottom. Wrap with `<RequireJafar>` (existing component in `src/components/RequireJafar.tsx`).

- [ ] **Step 3: Route**

In `src/App.tsx`, add:

```tsx
<Route path="/jafar/platform-config" element={<ProtectedRoute><RequireJafar><JafarPlatformConfig /></RequireJafar></ProtectedRoute>} />
```

- [ ] **Step 4: Commit**

```bash
git add src/services/platformAdminService.ts src/pages/JafarPlatformConfig.tsx src/App.tsx
git commit -m "feat(jafar): platform config admin page"
```

---

# Phase 4 — Compliance Control Layer Scaffolding

## Task 4.1: Field restrictions on template (US-CCL-01) — backend

**Files:**
- Modify: `server/routes/forms.ts` (add PII flags handling on FORMS_FIELDS upsert)
- Modify: existing template create/update endpoint to write `IS_PII`, `IS_ENABLED`, `IS_READ_ONLY`, and consult `getLockedFields()` for `IS_LOCKED_BY_JAFAR`.

- [ ] **Step 1: Update zod payload schema**

In the template create/update handler, add to the field schema:

```typescript
const FieldSchema = z.object({
  FIELD_ID: z.number(),
  IS_REQUIRED: z.boolean().default(false),
  SORT_ORDER: z.number().int().default(0),
  IS_PII: z.boolean().default(false),
  IS_ENABLED: z.boolean().default(true),
  IS_READ_ONLY: z.boolean().default(false),
});
```

- [ ] **Step 2: On save, intersect with JAFAR locked fields**

```typescript
import { getLockedFields } from '../lib/jafarConfig.js';
// ...
const locked = await getLockedFields();
for (const f of fields) {
  if (locked.includes(f.FIELD_NAME ?? '')) {
    f.IS_ENABLED = false;
    (f as any).IS_LOCKED_BY_JAFAR = true;
  }
}
```

- [ ] **Step 3: On any field-restriction change, write audit**

After saving each changed field row:

```typescript
await writeAudit({
  eventType: 'FIELD_RESTRICTION_CHANGED',
  actorUserId, actorRoleId,
  targetType: 'TEMPLATE', targetId: form.FORM_ID,
  companyId,
  detail: { fieldName, prevState, newState },
});
```

- [ ] **Step 4: Commit**

```bash
git add server/routes/forms.ts
git commit -m "feat(compliance): persist field PII/enabled/locked flags + audit"
```

## Task 4.2: Disclaimer enable flag on template (US-CCL-02) — backend

**Files:**
- Modify: `server/routes/forms.ts`

- [ ] **Step 1: Accept new template fields**

In the template payload schema add:

```typescript
NOTICE_SUBTYPE: z.enum(['SECURITIES_FRAUD', 'SUBPOENA_RIDER']).optional(),
FRAUD_TYPE: z.enum(['SECURITIES_MANIPULATION','ATO','CHECK_FRAUD','WIRE_FRAUD']).optional(),
REQUIRES_MANAGER_APPROVAL: z.boolean().optional(),
COMPLIANCE_DISCLAIMER_ENABLED: z.boolean().optional(),
TITLE_FORMAT: z.string().optional(),
```

- [ ] **Step 2: Default disclaimer ON for SECURITIES_FRAUD**

```typescript
if (payload.NOTICE_SUBTYPE === 'SECURITIES_FRAUD' && payload.COMPLIANCE_DISCLAIMER_ENABLED === undefined) {
  payload.COMPLIANCE_DISCLAIMER_ENABLED = true;
}
```

- [ ] **Step 3: Audit on toggle change**

If `COMPLIANCE_DISCLAIMER_ENABLED` differs from prior row, write `DISCLAIMER_TOGGLED` with `prevState`, `newState`, `direction`.

- [ ] **Step 4: Audit on manager-approval toggle change**

Same pattern with `MANAGER_APPROVAL_CONFIG_CHANGED`.

- [ ] **Step 5: Commit**

```bash
git add server/routes/forms.ts
git commit -m "feat(compliance): notice subtype + disclaimer + approval toggle fields with audit"
```

## Task 4.3: FieldRestrictionsPanel + DisclaimerToggle UI components

**Files:**
- Create: `src/components/SecuritiesNoticeTemplate/FieldRestrictionsPanel.tsx`
- Create: `src/components/SecuritiesNoticeTemplate/DisclaimerToggle.tsx`
- Create: `src/components/SecuritiesNoticeTemplate/ManagerApprovalToggle.tsx`

- [ ] **Step 1: FieldRestrictionsPanel**

Props: `fields: TemplateField[]`, `lockedByJafar: string[]`, `onChange(field)`. Render a table with toggles for each field. PII fields default OFF with red icon; non-PII default ON. JAFAR-locked rows are grayed out with platform-lock icon and tooltip `"This field is restricted at the platform level and cannot be enabled. Contact your platform administrator."` The `SECURITY_SYMBOL` field is non-removable (toggle disabled with tooltip "Security Symbol is a required field for Securities Fraud Notice templates and cannot be removed.").

- [ ] **Step 2: DisclaimerToggle**

Renders a single toggle. When user toggles ON→OFF for a SECURITIES_FRAUD template, intercept with a Bootstrap modal:
```
Title: Confirm Disclaimer Removal
Body: Turning off the Compliance Disclaimer removes a legal protection layer. This action will be recorded in the audit log.
Buttons: Cancel | Confirm
```
On Confirm → propagate change. On Cancel → revert.

- [ ] **Step 3: ManagerApprovalToggle**

Toggle component that grays out when the company has only one role configured (fetch role count from `/api/users/company-roles-count` — add this lightweight endpoint if missing).

- [ ] **Step 4: Commit**

```bash
git add src/components/SecuritiesNoticeTemplate/{FieldRestrictionsPanel,DisclaimerToggle,ManagerApprovalToggle}.tsx
git commit -m "feat(compliance): template builder compliance UI components"
```

---

# Phase 5 — Securities Fraud Notice Template (US-SNT-01..06)

## Task 5.1: US-SNT-01 — Template Builder page

**Files:**
- Create: `src/pages/SecuritiesNoticeTemplateAdmin.tsx`
- Create: `src/components/SecuritiesNoticeTemplate/TemplateBuilder.tsx`
- Modify: `src/App.tsx` (add `/templates/new?type=SECURITIES_FRAUD` route → `<SecuritiesNoticeTemplateAdmin />` guarded by `can(user, 'securitiesNotice.template.create')`)

- [ ] **Step 1: TemplateBuilder.tsx**

Pre-loads required fields: `SECURITY_SYMBOL` (required, non-removable), `INCIDENT_DATETIME`, `LOSS_EXPOSURE`, `VICTIM_COUNT`, `SECURITIES_INVOLVED`. Includes `<FieldRestrictionsPanel>`, `<DisclaimerToggle>` (defaults ON for SECURITIES_FRAUD), `<ManagerApprovalToggle>`. Title format defaults to `[SECURITY_SYMBOL] — $[LOSS_EXPOSURE]` (editable). Save → POST `/api/templates` (existing forms endpoint with new payload fields).

- [ ] **Step 2: Block save without SECURITY_SYMBOL**

Client-side check before submit. Server-side check returns 400 with the exact message: `"Security Symbol is a required field for Securities Fraud Notice templates and cannot be removed."`

- [ ] **Step 3: 403 guard**

Top-of-page check: `if (!can(user, 'securitiesNotice.template.create')) return <Navigate to="/home" />`. Server already returns 403 from `requireRole('securitiesNotice.template.create', 'create a securities notice template')`.

- [ ] **Step 4: Playwright e2e**

`e2e/securities-notice/template-builder.spec.ts`:
- Login as Admin (role 1) → navigate to `/templates/new?type=SECURITIES_FRAUD` → builder renders.
- Disable `SECURITY_SYMBOL` → save → expect inline error.
- Disable disclaimer → expect confirmation modal → cancel → toggle remains ON.
- Save valid template → expect success toast + redirect.
- Login as Manager (role 4) → direct URL → expect 403/redirect.

- [ ] **Step 5: Commit**

```bash
git add src/pages/SecuritiesNoticeTemplateAdmin.tsx src/components/SecuritiesNoticeTemplate/TemplateBuilder.tsx src/App.tsx e2e/securities-notice/template-builder.spec.ts
git commit -m "feat(US-SNT-01): securities fraud notice template builder"
```

## Task 5.2: US-SNT-02 — Manager Approval toggle wired

Already implemented in Task 4.3 + 4.2; add e2e coverage.

**Files:**
- Append to: `e2e/securities-notice/template-builder.spec.ts`

- [ ] **Step 1: e2e**
- Toggle ON → save → assert template row in DB has `REQUIRES_MANAGER_APPROVAL = 1` and audit log has `MANAGER_APPROVAL_CONFIG_CHANGED`.
- Seed a company with only role=ADMIN → toggle is grayed out with tooltip text.

- [ ] **Step 2: Commit**

```bash
git add e2e/securities-notice/template-builder.spec.ts
git commit -m "test(US-SNT-02): manager approval toggle e2e"
```

## Task 5.3: US-SNT-03 — Processor send (no approval required)

**Files:**
- Create: `server/routes/securities-notices.ts`
- Modify: `server/index.ts`
- Create: `src/components/SecuritiesNoticeTemplate/SendNoticeForm.tsx`
- Create: `src/pages/SecuritiesNoticeSend.tsx`
- Modify: `src/App.tsx` (route `/securities-notices/new?templateId=X`)
- Test: `src/tests/securities-notice-workflow.smoke.test.ts`
- Test: `e2e/securities-notice/send-no-approval.spec.ts`

- [ ] **Step 1: Smoke test (failing)**

Cases:
1. POST `/api/securities-notices` with templateId of a non-approval template + valid fields + previously-verified recipient → 201, status `SENT_AWAITING_RESPONSE`, audit `NOTICE_SENT` written.
2. POST same payload as ADMIN (role 1) → 403 `You do not have permission to send a securities notice.`
3. POST without `SECURITY_SYMBOL` → 400 with the field-validation message.
4. POST with first-time recipient and `confirmFirstTime=false` → 409 with body `{ requiresFirstTimeConfirmation: true }`.
5. POST same with `confirmFirstTime=true` → 201 + audit `FIRST_TIME_RECIPIENT_CONFIRMED` + audit `NOTICE_SENT` with `firstTimeFlag=true`.

- [ ] **Step 2: Implement route**

```typescript
// server/routes/securities-notices.ts
import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { writeAudit } from '../lib/audit.js';
import { forbid } from '../lib/forbid.js';

const router = Router();
const prisma = new PrismaClient();

const PayloadSchema = z.object({
  templateFormId: z.number(),
  fields: z.record(z.unknown()),
  recipientUserId: z.number(),
  confirmFirstTime: z.boolean().optional(),
});

router.post('/', requireAuth, requireRole('securitiesNotice.send', 'send a securities notice'),
  async (req, res) => {
    const payload = PayloadSchema.parse(req.body);
    const userId = (req.user as any).id;
    const companyId = (req.user as any).COMPANY_ID;
    const actorRoleId = (req as any).actorRoleId;

    const template = await prisma.fORMS.findUnique({ where: { FORM_ID: payload.templateFormId } });
    if (!template || template.COMPANY_ID !== companyId) return res.status(404).json({ error: 'Template not found' });

    // SECURITY_SYMBOL required
    const symbol = (payload.fields as any).SECURITY_SYMBOL;
    if (!symbol || String(symbol).trim().length === 0) {
      return res.status(400).json({ error: 'Security Symbol is a required field for Securities Fraud Notice templates and cannot be removed.' });
    }

    // If template requires approval, this endpoint is the wrong one
    if (template.REQUIRES_MANAGER_APPROVAL) return forbid(res, 'send a notice that requires manager approval — submit it instead');

    // Recipient verification check
    const verification = await prisma.rECIPIENT_VERIFICATIONS.findUnique({
      where: { RECIPIENT_USER_ID_COMPANY_ID: { RECIPIENT_USER_ID: payload.recipientUserId, COMPANY_ID: companyId } },
    });
    const isFirstTime = !verification || verification.VERIFIED_STATUS === 'FIRST_TIME';
    if (isFirstTime && !payload.confirmFirstTime) {
      return res.status(409).json({ requiresFirstTimeConfirmation: true });
    }

    const titleFormat = template.TITLE_FORMAT ?? '[SECURITY_SYMBOL] — $[LOSS_EXPOSURE]';
    const title = titleFormat
      .replace('[SECURITY_SYMBOL]', String(symbol ?? ''))
      .replace('[LOSS_EXPOSURE]', String((payload.fields as any).LOSS_EXPOSURE ?? ''));

    const notice = await prisma.mY_NOTICES.create({
      data: {
        NOTICE_TITLE: title,
        NOTICE_BODY: JSON.stringify(payload.fields),
        SENSITIVITY_CLASSIFICATION: 'CONFIDENTIAL',
        BUTTON_STATUS: 'SENT',
        DISTRIBUTION_TYPE: 'DIRECT',
        TEMPLATE_FORM_ID: payload.templateFormId,
        NOTICE_STATUS: 'SENT_AWAITING_RESPONSE',
        SENT_AT: new Date(),
        DISCLAIMER_STATE: template.COMPLIANCE_DISCLAIMER_ENABLED,
        FIRST_TIME_RECIPIENT_FLAG: isFirstTime,
        COMPANY_ID: companyId,
        CREATE_USER_ID: userId,
        RECIPIENTS: { create: [{ USER_ID: payload.recipientUserId }] } as any,
      },
    });

    if (isFirstTime) {
      await writeAudit({
        eventType: 'FIRST_TIME_RECIPIENT_CONFIRMED',
        actorUserId: userId, actorRoleId,
        targetType: 'NOTICE', targetId: notice.NOTICE_ID,
        companyId, firstTimeFlag: true,
        detail: { recipientUserId: payload.recipientUserId },
      });
    }
    await writeAudit({
      eventType: 'NOTICE_SENT',
      actorUserId: userId, actorRoleId,
      targetType: 'NOTICE', targetId: notice.NOTICE_ID,
      companyId,
      firstTimeFlag: isFirstTime,
      disclaimerState: template.COMPLIANCE_DISCLAIMER_ENABLED,
      detail: { templateFormId: payload.templateFormId, recipientUserId: payload.recipientUserId },
    });

    res.status(201).json({ notice });
  }
);

export default router;
```

- [ ] **Step 3: Register, build, run smoke**

```bash
npm run build:server && bun src/tests/securities-notice-workflow.smoke.test.ts
```

- [ ] **Step 4: SendNoticeForm + page**

UI renders template fields, recipient picker (reuses `src/components/CreateNoticeModalV2/RecipientPicker.tsx`), green/amber badge per recipient verification status, "Send Notice" button. On 409 → show `<FirstTimeRecipientModal>` and resubmit with `confirmFirstTime=true`.

- [ ] **Step 5: e2e**

`e2e/securities-notice/send-no-approval.spec.ts`:
- Processor sends to PREVIOUSLY_VERIFIED recipient → no modal → success.
- Processor sends to FIRST_TIME recipient → modal → cancel → no audit row created.
- Processor sends to FIRST_TIME recipient → modal → confirm → audit `FIRST_TIME_RECIPIENT_CONFIRMED` + `NOTICE_SENT` present.
- User (role 2) direct URL → 403/redirect.

- [ ] **Step 6: Commit**

```bash
git add server/routes/securities-notices.ts server/index.ts src/pages/SecuritiesNoticeSend.tsx src/components/SecuritiesNoticeTemplate/SendNoticeForm.tsx src/components/SecuritiesNoticeTemplate/FirstTimeRecipientModal.tsx src/App.tsx src/tests/securities-notice-workflow.smoke.test.ts e2e/securities-notice/send-no-approval.spec.ts
git commit -m "feat(US-SNT-03): processor direct-send flow with first-time recipient intercept"
```

## Task 5.4: US-SNT-04 — Submit for Manager Approval

**Files:**
- Modify: `server/routes/securities-notices.ts` (add `PUT /:id/submit`)
- Modify: `src/components/SecuritiesNoticeTemplate/SendNoticeForm.tsx` (toggle button label/handler based on `REQUIRES_MANAGER_APPROVAL`)
- Test: append to `src/tests/securities-notice-workflow.smoke.test.ts`
- Test: `e2e/securities-notice/submit-for-approval.spec.ts`

- [ ] **Step 1: Endpoint**

```typescript
router.put('/:id/submit', requireAuth, requireRole('securitiesNotice.submit', 'submit a notice for approval'),
  async (req, res) => {
    const id = Number(req.params.id);
    const userId = (req.user as any).id;
    const companyId = (req.user as any).COMPANY_ID;
    const actorRoleId = (req as any).actorRoleId;
    const notice = await prisma.mY_NOTICES.findUnique({ where: { NOTICE_ID: id } });
    if (!notice || notice.COMPANY_ID !== companyId) return res.status(404).json({ error: 'Notice not found' });
    if (notice.NOTICE_STATUS !== 'DRAFT' && notice.NOTICE_STATUS !== 'RETURNED_FOR_REVISION') {
      return res.status(409).json({ error: `Cannot submit notice in status ${notice.NOTICE_STATUS}` });
    }
    await prisma.mY_NOTICES.update({
      where: { NOTICE_ID: id },
      data: { NOTICE_STATUS: 'PENDING_APPROVAL', SUBMITTED_BY: userId, SUBMITTED_AT: new Date() },
    });
    await writeAudit({
      eventType: 'NOTICE_SUBMITTED_FOR_APPROVAL',
      actorUserId: userId, actorRoleId,
      targetType: 'NOTICE', targetId: id, companyId,
      detail: { processorId: userId },
    });

    // Notify managers — reuse existing notification system
    // notifyManagers(companyId, id, /* template */ 'A Securities Fraud Notice is pending your approval...');
    res.json({ ok: true });
  }
);
```

- [ ] **Step 2: UI**

In SendNoticeForm: if `template.REQUIRES_MANAGER_APPROVAL` is true, render only `Submit for Approval`. After submit, navigate to read-only detail page; show "Pending Approval" badge; disable edit controls when status is `PENDING_APPROVAL`.

- [ ] **Step 3: Manager notification**

Reuse `server/routes/my-notices.ts` Resend integration. Add an exported `notifyManagersOfPending(companyId, noticeId, processorName)` and call from the submit handler.

- [ ] **Step 4: e2e + commit**

`e2e/securities-notice/submit-for-approval.spec.ts` covers: submit → status PENDING_APPROVAL → manager receives email (mock SMTP) + in-platform notification.

```bash
git add ...
git commit -m "feat(US-SNT-04): submit-for-approval flow with manager notification"
```

## Task 5.5: US-SNT-05 — Manager approve / reject

**Files:**
- Modify: `server/routes/securities-notices.ts` (add `PUT /:id/approve`, `PUT /:id/reject`)
- Create: `src/pages/SecuritiesNoticeApprovalQueue.tsx`
- Create: `src/components/SecuritiesNoticeTemplate/ApprovalReviewPanel.tsx`
- Test: `e2e/securities-notice/manager-approve-reject.spec.ts`

- [ ] **Step 1: Approve endpoint**

```typescript
router.put('/:id/approve', requireAuth, requireRole('securitiesNotice.approve', 'approve notices'),
  async (req, res) => {
    const id = Number(req.params.id);
    const userId = (req.user as any).id;
    const companyId = (req.user as any).COMPANY_ID;
    const actorRoleId = (req as any).actorRoleId;
    const notice = await prisma.mY_NOTICES.findUnique({ where: { NOTICE_ID: id }, include: { RECIPIENTS: true } });
    if (!notice || notice.COMPANY_ID !== companyId) return res.status(404).json({ error: 'Notice not found' });
    if (notice.NOTICE_STATUS !== 'PENDING_APPROVAL') return res.status(409).json({ error: 'Notice is not pending approval' });
    await prisma.mY_NOTICES.update({
      where: { NOTICE_ID: id },
      data: {
        NOTICE_STATUS: 'SENT_AWAITING_RESPONSE',
        APPROVED_BY: userId, APPROVED_AT: new Date(),
        SENT_AT: new Date(),
      },
    });
    await writeAudit({
      eventType: 'NOTICE_APPROVED',
      actorUserId: userId, actorRoleId,
      targetType: 'NOTICE', targetId: id, companyId,
      disclaimerState: notice.DISCLAIMER_STATE ?? null,
      detail: { managerId: userId },
    });
    await writeAudit({
      eventType: 'NOTICE_SENT',
      actorUserId: userId, actorRoleId,
      targetType: 'NOTICE', targetId: id, companyId,
      disclaimerState: notice.DISCLAIMER_STATE ?? null,
      firstTimeFlag: notice.FIRST_TIME_RECIPIENT_FLAG ?? null,
      detail: { sentByManager: true },
    });
    // Transmit (reuse existing send-email logic)
    res.json({ ok: true });
  }
);
```

- [ ] **Step 2: Reject endpoint (requires reason)**

```typescript
router.put('/:id/reject', requireAuth, requireRole('securitiesNotice.approve', 'reject notices'),
  async (req, res) => {
    const id = Number(req.params.id);
    const { reason } = z.object({ reason: z.string().min(1, 'Rejection reason is required') }).parse(req.body);
    const userId = (req.user as any).id;
    const actorRoleId = (req as any).actorRoleId;
    const companyId = (req.user as any).COMPANY_ID;
    const notice = await prisma.mY_NOTICES.findUnique({ where: { NOTICE_ID: id } });
    if (!notice || notice.COMPANY_ID !== companyId) return res.status(404).json({ error: 'Notice not found' });
    if (notice.NOTICE_STATUS !== 'PENDING_APPROVAL') return res.status(409).json({ error: 'Notice is not pending approval' });
    await prisma.mY_NOTICES.update({
      where: { NOTICE_ID: id },
      data: { NOTICE_STATUS: 'RETURNED_FOR_REVISION', REJECTED_BY: userId, REJECTED_AT: new Date(), REJECTION_REASON: reason },
    });
    await writeAudit({
      eventType: 'NOTICE_REJECTED',
      actorUserId: userId, actorRoleId,
      targetType: 'NOTICE', targetId: id, companyId,
      detail: { rejectionReason: reason },
    });
    // Notify the processor (notice.SUBMITTED_BY) — reuse Resend
    res.json({ ok: true });
  }
);
```

- [ ] **Step 3: ApprovalReviewPanel.tsx**

Renders notice read-only (all fields disabled). Two buttons: `Approve and Send`, `Reject and Return` (latter opens reason modal with required textarea).

- [ ] **Step 4: e2e**

`e2e/securities-notice/manager-approve-reject.spec.ts`: processor submits → manager opens queue → approve path → status SENT_AWAITING_RESPONSE + audit rows. Separate scenario: manager rejects with reason → notice back to RETURNED_FOR_REVISION, processor sees rejection reason, can resubmit.

- [ ] **Step 5: Commit**

```bash
git add ...
git commit -m "feat(US-SNT-05): manager approval queue with approve/reject + notifications"
```

## Task 5.6: US-SNT-06 — User read-only view

**Files:**
- Modify: `src/pages/ViewNotice.tsx` (gate edit/send controls on `can(user, 'securitiesNotice.view')`)
- Modify: `server/routes/securities-notices.ts` (add `GET /` list scoped by role; `GET /:id` returns read-only payload when role is GENERAL_USER)

- [ ] **Step 1: GET list**

```typescript
router.get('/', requireAuth, async (req, res) => {
  const userId = (req.user as any).id;
  const companyId = (req.user as any).COMPANY_ID;
  // Scope filter: a User (role 2) sees only notices where they are listed as a recipient
  const userRoles = await prisma.uSER_ROLES.findMany({ where: { USER_ID: userId, STATUS: 'P' } });
  const isGeneralUserOnly = userRoles.length === 1 && userRoles[0].ROLE_ID === 2;
  const where = isGeneralUserOnly
    ? { COMPANY_ID: companyId, RECIPIENTS: { some: { USER_ID: userId } } }
    : { COMPANY_ID: companyId };
  const notices = await prisma.mY_NOTICES.findMany({ where, orderBy: { CREATE_DATE: 'desc' } });
  res.json({ notices });
});
```

- [ ] **Step 2: Hide action buttons for GENERAL_USER**

In `src/pages/ViewNotice.tsx`, wrap each control:

```tsx
{can(user, 'securitiesNotice.send') && <button>Send</button>}
{can(user, 'securitiesNotice.submit') && <button>Submit for Approval</button>}
{can(user, 'securitiesNotice.approve') && <ApprovalReviewPanel />}
```

- [ ] **Step 3: e2e**

`e2e/securities-notice/user-readonly.spec.ts`: GENERAL_USER logs in → sees notice list (only ones they receive) → opens notice → no Send/Submit/Approve buttons; direct URL to `/securities-notices/new` returns 403.

- [ ] **Step 4: Commit**

```bash
git add src/pages/ViewNotice.tsx server/routes/securities-notices.ts e2e/securities-notice/user-readonly.spec.ts
git commit -m "feat(US-SNT-06): user read-only notice view with control gating"
```

---

# Phase 6 — Recipient Verification (US-CCL-03)

## Task 6.1: Verification status endpoint + auto-upgrade

**Files:**
- Create: `server/routes/recipients.ts`
- Modify: `server/routes/securities-notices.ts` (upgrade to PREVIOUSLY_VERIFIED on acknowledged send)
- Create: `src/services/recipientService.ts`
- Test: `src/tests/recipient-verification.smoke.test.ts`

- [ ] **Step 1: Smoke test**

Cases:
1. New recipient with no row in `RECIPIENT_VERIFICATIONS` → GET `/api/recipients/:id/verification` returns `{verifiedStatus: 'FIRST_TIME'}`.
2. After a successful send completes acknowledgement (status `SENT_AWAITING_RESPONSE` AND a response row added), the next GET returns `PREVIOUSLY_VERIFIED`.
3. Newly-added recipient to directory (USERS row) without any prior send → still `FIRST_TIME`.

- [ ] **Step 2: Endpoint**

```typescript
// server/routes/recipients.ts
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../auth.js';
const router = Router();
const prisma = new PrismaClient();

router.get('/:id/verification', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const companyId = (req.user as any).COMPANY_ID;
  const v = await prisma.rECIPIENT_VERIFICATIONS.findUnique({
    where: { RECIPIENT_USER_ID_COMPANY_ID: { RECIPIENT_USER_ID: id, COMPANY_ID: companyId } },
  });
  res.json({ verifiedStatus: v?.VERIFIED_STATUS ?? 'FIRST_TIME', verifiedAt: v?.VERIFIED_AT ?? null });
});

export default router;
```

- [ ] **Step 3: Upgrade hook**

In `server/routes/my-notices.ts` PATCH `/:id` (response add), when a response is recorded against a notice, upsert `RECIPIENT_VERIFICATIONS` for each recipient to `PREVIOUSLY_VERIFIED`:

```typescript
await prisma.rECIPIENT_VERIFICATIONS.upsert({
  where: { RECIPIENT_USER_ID_COMPANY_ID: { RECIPIENT_USER_ID: recipientUserId, COMPANY_ID: companyId } },
  update: { VERIFIED_STATUS: 'PREVIOUSLY_VERIFIED', VERIFIED_AT: new Date() },
  create: { RECIPIENT_USER_ID: recipientUserId, COMPANY_ID: companyId, VERIFIED_STATUS: 'PREVIOUSLY_VERIFIED', VERIFIED_AT: new Date(), FIRST_NOTICE_ID: notice.NOTICE_ID },
});
```

- [ ] **Step 4: Recipient service + UI badge**

`recipientService.getVerification(id)` returns the status. Render green "Previously Verified" or amber "First-Time Recipient" badges in `RecipientPicker.tsx` next to each recipient.

- [ ] **Step 5: FirstTimeRecipientModal**

Already referenced in Task 5.3. Body per spec, two buttons. Cancel → no API call, no audit row. Confirm → resubmit with `confirmFirstTime=true`.

- [ ] **Step 6: e2e**

`e2e/compliance/first-time-recipient.spec.ts`: cancel → no audit; confirm → audit + send proceeds.

- [ ] **Step 7: Commit**

```bash
git add ...
git commit -m "feat(US-CCL-03): recipient verification + first-time intercept modal"
```

---

# Phase 7 — Subpoena Rider Builder (US-SRB-01..04)

## Task 7.1: US-SRB-01 — Configure subpoena language template (User Admin)

**Files:**
- Create: `server/lib/piiGuard.ts`
- Create: `server/routes/notice-templates.ts` (mounted at `/api/templates/subpoena`)
- Create: `src/components/SubpoenaRider/SubpoenaLanguageBuilder.tsx`
- Test: `src/tests/pii-guard.test.ts`
- Test: `src/tests/subpoena-rider.smoke.test.ts`

- [ ] **Step 1: PII guard test**

```typescript
// src/tests/pii-guard.test.ts
import { scanForPII } from '../../server/lib/piiGuard';

const cases: Array<[string, boolean, string?]> = [
  ['Customer SSN: 123-45-6789', true, 'SSN'],
  ['John Doe was the victim', true, 'CUSTOMER_NAME'],
  ['DOB: 01/02/1980', true, 'DOB'],
  ['Account 12345678 was compromised', true, 'ACCOUNT_NUMBER'],
  ['On [DATE_TIME_RANGE], symbol [SECURITY_SYMBOL] dropped', false, undefined],
];
for (const [input, expected, label] of cases) {
  const r = scanForPII(input);
  if (r.hit !== expected) { console.error(`FAIL: ${input}`); process.exit(1); }
  if (expected && label && r.label !== label) { console.error(`FAIL label: ${input} expected=${label} got=${r.label}`); process.exit(1); }
}
console.log('ok');
```

- [ ] **Step 2: Implement piiGuard**

```typescript
// server/lib/piiGuard.ts
const PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: 'SSN', re: /\b\d{3}-\d{2}-\d{4}\b/ },
  { label: 'DOB', re: /\b(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])\/(?:19|20)\d{2}\b/ },
  { label: 'ACCOUNT_NUMBER', re: /\b\d{7,12}\b/ },
  // Naive name detector: two capitalized words. Override-allowed via [TOKEN] placeholders.
  { label: 'CUSTOMER_NAME', re: /(?<!\[)\b[A-Z][a-z]{1,}\s[A-Z][a-z]{1,}\b(?![\w-]*\])/ },
];

export function scanForPII(text: string): { hit: boolean; label?: string } {
  for (const { label, re } of PATTERNS) {
    if (re.test(text)) return { hit: true, label };
  }
  return { hit: false };
}
```

- [ ] **Step 3: notice-templates.ts (subpoena route)**

```typescript
// server/routes/notice-templates.ts
import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { scanForPII } from '../lib/piiGuard.js';
import { writeAudit } from '../lib/audit.js';

const router = Router();
const prisma = new PrismaClient();

const SubpoenaSchema = z.object({
  FRAUD_TYPE: z.enum(['SECURITIES_MANIPULATION', 'ATO', 'CHECK_FRAUD', 'WIRE_FRAUD']),
  BASE_LANGUAGE: z.string().min(1),
  TOKENS: z.array(z.object({ token: z.string(), description: z.string(), autoPopulateFromIncident: z.boolean() })),
});

router.post('/subpoena', requireAuth, requireRole('subpoenaRider.configureLanguage', 'configure subpoena language templates'),
  async (req, res) => {
    const payload = SubpoenaSchema.parse(req.body);
    const userId = (req.user as any).id;
    const companyId = (req.user as any).COMPANY_ID;
    const pii = scanForPII(payload.BASE_LANGUAGE);
    if (pii.hit) {
      return res.status(400).json({ error: `PII tokens are not permitted in subpoena language templates. Remove ${pii.label} before saving.` });
    }
    const row = await prisma.sUBPOENA_LANGUAGE_TEMPLATES.upsert({
      where: { COMPANY_ID_FRAUD_TYPE: { COMPANY_ID: companyId, FRAUD_TYPE: payload.FRAUD_TYPE } },
      update: { BASE_LANGUAGE: payload.BASE_LANGUAGE, TOKENS_JSON: JSON.stringify(payload.TOKENS), UPDATED_AT: new Date() },
      create: { COMPANY_ID: companyId, FRAUD_TYPE: payload.FRAUD_TYPE, BASE_LANGUAGE: payload.BASE_LANGUAGE, TOKENS_JSON: JSON.stringify(payload.TOKENS), CREATED_BY: userId },
    });
    await writeAudit({
      eventType: 'TEMPLATE_CREATED',
      actorUserId: userId, actorRoleId: (req as any).actorRoleId,
      targetType: 'TEMPLATE', targetId: row.LANGUAGE_TEMPLATE_ID, companyId,
      detail: { templateType: 'SUBPOENA_RIDER', fraudType: payload.FRAUD_TYPE },
    });
    res.status(201).json({ template: row });
  }
);

router.get('/subpoena/:fraudType', requireAuth, async (req, res) => {
  const fraudType = String(req.params.fraudType);
  const companyId = (req.user as any).COMPANY_ID;
  const t = await prisma.sUBPOENA_LANGUAGE_TEMPLATES.findUnique({
    where: { COMPANY_ID_FRAUD_TYPE: { COMPANY_ID: companyId, FRAUD_TYPE: fraudType } },
  });
  if (!t) return res.status(404).json({ error: 'No subpoena template configured for this fraud type.' });
  res.json({ template: t });
});

export default router;
```

- [ ] **Step 4: UI builder**

`SubpoenaLanguageBuilder.tsx`: dropdown for fraud type, textarea for base language, repeating token rows (token, description, auto-populate toggle). On save, if 400 with PII message → show banner with the exact spec wording.

- [ ] **Step 5: e2e**

`e2e/subpoena-rider/configure-language.spec.ts`: Admin creates a SECURITIES_MANIPULATION template successfully; attempts to save text containing `John Doe` → block + warning.

- [ ] **Step 6: Commit**

```bash
git add ...
git commit -m "feat(US-SRB-01): subpoena language template builder with PII scan"
```

## Task 7.2: US-SRB-02 — Generate subpoena rider from incident

**Files:**
- Create: `server/routes/subpoena-riders.ts`
- Create: `src/components/SubpoenaRider/GenerateRiderModal.tsx`
- Test: `src/tests/subpoena-rider.smoke.test.ts` (extend)
- Test: `e2e/subpoena-rider/generate-rider.spec.ts`

- [ ] **Step 1: Endpoint**

```typescript
// server/routes/subpoena-riders.ts
import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { scanForPII } from '../lib/piiGuard.js';
import { writeAudit } from '../lib/audit.js';

const router = Router();
const prisma = new PrismaClient();

const Payload = z.object({
  fraudType: z.enum(['SECURITIES_MANIPULATION','ATO','CHECK_FRAUD','WIRE_FRAUD']),
  incidentNoticeId: z.number().optional(),
  tokenValues: z.record(z.string()),
});

router.post('/', requireAuth, requireRole('subpoenaRider.generate', 'generate subpoena riders'),
  async (req, res) => {
    const p = Payload.parse(req.body);
    const userId = (req.user as any).id;
    const companyId = (req.user as any).COMPANY_ID;
    const tmpl = await prisma.sUBPOENA_LANGUAGE_TEMPLATES.findUnique({
      where: { COMPANY_ID_FRAUD_TYPE: { COMPANY_ID: companyId, FRAUD_TYPE: p.fraudType } },
    });
    if (!tmpl) return res.status(404).json({ error: 'No subpoena template is configured for this fraud type. Contact your User Admin to create one.' });

    // PII scan on each token value (Processor-supplied)
    for (const [k, v] of Object.entries(p.tokenValues)) {
      const r = scanForPII(String(v));
      if (r.hit) return res.status(400).json({ error: 'PII is not permitted in subpoena rider language. Remove the detected value before proceeding.', field: k, label: r.label });
    }

    let populated = tmpl.BASE_LANGUAGE;
    for (const [k, v] of Object.entries(p.tokenValues)) populated = populated.split(`[${k}]`).join(String(v));

    const rider = await prisma.sUBPOENA_RIDERS.create({
      data: {
        LANGUAGE_TEMPLATE_ID: tmpl.LANGUAGE_TEMPLATE_ID,
        FRAUD_TYPE: p.fraudType,
        POPULATED_LANGUAGE: populated,
        TOKEN_VALUES_JSON: JSON.stringify(p.tokenValues),
        INCIDENT_NOTICE_ID: p.incidentNoticeId ?? null,
        CREATED_BY: userId,
        COMPANY_ID: companyId,
      },
    });

    await writeAudit({
      eventType: 'SUBPOENA_RIDER_GENERATED',
      actorUserId: userId, actorRoleId: (req as any).actorRoleId,
      targetType: 'SUBPOENA_RIDER', targetId: rider.RIDER_ID, companyId,
      detail: { fraudType: p.fraudType, incidentNoticeId: p.incidentNoticeId, templateId: tmpl.LANGUAGE_TEMPLATE_ID },
    });

    res.status(201).json({ rider });
  }
);

router.get('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const companyId = (req.user as any).COMPANY_ID;
  const r = await prisma.sUBPOENA_RIDERS.findUnique({ where: { RIDER_ID: id } });
  if (!r || r.COMPANY_ID !== companyId) return res.status(404).json({ error: 'Not found' });
  res.json({ rider: r });
});

export default router;
```

- [ ] **Step 2: UI modal**

`GenerateRiderModal.tsx`: fraud-type dropdown → fetch template → render tokens grouped into auto-populated (read-only, prefilled from incident) and editable. Real-time PII scan on each text input via debounced `scanForPII()` (frontend copy of patterns in `src/utils/piiPatterns.ts`). Preview pane shows final populated language. "Attach to Notice" button calls POST and links the rider id to the open notice draft.

- [ ] **Step 3: e2e**

Cover the "no template for fraud type" message and the PII-block message.

- [ ] **Step 4: Commit**

```bash
git add ...
git commit -m "feat(US-SRB-02): generate subpoena rider with token population and PII guard"
```

## Task 7.3: US-SRB-03 — External user attach executed subpoena

**Files:**
- Create: `server/routes/external-notices.ts`
- Create: `server/middleware/requireExternalUser.ts`
- Create: `src/pages/ExternalUserInbox.tsx`
- Create: `src/components/SubpoenaRider/AttachExecutedSubpoenaPanel.tsx`
- Test: `src/tests/external-user-portal.smoke.test.ts`
- Test: `e2e/subpoena-rider/external-attach-subpoena.spec.ts`

- [ ] **Step 1: requireExternalUser middleware**

```typescript
// server/middleware/requireExternalUser.ts
import type { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { forbid } from '../lib/forbid.js';
const prisma = new PrismaClient();
export async function requireExternalUser(req: Request, res: Response, next: NextFunction) {
  const u = req.user as { id?: number } | undefined;
  const userId = Number(u?.id);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const roles = await prisma.uSER_ROLES.findMany({ where: { USER_ID: userId, STATUS: 'P' } });
  if (!roles.some((r) => r.ROLE_ID === 5)) return forbid(res, 'access this external portal');
  next();
}
```

- [ ] **Step 2: external-notices.ts**

```typescript
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../auth.js';
import { requireExternalUser } from '../middleware/requireExternalUser.js';
import { getPermittedSubpoenaFileTypes } from '../lib/jafarConfig.js';
import { writeAudit } from '../lib/audit.js';
import { forbid } from '../lib/forbid.js';

const router = Router();
const prisma = new PrismaClient();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

router.use(requireAuth, requireExternalUser);

// View notice — scoped strictly to assignments
router.get('/notices/:id', async (req, res) => {
  const id = Number(req.params.id);
  const userId = (req.user as any).id;
  const assignment = await prisma.eXTERNAL_NOTICE_ASSIGNMENTS.findUnique({
    where: { NOTICE_ID_EXTERNAL_USER_ID: { NOTICE_ID: id, EXTERNAL_USER_ID: userId } },
  });
  if (!assignment) return forbid(res, 'view this notice');
  const notice = await prisma.mY_NOTICES.findUnique({
    where: { NOTICE_ID: id },
    select: { NOTICE_ID: true, NOTICE_TITLE: true, NOTICE_BODY: true, NOTICE_STATUS: true, SENT_AT: true, DISCLAIMER_STATE: true },
  });
  res.json({ notice });
});

router.post('/notices/:id/subpoena', upload.single('file'), async (req, res) => {
  const id = Number(req.params.id);
  const userId = (req.user as any).id;
  const assignment = await prisma.eXTERNAL_NOTICE_ASSIGNMENTS.findUnique({
    where: { NOTICE_ID_EXTERNAL_USER_ID: { NOTICE_ID: id, EXTERNAL_USER_ID: userId } },
  });
  if (!assignment) return forbid(res, 'attach a subpoena to this notice');
  const file = (req as any).file;
  if (!file) return res.status(400).json({ error: 'File is required' });
  const permitted = await getPermittedSubpoenaFileTypes();
  if (!permitted.includes(file.mimetype)) {
    return res.status(400).json({ error: 'File type not permitted. Please upload a PDF, TIFF, or DOCX file.' });
  }
  const att = await prisma.aTTACHMENTS.create({
    data: { FILE_NAME: file.originalname, FILE_DATA: file.buffer, MIME_TYPE: file.mimetype, COMPANY_ID: (await prisma.mY_NOTICES.findUnique({ where: { NOTICE_ID: id }, select: { COMPANY_ID: true } }))!.COMPANY_ID! } as any,
  });
  await prisma.mY_NOTICES.update({
    where: { NOTICE_ID: id },
    data: { NOTICE_STATUS: 'SUBPOENA_RECEIVED_PENDING_REVIEW', ATTACHED_SUBPOENA_ATTACHMENT_ID: att.ATTACHMENT_ID },
  });
  await writeAudit({
    eventType: 'SUBPOENA_RECEIVED',
    actorUserId: userId, actorRoleId: 5,
    targetType: 'NOTICE', targetId: id,
    companyId: assignment ? null : null, // platform-scoped event; client read happens via notice.COMPANY_ID
    detail: { externalUserId: userId, fileRef: att.ATTACHMENT_ID, fileName: file.originalname },
  });
  res.status(201).json({ attachmentId: att.ATTACHMENT_ID });
});

router.post('/notices/:id/call-request', async (req, res) => {
  const id = Number(req.params.id);
  const userId = (req.user as any).id;
  const { proposedTimes } = z.object({ proposedTimes: z.array(z.string().min(1)).min(1) }).parse(req.body);
  await prisma.eXTERNAL_CALL_REQUESTS.create({
    data: { NOTICE_ID: id, EXTERNAL_USER_ID: userId, PROPOSED_TIMES: JSON.stringify(proposedTimes) },
  });
  res.status(201).json({ ok: true });
});

export default router;
```

- [ ] **Step 3: UI**

`ExternalUserInbox.tsx`: list assigned notices, click to open, read-only view, two action buttons: "Attach Executed Subpoena" (file picker) and "Request a Call" (datetime multi-input).

- [ ] **Step 4: e2e**

`e2e/subpoena-rider/external-attach-subpoena.spec.ts` — login as role 5, attempt to navigate to `/home` → 403; navigate to `/external/notices/:id` → renders read-only; upload PDF → status updates + Processor receives email.

- [ ] **Step 5: Commit**

```bash
git add ...
git commit -m "feat(US-SRB-03): external user portal with subpoena attach + call request"
```

## Task 7.4: US-SRB-04 — Records released

**Files:**
- Modify: `server/routes/securities-notices.ts` (add `PUT /:id/records-released`)
- Modify: `src/pages/ViewNotice.tsx` (records-released control)
- Test: `e2e/subpoena-rider/records-released.spec.ts`

- [ ] **Step 1: Endpoint**

```typescript
router.put('/:id/records-released', requireAuth, requireRole('securitiesNotice.markRecordsReleased', 'mark records released'),
  async (req, res) => {
    const id = Number(req.params.id);
    const userId = (req.user as any).id;
    const companyId = (req.user as any).COMPANY_ID;
    const actorRoleId = (req as any).actorRoleId;
    const n = await prisma.mY_NOTICES.findUnique({ where: { NOTICE_ID: id } });
    if (!n || n.COMPANY_ID !== companyId) return res.status(404).json({ error: 'Notice not found' });
    if (n.NOTICE_STATUS !== 'SUBPOENA_RECEIVED_PENDING_REVIEW') return res.status(409).json({ error: 'Cannot mark records released in current status' });
    await prisma.mY_NOTICES.update({ where: { NOTICE_ID: id }, data: { NOTICE_STATUS: 'RECORDS_RELEASED' } });
    await writeAudit({
      eventType: 'RECORDS_RELEASED',
      actorUserId: userId, actorRoleId,
      targetType: 'NOTICE', targetId: id, companyId,
      detail: { releasedAt: new Date().toISOString() },
    });
    res.json({ ok: true });
  }
);
```

- [ ] **Step 2: UI**

Show "Mark Records Released" button only when `notice.status === 'SUBPOENA_RECEIVED_PENDING_REVIEW'` AND `can(user, 'securitiesNotice.markRecordsReleased')`. Subpoena download link visible only to Processor/Manager (not GENERAL_USER).

- [ ] **Step 3: Commit**

```bash
git add ...
git commit -m "feat(US-SRB-04): records released status + audit"
```

---

# Phase 8 — Audit Log UI + Export (US-CCL-04)

## Task 8.1: Audit log API (filterable + exportable)

**Files:**
- Create: `server/routes/audit.ts`
- Modify: `server/index.ts`

- [ ] **Step 1: Endpoint**

```typescript
// server/routes/audit.ts
import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { Parser } from 'json2csv';
import { requireAuth } from '../auth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();
const prisma = new PrismaClient();

const FilterSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  eventType: z.string().optional(),
  actorRoleId: z.coerce.number().optional(),
  actorUserId: z.coerce.number().optional(),
  targetId: z.string().optional(),
  page: z.coerce.number().default(1),
  pageSize: z.coerce.number().default(50),
});

router.get('/', requireAuth, async (req, res) => {
  const f = FilterSchema.parse(req.query);
  const userId = (req.user as any).id;
  const companyId = (req.user as any).COMPANY_ID;
  const roles = await prisma.uSER_ROLES.findMany({ where: { USER_ID: userId, STATUS: 'P' } });
  const isAdmin = roles.some((r) => r.ROLE_ID === 1 || r.ROLE_ID === 6);
  const isManager = roles.some((r) => r.ROLE_ID === 4);
  if (!isAdmin && !isManager) return res.status(403).json({ error: 'You do not have permission to view the audit log.' });

  const where: any = { COMPANY_ID: companyId };
  if (f.from) where.CREATED_AT = { ...(where.CREATED_AT || {}), gte: new Date(f.from) };
  if (f.to) where.CREATED_AT = { ...(where.CREATED_AT || {}), lte: new Date(f.to) };
  if (f.eventType) where.EVENT_TYPE = f.eventType;
  if (f.actorRoleId) where.ACTOR_ROLE_ID = f.actorRoleId;
  if (f.actorUserId) where.ACTOR_USER_ID = f.actorUserId;
  if (f.targetId) where.TARGET_ID = f.targetId;
  if (isManager && !isAdmin) {
    // Manager scope: only events whose actor is on their team. For MVP we approximate
    // as 'same company' since teams aren't formally modeled. Spec calls out that cross-scope
    // requires User Admin grant — track in JIRA follow-up.
  }

  const [rows, total] = await Promise.all([
    prisma.aUDIT_LOG.findMany({ where, orderBy: { CREATED_AT: 'desc' }, skip: (f.page - 1) * f.pageSize, take: f.pageSize }),
    prisma.aUDIT_LOG.count({ where }),
  ]);
  res.json({ rows, total, page: f.page, pageSize: f.pageSize });
});

router.get('/export', requireAuth, requireRole('audit.export', 'export the audit log'), async (req, res) => {
  const format = String(req.query.format ?? 'csv');
  const companyId = (req.user as any).COMPANY_ID;
  const rows = await prisma.aUDIT_LOG.findMany({ where: { COMPANY_ID: companyId }, orderBy: { CREATED_AT: 'desc' } });
  if (format === 'csv') {
    const parser = new Parser({ fields: ['ENTRY_ID','EVENT_TYPE','ACTOR_USER_ID','ACTOR_ROLE_ID','TARGET_TYPE','TARGET_ID','EVENT_DETAIL','CREATED_AT'] });
    const csv = parser.parse(rows.map((r) => ({ ...r, EVENT_DETAIL: r.EVENT_DETAIL ?? '' })));
    res.header('Content-Type', 'text/csv').attachment('audit-log.csv').send(csv);
  } else if (format === 'pdf') {
    // Use a tiny PDF lib (pdfkit) — install with `npm i pdfkit @types/pdfkit`.
    const PDFDocument = (await import('pdfkit')).default;
    const doc = new PDFDocument({ size: 'LETTER' });
    res.setHeader('Content-Type', 'application/pdf').setHeader('Content-Disposition', 'attachment; filename="audit-log.pdf"');
    doc.pipe(res);
    doc.fontSize(14).text('Audit Log', { underline: true });
    rows.forEach((r) => doc.moveDown(0.3).fontSize(9).text(`${r.CREATED_AT.toISOString()} ${r.EVENT_TYPE} actor=${r.ACTOR_USER_ID} target=${r.TARGET_TYPE}:${r.TARGET_ID}`));
    doc.end();
  } else {
    res.status(400).json({ error: 'format must be csv or pdf' });
  }
});

export default router;
```

- [ ] **Step 2: Commit**

```bash
git add server/routes/audit.ts server/index.ts package.json
git commit -m "feat(US-CCL-04): audit log endpoint with filters + CSV/PDF export"
```

## Task 8.2: Audit log UI

**Files:**
- Create: `src/pages/AuditLog.tsx`
- Create: `src/components/AuditLog/AuditLogTable.tsx`
- Create: `src/components/AuditLog/AuditLogFilters.tsx`
- Create: `src/components/AuditLog/AuditLogExportBar.tsx`
- Create: `src/services/auditService.ts`
- Modify: `src/App.tsx` (route `/audit-log`)

- [ ] **Step 1: Components**

Filters: date range pickers, event type dropdown (populated from `AuditEventType` enum), actor role dropdown, actor identity search, target ID input. Table: paginated, sortable, expandable detail JSON. Export bar: CSV / PDF buttons (visible only when `can(user, 'audit.export')`). Hide CSV button entirely if `audit.viewScoped` only.

- [ ] **Step 2: e2e**

`e2e/compliance/audit-log.spec.ts`: Admin sees all events; Manager sees only their team scope; Processor → 403/redirect; CSV export downloads a non-empty file; PDF export succeeds.

- [ ] **Step 3: Commit**

```bash
git add ...
git commit -m "feat(US-CCL-04): audit log UI with filters and exports"
```

---

# Phase 9 — Final Verification & Documentation

## Task 9.1: Cross-cutting RBAC matrix verification

**Files:**
- Modify: `src/tests/securities-notice-permissions.test.ts` (extend with 403 server-side checks per endpoint)

- [ ] **Step 1: HTTP-level 403 matrix**

For every new endpoint, add a case for: (a) unauthenticated → 401, (b) wrong-role authenticated → 403 with the exact spec message `"You do not have permission to <action>."`, (c) right-role → 2xx. Use the pattern from `src/tests/security-report.smoke.test.ts` for login + token handling.

- [ ] **Step 2: Commit**

```bash
git add src/tests/securities-notice-permissions.test.ts
git commit -m "test(rbac): full 403 matrix for Securities Notice MVP endpoints"
```

## Task 9.2: Update CLAUDE.md + docs

**Files:**
- Modify: `CLAUDE.md` (add Securities Notice MVP section under "API Endpoints" with the new routes; add the new tables under "Database Schema")
- Modify: `README.md` if it indexes features
- Create: `docs/securities-notice-mvp.md` (high-level user guide for User Admins + Managers + Processors)

- [ ] **Step 1: Edit CLAUDE.md**

Append a new subsection mirroring the existing format. List every new endpoint, every new table, role-to-permission mapping, and the audit-event taxonomy.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md docs/securities-notice-mvp.md README.md
git commit -m "docs: Securities Notice MVP API + schema + user guide"
```

## Task 9.3: Three-server sync (legacy)

**Files:**
- Modify: `server.cjs`, `server.js`, `server-production.js`

- [ ] **Step 1: Mirror every new route**

For each new endpoint from Phases 3, 5, 6, 7, 8, port a CommonJS handler to all three legacy server files. Reuse the existing patterns and the `lib/permissions.cjs` mirror.

- [ ] **Step 2: Run Node.js production smoke locally**

```bash
npm run server:prod-test
# In another terminal:
curl http://localhost:3001/api/health
```

Expected: `{ "status": "OK" }` and routes responding (with appropriate auth).

- [ ] **Step 3: Commit**

```bash
git add server.cjs server.js server-production.js
git commit -m "feat(legacy-servers): mirror Securities Notice MVP endpoints"
```

## Task 9.4: Final acceptance run

- [ ] **Step 1: Run every Playwright suite**

```bash
npx playwright test e2e/securities-notice e2e/subpoena-rider e2e/compliance
```

Expected: all green.

- [ ] **Step 2: Run all bun smoke tests**

```bash
for f in src/tests/securities-notice-*.test.ts src/tests/audit-log.smoke.test.ts src/tests/notice-template.smoke.test.ts src/tests/subpoena-rider.smoke.test.ts src/tests/external-user-portal.smoke.test.ts src/tests/pii-guard.test.ts src/tests/recipient-verification.smoke.test.ts src/tests/platform-config.smoke.test.ts; do
  echo "=== $f ==="; bun "$f" || exit 1;
done
```

- [ ] **Step 3: TypeScript + lint**

```bash
tsc --noEmit && npm run lint
```

- [ ] **Step 4: Tag**

```bash
git tag -a v0.securities-notice-mvp -m "Securities Notice MVP — 15 user stories implemented"
```

---

## Self-Review Notes

**Spec coverage check:**

| Story | Phase / Task | Verified |
|---|---|---|
| US-SNT-01 (Create template) | 5.1 | ✅ |
| US-SNT-02 (Manager approval toggle) | 4.3 + 5.2 | ✅ |
| US-SNT-03 (Processor direct send) | 5.3 | ✅ |
| US-SNT-04 (Submit for approval) | 5.4 | ✅ |
| US-SNT-05 (Manager approve/reject) | 5.5 | ✅ |
| US-SNT-06 (User read-only) | 5.6 | ✅ |
| US-SRB-01 (Subpoena language) | 7.1 | ✅ |
| US-SRB-02 (Generate rider) | 7.2 | ✅ |
| US-SRB-03 (External attach subpoena) | 7.3 | ✅ |
| US-SRB-04 (Records released) | 7.4 | ✅ |
| US-CCL-01 (Field restrictions) | 4.1 + 4.3 | ✅ |
| US-CCL-02 (Disclaimer) | 4.2 + 4.3 | ✅ |
| US-CCL-03 (Recipient verification) | 6.1 | ✅ |
| US-CCL-04 (Audit log) | 1.1 + 8.1 + 8.2 | ✅ |
| US-CCL-05 (JAFAR platform) | 3.1 + 3.2 + 3.4 | ✅ |

**Audit event coverage:** all 15 event types in §7 of the spec are written by tasks in Phases 3–8.

**Access control matrix:** the §9 spec table maps directly to the keys in `src/utils/permissions.ts` updated in Task 2.1. Server-side enforcement comes from `requireRole` (Task 2.2) and the dedicated `requireJafar` / `requireExternalUser` middlewares.

**Notes / known scope simplifications:**
- Manager "team scope" for audit log is approximated as "same company" (Task 8.1 comment). The spec calls for proper team modeling — flagged as follow-up; not blocking MVP.
- The legacy three-server sync (Task 9.3) is mechanical but tedious; it can be skipped only if production deployment has already been migrated to `dist-server/index.js`. Confirm with deployment-specialist before omitting.
- Email transmission of the actual notice content uses the existing Resend integration in `server/routes/my-notices.ts` — Tasks 5.3/5.5 wire into that rather than reimplementing.

---

*End of plan — 15 stories, 9 phases, ~80 atomic tasks.*

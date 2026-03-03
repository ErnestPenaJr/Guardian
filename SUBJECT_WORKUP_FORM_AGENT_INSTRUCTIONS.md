# AI Agent Build Instructions: Subject Workup Request Form
**Classification: INTERNAL — DEVELOPMENT USE ONLY**
**Document Version:** 2.1 — Updated roles to Guardian MVP role set; stack updated to TypeScript/React; database updated to Azure SQL
**Source Requirements:** `SUBJECT_WORKUP_FORM_REQUIREMENTS_v2.docx`
**Role Reference:** `Guardian_MVP_User_Roles_Access_Levels.md` v2.0
**Scope:** Full secure implementation with all security features

---

## Table of Contents
1. [Agent Behavior Rules](#1-agent-behavior-rules)
2. [Technology Stack Assumptions](#2-technology-stack-assumptions)
3. [Project Structure](#3-project-structure)
4. [Database Schema](#4-database-schema)
5. [Security Architecture (Build First)](#5-security-architecture-build-first)
6. [User Stories — Implementation Order](#6-user-stories--implementation-order)
7. [Form Sections & Field Specifications](#7-form-sections--field-specifications)
8. [RBAC Matrix](#8-rbac-matrix)
9. [Audit Logging Specification](#9-audit-logging-specification)
10. [Validation Rules Reference](#10-validation-rules-reference)
11. [PDF Export Specification](#11-pdf-export-specification)
12. [Non-Functional Security Checklist](#12-non-functional-security-checklist)
13. [Testing Requirements](#13-testing-requirements)
14. [Definition of Done](#14-definition-of-done)

---

## 1. Agent Behavior Rules

> **Read this section first and follow all rules throughout the entire build.**

- **ALWAYS** implement server-side enforcement for all security checks. Client-side validation is supplemental only and must never be the sole gate.
- **NEVER** expose raw SSN, Account #, or SPII data in client HTML, API responses, or logs at any point. Mask or tokenize before transmission.
- **ALWAYS** write audit log entries before completing any action that modifies, views, or exports sensitive data. If the audit log write fails, roll back the action.
- **ALWAYS** apply field-level encryption at the data access layer, not the controller layer.
- **NEVER** store third-party credentials (Flashpoint, CLEAR/Lexis Nexis) in the application database.
- **ALWAYS** enforce RBAC checks at both the API endpoint and the service layer. Dual enforcement is required.
- When a requirement says "configurable," implement it as a database-driven or environment-config setting — not a hardcoded value.
- Build in the order specified in Section 6. Security infrastructure must exist before any form section is created.
- If a decision is ambiguous, choose the **more restrictive** security option and add a `// TODO: Confirm with stakeholder` comment.
- Do not skip any user story. All 20 user stories (US-SW-001 through US-SW-020) must be implemented.

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18+ with TypeScript |
| Routing & Route Guards | React Router v6 — role-checked `<ProtectedRoute>` wrappers |
| State Management | React Context or Zustand for auth/role state |
| API Layer | TypeScript API routes (Next.js API routes or Express.js handlers) |
| Database | **Azure SQL Database** (General Purpose tier minimum; Business Critical recommended for audit workloads) |
| ORM / Query Layer | **Prisma** with `sqlserver` provider — parameterized queries only; no raw string interpolation |
| DB Driver | `mssql` / `tedious` (used internally by Prisma) |
| Encryption (field-level, at rest) | AES-256-GCM via server-side `encryptionService.ts` |
| Encryption Key Management | **Azure Key Vault** — never store keys in source code, `.env` files, or app config |
| Encryption (in transit) | TLS 1.2 minimum enforced by Azure SQL; connection string must include `Encrypt=true;TrustServerCertificate=false` |
| Azure SQL TDE | Enable **Transparent Data Encryption (TDE)** with customer-managed key (CMK) in Azure Key Vault as a second layer |
| PDF Generation | Server-side only — `pdf-lib` or Puppeteer (Node.js); never client-side |
| Audit Log Storage | Separate Azure SQL table in a **dedicated schema** (`audit`) with insert-only service principal |
| Session Management | HTTPOnly + Secure cookies; `express-session` or Next.js iron-session |
| Authentication | **Azure Active Directory (Entra ID)** via `next-auth` with Azure AD provider or MSAL.js |
| Secrets Management | **Azure Key Vault** for all secrets; access via Managed Identity — no connection strings in code |
| Role Constants | Import from `src/lib/roles.ts` — see Section 5.3 |

---

## 3. Project Structure

```
/subject-workup
│
├── /src
│   ├── /app (or /pages)              # Next.js app/pages directory
│   │   ├── /api                      # API route handlers (server-side only)
│   │   │   ├── /workup               # CRUD endpoints for workup records
│   │   │   ├── /audit                # Audit log read endpoints (COMPLIANCE_OFFICER + JAFAR only)
│   │   │   └── /export               # PDF export endpoint (server-side generation)
│   │   ├── /workup                   # Frontend pages (form, dashboard, review queue)
│   │   └── /admin                    # Admin-only pages (dropdown config, user management)
│   │
│   ├── /components
│   │   ├── /form-sections            # One component per US-SW section
│   │   ├── /shared                   # MaskedField, ClassificationBanner, LegalHoldBanner
│   │   └── /layout                   # ProtectedRoute, RoleGate wrappers
│   │
│   ├── /lib
│   │   ├── roles.ts                  # UserRole type, ROLE_PERMISSIONS, hasPermission()
│   │   ├── encryptionService.ts      # AES-256-GCM encrypt/decrypt (server-side only)
│   │   ├── maskingService.ts         # SSN, Account, IP, Address masking by role
│   │   ├── rbacService.ts            # Permission checks — called in API routes AND components
│   │   ├── auditService.ts           # Audit log writes — insert-only service principal connection
│   │   ├── azureKeyVault.ts          # Azure Key Vault client — loads encryption keys via Managed Identity
│   │   └── db.ts                     # Prisma client singleton (sqlserver provider)
│   │
│   ├── /hooks
│   │   └── usePermission.ts          # React hook wrapping hasPermission() for components
│   │
│   ├── /types
│   │   ├── workup.ts                 # WorkupRecord, SubjectBio, ContactEntry DTOs
│   │   └── audit.ts                  # AuditEvent type definitions
│   │
│   └── /validators
│       └── workupValidators.ts       # Zod schemas for all form sections
│
├── /db
│   ├── /migrations                   # Versioned schema migration files
│   └── /seeds                        # Role seeds, controlled dropdown seeds
│
└── /tests
    ├── /unit                         # Jest unit tests
    ├── /integration                  # Supertest API integration tests
    └── /security                     # RBAC denial tests, XSS injection tests
```

---

## 4. Database Schema

**Database:** Azure SQL Database
**ORM:** Prisma with `sqlserver` provider
**Syntax:** T-SQL — use `NVARCHAR` for all string fields (Unicode support), `NVARCHAR(MAX)` for encrypted blobs, `UNIQUEIDENTIFIER` for UUIDs, `BIT` for boolean flags, `DATETIMEOFFSET` for UTC timestamps.

> All encrypted field columns store the format `base64(iv):base64(ciphertext):base64(tag)` as `NVARCHAR(MAX)`.
> The `audit` schema is a **dedicated schema** accessed via a separate insert-only service principal. The main app service principal must have no UPDATE or DELETE rights on `audit.*`.

### Core Tables

#### `dbo.SubjectWorkup` (Header Record)
```sql
CREATE TABLE dbo.SubjectWorkup (
  WorkupId          UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID()  PRIMARY KEY,
  CaseNumber        NVARCHAR(100)     NOT NULL,
  AnalystUserId     NVARCHAR(50)      NOT NULL,   -- From Azure AD authenticated session
  InvestigatorRole  NVARCHAR(50)      NOT NULL,
  CreatedUtc        DATETIMEOFFSET    NOT NULL DEFAULT SYSUTCDATETIME(),
  ModifiedUtc       DATETIMEOFFSET    NULL,
  Status            NVARCHAR(20)      NOT NULL    -- DRAFT | SUBMITTED | UNDER_REVIEW | APPROVED | REJECTED
                    CONSTRAINT CHK_Workup_Status CHECK (Status IN ('DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED')),
  SubmittedUtc      DATETIMEOFFSET    NULL,
  SubmittedBy       NVARCHAR(50)      NULL,
  Classification    NVARCHAR(30)      NOT NULL DEFAULT 'CONFIDENTIAL',
  LegalHold         BIT               NOT NULL DEFAULT 0,
  CreatedByIp       NVARCHAR(45)      NULL,       -- IPv4 or IPv6
  CompanyId         NVARCHAR(50)      NOT NULL    -- Tenant/company scoping; required for all queries
);
```

#### `dbo.WorkupSubjectBio` (SPII — Encrypted Fields)
```sql
CREATE TABLE dbo.WorkupSubjectBio (
  BioId             UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID()  PRIMARY KEY,
  WorkupId          UNIQUEIDENTIFIER  NOT NULL REFERENCES dbo.SubjectWorkup(WorkupId),
  FirstNameEnc      NVARCHAR(MAX)     NULL,       -- AES-256-GCM encrypted
  MiddleNameEnc     NVARCHAR(MAX)     NULL,
  LastNameEnc       NVARCHAR(MAX)     NULL,
  Suffix            NVARCHAR(10)      NULL,
  DobEnc            NVARCHAR(MAX)     NULL,       -- AES-256-GCM encrypted
  SsnEnc            NVARCHAR(MAX)     NULL,       -- AES-256 field-level encrypted
  SsnLast4          NVARCHAR(4)       NULL,       -- Plaintext last 4 for display only
  SsnToken          NVARCHAR(64)      NULL,       -- HMAC-SHA256 token for duplicate detection
  DlState           NVARCHAR(2)       NULL,
  DlNumberEnc       NVARCHAR(MAX)     NULL,
  AccountNumEnc     NVARCHAR(MAX)     NULL,       -- AES-256 field-level encrypted
  AccountLast4      NVARCHAR(4)       NULL,
  AccountToken      NVARCHAR(64)      NULL,       -- HMAC-SHA256 token for indexing
  FbiSidEnc         NVARCHAR(MAX)     NULL
);
```

#### `dbo.WorkupAkas` (Multi-value)
```sql
CREATE TABLE dbo.WorkupAkas (
  AkaId             UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID()  PRIMARY KEY,
  WorkupId          UNIQUEIDENTIFIER  NOT NULL REFERENCES dbo.SubjectWorkup(WorkupId),
  AkaNameEnc        NVARCHAR(MAX)     NULL,       -- AES-256-GCM encrypted
  AkaType           NVARCHAR(50)      NULL
);
```

#### `dbo.WorkupOtherIds` (Multi-value)
```sql
CREATE TABLE dbo.WorkupOtherIds (
  OtherIdId         UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID()  PRIMARY KEY,
  WorkupId          UNIQUEIDENTIFIER  NOT NULL REFERENCES dbo.SubjectWorkup(WorkupId),
  IdType            NVARCHAR(50)      NULL,
  IdValueEnc        NVARCHAR(MAX)     NULL        -- AES-256-GCM encrypted
);
```

#### `dbo.WorkupDemographics`
```sql
CREATE TABLE dbo.WorkupDemographics (
  DemoId            UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID()  PRIMARY KEY,
  WorkupId          UNIQUEIDENTIFIER  NOT NULL REFERENCES dbo.SubjectWorkup(WorkupId),
  Gender            NVARCHAR(30)      NULL,       -- Controlled dropdown value
  Race              NVARCHAR(50)      NULL,       -- Controlled dropdown value
  PobCity           NVARCHAR(100)     NULL,
  PobState          NVARCHAR(50)      NULL,
  PobCountry        NVARCHAR(100)     NULL,
  HeightValue       DECIMAL(5,1)      NULL,
  HeightUnit        NVARCHAR(2)       NULL,       -- IN | CM
  WeightValue       DECIMAL(6,1)      NULL,
  WeightUnit        NVARCHAR(2)       NULL,       -- LB | KG
  EyeColor          NVARCHAR(30)      NULL,
  HairColor         NVARCHAR(30)      NULL,
  TattooType        NVARCHAR(50)      NULL,
  TattooLocation    NVARCHAR(50)      NULL,
  SpecialNotes      NVARCHAR(500)     NULL        -- Character limit enforced at app layer
);
```

#### `dbo.WorkupContacts` (Multi-value, Encrypted)
```sql
CREATE TABLE dbo.WorkupContacts (
  ContactId         UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID()  PRIMARY KEY,
  WorkupId          UNIQUEIDENTIFIER  NOT NULL REFERENCES dbo.SubjectWorkup(WorkupId),
  ContactType       NVARCHAR(20)      NOT NULL    -- ADDRESS | PHONE | IP | SOCIALMEDIA
                    CONSTRAINT CHK_Contact_Type CHECK (ContactType IN ('ADDRESS','PHONE','IP','SOCIALMEDIA')),
  AddressEnc        NVARCHAR(MAX)     NULL,
  PhoneEnc          NVARCHAR(MAX)     NULL,
  IpAddressEnc      NVARCHAR(MAX)     NULL,
  SocialPlatform    NVARCHAR(50)      NULL,
  SocialHandleEnc   NVARCHAR(MAX)     NULL,
  SocialUrlEnc      NVARCHAR(MAX)     NULL,
  IsDeleted         BIT               NOT NULL DEFAULT 0,   -- Soft delete only; never hard delete
  DeletedBy         NVARCHAR(50)      NULL,
  DeletedUtc        DATETIMEOFFSET    NULL
);
```

#### `dbo.WorkupNarrativeFields` (Encrypted text blocks)
```sql
CREATE TABLE dbo.WorkupNarrativeFields (
  NarrativeId       UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID()  PRIMARY KEY,
  WorkupId          UNIQUEIDENTIFIER  NOT NULL REFERENCES dbo.SubjectWorkup(WorkupId),
  FieldType         NVARCHAR(30)      NOT NULL    -- CRIMINAL_HISTORY | SUBJECT_NOTES | INTEL_NOTES | ADDITIONAL_DATA
                    CONSTRAINT CHK_Narrative_Type CHECK (FieldType IN ('CRIMINAL_HISTORY','SUBJECT_NOTES','INTEL_NOTES','ADDITIONAL_DATA')),
  ContentEnc        NVARCHAR(MAX)     NULL,       -- AES-256-GCM encrypted
  VersionNumber     INT               NOT NULL DEFAULT 1,
  CreatedBy         NVARCHAR(50)      NOT NULL,
  CreatedUtc        DATETIMEOFFSET    NOT NULL DEFAULT SYSUTCDATETIME(),
  LegalHold         BIT               NOT NULL DEFAULT 0
);
```

#### `dbo.WorkupMinCollection` (Checkbox Matrix)
```sql
CREATE TABLE dbo.WorkupMinCollection (
  CollectionId      UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID()  PRIMARY KEY,
  WorkupId          UNIQUEIDENTIFIER  NOT NULL REFERENCES dbo.SubjectWorkup(WorkupId),
  IndicatorCode     NVARCHAR(50)      NOT NULL,   -- ACCT_STATEMENTS | FINCEN_SAR | WIRE_ACH | etc.
  ResultState       NVARCHAR(15)      NOT NULL DEFAULT 'NOT_REVIEWED'
                    CONSTRAINT CHK_Collection_State CHECK (ResultState IN ('POSITIVE','NEGATIVE','NOT_REVIEWED')),
  ReviewedBy        NVARCHAR(50)      NULL,
  ReviewedUtc       DATETIMEOFFSET    NULL,
  Classification    NVARCHAR(30)      NOT NULL DEFAULT 'RESTRICTED_FINANCIAL_INTEL',
  -- App layer enforces: POSITIVE and NEGATIVE cannot both be set for same WorkupId + IndicatorCode
  CONSTRAINT UQ_Collection_WorkupIndicator UNIQUE (WorkupId, IndicatorCode)
);
```

#### `dbo.WorkupSources` (Sources, OSINT, Property, Background DBs)
```sql
CREATE TABLE dbo.WorkupSources (
  SourceId          UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID()  PRIMARY KEY,
  WorkupId          UNIQUEIDENTIFIER  NOT NULL REFERENCES dbo.SubjectWorkup(WorkupId),
  SourceCategory    NVARCHAR(30)      NOT NULL,   -- IDENTIFICATION | PROPERTY | BACKGROUND_DB | OSINT
  SourceName        NVARCHAR(100)     NULL,       -- Flashpoint, Photo, CLEAR, Map Overlay, etc.
  ResultState       NVARCHAR(10)      NULL
                    CONSTRAINT CHK_Source_Result CHECK (ResultState IN ('POSITIVE','NEGATIVE',NULL)),
  NotesEnc          NVARCHAR(MAX)     NULL,
  VehiclePlateEnc   NVARCHAR(MAX)     NULL,
  VehicleState      NVARCHAR(2)       NULL,
  VehicleDesc       NVARCHAR(200)     NULL,
  UrlEnc            NVARCHAR(MAX)     NULL,
  AttachmentPath    NVARCHAR(500)     NULL,       -- Server/blob path only; never expose to client
  AttachmentScanned BIT               NOT NULL DEFAULT 0   -- 0 = pending scan; 1 = clean
);
```

#### `audit.WorkupAuditLog` (Immutable — Dedicated schema, insert-only service principal)
```sql
CREATE TABLE audit.WorkupAuditLog (
  AuditId           UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID()  PRIMARY KEY,
  WorkupId          UNIQUEIDENTIFIER  NULL,
  CompanyId         NVARCHAR(50)      NULL,       -- For company-scoped audit log queries (COMPLIANCE_OFFICER)
  UserId            NVARCHAR(50)      NOT NULL,
  UserRole          NVARCHAR(50)      NOT NULL,
  UserIp            NVARCHAR(45)      NOT NULL,
  ActionType        NVARCHAR(50)      NOT NULL,   -- See Section 9 for action codes
  FieldAffected     NVARCHAR(100)     NULL,
  OldValueHash      NVARCHAR(128)     NULL,       -- SHA-256 hash only — never store plaintext SPII
  NewValueHash      NVARCHAR(128)     NULL,
  ActionUtc         DATETIMEOFFSET    NOT NULL DEFAULT SYSUTCDATETIME(),
  SessionId         NVARCHAR(100)     NULL,
  ExportType        NVARCHAR(20)      NULL        -- MASKED | FULL_SPII
  -- NEVER grant UPDATE or DELETE on this table to any application service principal.
  -- Grant INSERT only to the audit service principal.
  -- Grant SELECT only to the compliance read principal (used by COMPLIANCE_OFFICER and JAFAR routes).
);
```

#### `dbo.DropdownConfig` (Administrator-managed controlled values)
```sql
CREATE TABLE dbo.DropdownConfig (
  ConfigId          UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID()  PRIMARY KEY,
  Category          NVARCHAR(50)      NOT NULL,   -- GENDER | RACE | EYE_COLOR | HAIR_COLOR | TATTOO_TYPE | TATTOO_LOCATION
  DisplayValue      NVARCHAR(100)     NOT NULL,
  SortOrder         INT               NOT NULL DEFAULT 0,
  IsActive          BIT               NOT NULL DEFAULT 1,
  ModifiedBy        NVARCHAR(50)      NULL,
  ModifiedUtc       DATETIMEOFFSET    NULL
);
```

### Prisma Schema (`prisma/schema.prisma`)
```prisma
datasource db {
  provider = "sqlserver"
  url      = env("DATABASE_URL")  // Loaded from Azure Key Vault via Managed Identity at startup
}

generator client {
  provider = "prisma-client-js"
}
// Define models to match tables above using @map and @@map for PascalCase ↔ T-SQL naming
```

### Connection String Requirements
```
// Must include these flags in DATABASE_URL:
Encrypt=true;TrustServerCertificate=false;
// Use Managed Identity authentication where possible:
Authentication=Active Directory Managed Identity;
// Never use SQL authentication with a hardcoded password in any environment
```

### Azure SQL Service Principal Setup
Create **three separate service principals / logins**:

| Principal | Permissions | Used By |
|---|---|---|
| `app-workup-rw` | SELECT, INSERT, UPDATE on `dbo.*` | Main application (Prisma) |
| `app-audit-insert` | INSERT only on `audit.WorkupAuditLog` | `auditService.ts` only |
| `app-audit-read` | SELECT only on `audit.WorkupAuditLog` | Audit log API routes (`COMPLIANCE_OFFICER` / `JAFAR` only) |

---

## 5. Security Architecture (Build First)

> **Do not build any form sections until this entire section is implemented and tested.**

### 5.1 Encryption Service (`src/lib/encryptionService.ts`)
Create a server-only module (never import in client components) that:
- Uses AES-256-GCM for all field-level encryption
- Stores IV/nonce with each encrypted value (format: `base64(iv):base64(ciphertext):base64(tag)`)
- Loads the encryption key from **Azure Key Vault** at startup via Managed Identity using `@azure/keyvault-secrets` and `@azure/identity`
  ```typescript
  import { SecretClient } from '@azure/keyvault-secrets';
  import { DefaultAzureCredential } from '@azure/identity';
  const client = new SecretClient(process.env.KEY_VAULT_URI!, new DefaultAzureCredential());
  const secret = await client.getSecret('workup-encryption-key');
  ```
- **Never** read the key from `.env`, `process.env` directly, or any config file committed to source control — Key Vault is the only source
- Exports `encrypt(plaintext: string): string` and `decrypt(ciphertext: string): string`
- Exports `tokenize(value: string): string` — deterministic HMAC-SHA256 token for indexing SSN and Account #
- All encryption errors must throw and must **never** silently return plaintext
- Mark file with `'use server'` or equivalent to prevent client bundle inclusion

### 5.2 Masking Service (`src/lib/maskingService.ts`)
Create a `maskingService` module that:
- `maskSSN(ssn: string): string` → `"XXX-XX-" + last4` — applied before any API response is serialized
- `maskAccount(acct: string): string` → `"****" + last4`
- `maskIP(ip: string, role: UserRole): string` → masks last octet(s) for roles below `COMPLIANCE_OFFICER`
- `maskAddress(address: string, role: UserRole): string` → full address for `COMPLIANCE_OFFICER`+; street number only for others
- Masking must be applied in the **API route handler** when building response objects, not in the React component

### 5.3 RBAC Service (`src/lib/roles.ts` + `src/lib/rbacService.ts`)

**`src/lib/roles.ts`** — Single source of truth for all role definitions. Copy exactly from Guardian MVP roles doc:

```typescript
export type UserRole =
  | 'USER'                // Role 2 — Basic end-user
  | 'SUPERVISOR'          // Role 4 — Processor / operational approver
  | 'MANAGER'             // Role 3 — Company-wide oversight
  | 'ADMIN'               // Role 1 — Full company admin
  | 'COMPLIANCE_OFFICER'  // Role 5 — Read-only oversight + audit log access
  | 'JAFAR';              // Role 6 — Super Admin, cross-company

// Workup-specific permission map
export const WORKUP_PERMISSIONS = {
  canCreateWorkup:          ['USER', 'SUPERVISOR', 'MANAGER', 'ADMIN', 'JAFAR'],
  canViewOwnWorkups:        ['USER', 'SUPERVISOR', 'MANAGER', 'ADMIN', 'COMPLIANCE_OFFICER', 'JAFAR'],
  canViewAllCompanyWorkups: ['SUPERVISOR', 'MANAGER', 'ADMIN', 'COMPLIANCE_OFFICER', 'JAFAR'],
  canEditDraft:             ['USER', 'SUPERVISOR', 'MANAGER', 'ADMIN', 'JAFAR'],
  canSubmitForReview:       ['USER', 'SUPERVISOR', 'MANAGER', 'ADMIN', 'JAFAR'],
  canApproveWorkup:         ['SUPERVISOR', 'MANAGER', 'ADMIN', 'JAFAR'],
  canAssignWorkup:          ['MANAGER', 'ADMIN', 'JAFAR'],
  canRecallWorkup:          ['MANAGER', 'ADMIN', 'JAFAR'],
  canViewBiographicalFields:['USER', 'SUPERVISOR', 'MANAGER', 'ADMIN', 'COMPLIANCE_OFFICER', 'JAFAR'],
  canViewSSNUnmasked:       ['SUPERVISOR', 'MANAGER', 'ADMIN', 'COMPLIANCE_OFFICER', 'JAFAR'], // + SENSITIVE_DATA flag
  canViewAccountUnmasked:   ['SUPERVISOR', 'MANAGER', 'ADMIN', 'COMPLIANCE_OFFICER', 'JAFAR'], // + SENSITIVE_DATA flag
  canViewCriminalHistory:   ['USER', 'SUPERVISOR', 'MANAGER', 'ADMIN', 'COMPLIANCE_OFFICER', 'JAFAR'],
  canViewIntelNotes:        ['USER', 'SUPERVISOR', 'MANAGER', 'ADMIN', 'COMPLIANCE_OFFICER', 'JAFAR'],
  canViewFinancialIndicators:['USER', 'SUPERVISOR', 'MANAGER', 'ADMIN', 'COMPLIANCE_OFFICER', 'JAFAR'],
  canExportMasked:          ['USER', 'SUPERVISOR', 'MANAGER', 'ADMIN', 'COMPLIANCE_OFFICER', 'JAFAR'],
  canExportFullSPII:        ['SUPERVISOR', 'MANAGER', 'ADMIN', 'COMPLIANCE_OFFICER', 'JAFAR'], // + SENSITIVE_DATA flag
  canManageDropdowns:       ['ADMIN', 'JAFAR'],
  canViewAuditLogs:         ['COMPLIANCE_OFFICER', 'JAFAR'],       // Company-scoped
  canViewCrossCompanyAuditLogs: ['JAFAR'],                         // Cross-company only
} as const;

export type WorkupPermission = keyof typeof WORKUP_PERMISSIONS;

export function hasWorkupPermission(role: UserRole, permission: WorkupPermission): boolean {
  return (WORKUP_PERMISSIONS[permission] as readonly string[]).includes(role);
}
```

**`src/lib/rbacService.ts`** — Server-side enforcement layer:
- Reads role from authenticated session only — never trust `role` from the request body or query params
- Call `hasWorkupPermission(session.role, permission)` before every protected API route handler executes
- For `SENSITIVE_DATA` flag permissions (SSN, Account #, Full SPII export): check `session.role` AND `session.hasSensitiveDataPermission === true`
- Return HTTP 403 with a logged `ACCESS_DENIED` audit event on any denial

**`src/hooks/usePermission.ts`** — Client-side role gate for React components:
```typescript
import { useSession } from 'next-auth/react'; // or your auth provider
import { hasWorkupPermission, WorkupPermission } from '@/lib/roles';

export function usePermission(permission: WorkupPermission): boolean {
  const { data: session } = useSession();
  if (!session?.user?.role) return false;
  return hasWorkupPermission(session.user.role, permission);
}
```
> ⚠️ `usePermission` controls UI visibility only. API routes enforce the real check server-side. Never rely on this hook alone to protect data.

### 5.4 Audit Service (`src/lib/auditService.ts`)
- Writes to `audit.WorkupAuditLog` using the **`app-audit-insert` service principal** — a dedicated Prisma client instance initialized with the insert-only connection string, separate from the main `app-workup-rw` client
- Exported as `async function logAuditEvent(event: AuditEvent): Promise<void>`
- **Never** logs plaintext SPII — always hash field values using SHA-256 before logging
- If the write fails, the parent API route returns 500 and the triggering action is rolled back
- All timestamps are UTC (`new Date().toISOString()`)
- The audit read routes (for `COMPLIANCE_OFFICER` and `JAFAR`) use a third Prisma client instance initialized with the `app-audit-read` service principal — SELECT only

### 5.5 Route Guards (React)
Wrap all workup form routes in a `<RoleGate>` component:
```typescript
// components/layout/RoleGate.tsx
export function RoleGate({ permission, children }: { permission: WorkupPermission; children: React.ReactNode }) {
  const allowed = usePermission(permission);
  if (!allowed) return <Navigate to="/unauthorized" replace />;
  return <>{children}</>;
}
```

Protected routes:
- `/workup/new` → requires `canCreateWorkup`
- `/workup/:id/edit` → requires `canEditDraft`
- `/workup/:id/review` → requires `canApproveWorkup`
- `/audit-logs` → requires `canViewAuditLogs` — **COMPLIANCE_OFFICER and JAFAR only**
- `/admin/dropdowns` → requires `canManageDropdowns` — **ADMIN and JAFAR only**

### 5.6 Session & Transport Security
- Session cookies: `HttpOnly: true`, `Secure: true`, `SameSite: 'strict'`
- CSRF tokens validated on all non-GET API routes
- Rate limiting: max 10 SPII field view/query requests per user per minute (use `express-rate-limit` or equivalent)
- Enforce TLS 1.2+ at the server/load balancer level
- Mark all encryption and audit service files as server-only — use `server-only` npm package or Next.js `'use server'` directive

---

## 6. User Stories — Implementation Order

Build in this exact sequence. Each story depends on the one before it.

| Order | Story ID | Name |
|---|---|---|
| 1 | Foundation | Security architecture (Section 5) |
| 2 | Foundation | RBAC setup, roles, and user session integration |
| 3 | Foundation | Audit logging infrastructure and WORM table |
| 4 | US-SW-001 | Create Subject Workup Record Header |
| 5 | US-SW-007 | RBAC field-level enforcement (integrated with each subsequent story) |
| 6 | US-SW-002 | Subject Identification & Biographical Data |
| 7 | US-SW-003 | Demographic & Physical Description |
| 8 | US-SW-004 | Contact & Digital Identifiers |
| 9 | US-SW-005 | Criminal History Section |
| 10 | US-SW-006 | Other Subject Notes |
| 11 | US-SW-009 | Investigative / Intelligence Notes |
| 12 | US-SW-010 | Minimum Collection Checklist |
| 13 | US-SW-011 | Sources — Subject Identification |
| 14 | US-SW-012 | Property Data Sources |
| 15 | US-SW-013 | Background Databases |
| 16 | US-SW-014 | OSINT / SOCMINT Section |
| 17 | US-SW-015 | Additional Data / Notes |
| 18 | US-SW-016 | Role-Based Data Classification (review + tighten) |
| 19 | US-SW-017 | Save Subject Workup as Draft |
| 20 | US-SW-018 | Resume & Edit Draft Workup |
| 21 | US-SW-019 | Submit Completed Workup to Review Queue |
| 22 | US-SW-020 | Export Form to PDF |
| 23 | QA | End-to-end security and integration testing |

---

## 7. Form Sections & Field Specifications

### Section 1 — Header (US-SW-001)
| Field | Type | Rules |
|---|---|---|
| Subject Workup ID | Read-only text | System-generated UUID; display only; never editable |
| Analyst | Read-only text | Auto-populated from authenticated session; cannot be overridden by user |
| Analyst/Investigator | Dropdown | Populated from RBAC-eligible user list; role-based |
| Date | Read-only timestamp | UTC auto-set on creation; editable only by `SUPERVISOR`+ |
| Case # | Text input | Required; validate against existing case records via API call; alphanumeric + special chars |

**Implementation Notes:**
- Workup ID generated server-side as UUID v4 on POST, returned to client
- Case # validation must call a case management API or DB lookup — do not accept any value
- Audit log: `WORKUP_CREATED` event on successful save

---

### Section 2 — Subject Identification & Biographical Data (US-SW-002)
| Field | Type | Encryption | Masking | Role to View Unmasked |
|---|---|---|---|---|
| First Name | Text | AES-256 | None | `USER`+ |
| Middle Name | Text | AES-256 | None | `USER`+ |
| Last Name | Text | AES-256 | None | `USER`+ |
| Suffix | Dropdown | None | None | All |
| AKA(s) | Multi-value text | AES-256 per entry | None | `USER`+ |
| DOB | Date picker | AES-256 | None | `USER`+ |
| SSN | Text | AES-256 field-level | `XXX-XX-####` default | `SUPERVISOR`+ with `SENSITIVE_DATA` permission |
| State DL | Text + state dropdown | AES-256 | None | `USER`+ |
| Account # | Text | AES-256 field-level | `****last4` | `SUPERVISOR`+ with `SENSITIVE_DATA` permission; export requires `FULL_EXPORT` |
| FBISID # | Text | AES-256 | None | `USER`+ |
| Other ID #s | Multi-value (type + value) | AES-256 per entry | None | `USER`+ |

**Implementation Notes:**
- DOB: use a date picker component; disable keyboard free-text entry; reject future dates; reject dates implying age < 0 or > 120 (configurable)
- SSN: render as password-type input; send to server masked; only send plaintext on explicit "view" action which triggers audit log entry `SSN_VIEWED`
- Duplicate detection: on SSN entry, call server-side check (hashed token comparison) for exact SSN match; also check Name + DOB combination; surface alert — do not block save
- Account #: tokenize for indexing; store `ACCOUNT_TOKEN` for search; last 4 in plaintext for display
- All SPII fields: `AES-256` at rest; not included in any general search index

---

### Section 3 — Demographic & Physical Description (US-SW-003)
| Field | Type | Rules |
|---|---|---|
| Gender | Dropdown | Controlled; values from `DROPDOWN_CONFIG` table |
| Race | Dropdown | Controlled; values from `DROPDOWN_CONFIG` table |
| Place of Birth — City | Text | Max 100 chars; sanitized against HTML/script injection |
| Place of Birth — State | Text/Dropdown | Max 50 chars |
| Place of Birth — Country | Text/Dropdown | Max 100 chars |
| Height | Number + unit selector (IN/CM) | Positive number; reasonable range (12–120 inches or equivalent) |
| Weight | Number + unit selector (LB/KG) | Positive number; reasonable range |
| Eye Color | Dropdown | Controlled; values from `DROPDOWN_CONFIG` |
| Hair Color | Dropdown | Controlled; values from `DROPDOWN_CONFIG` |
| Tattoos/Marks | Dropdown | Controlled; values from `DROPDOWN_CONFIG` |
| Identifier Location | Dropdown | Controlled; values from `DROPDOWN_CONFIG` |
| Special Notes | Text (single line) | Max 500 chars; HTML sanitized |

**Implementation Notes:**
- All free-text fields must pass through an HTML/XSS sanitizer before persistence
- All edits generate a field-level audit log entry
- Controlled dropdown values are not hardcoded — they are loaded from `DROPDOWN_CONFIG` via admin-managed API

---

### Section 4 — Contact & Digital Identifiers (US-SW-004)
Implement as a multi-entry repeatable block per contact type.

| Contact Type | Fields | Validation |
|---|---|---|
| Address | Street, City, State, ZIP, Country | Required: Street + City minimum |
| Phone Number | Number + Country Code | E.164 format validation; country-aware |
| IP Address | IP field | Accept IPv4 (regex: `^(\d{1,3}\.){3}\d{1,3}$`) and IPv6; validate format |
| Social Media | Platform (dropdown) + Handle + URL | URL format validation; platform from controlled list |

**Implementation Notes:**
- Each entry type supports Add / Edit / Delete
- Soft-delete only — set `DELETED_FLAG = 'Y'`; never hard delete
- Add, Edit, and Delete actions each generate audit log entries
- All entries encrypted at rest
- Export masking: addresses and handles masked based on role (see Section 8)

---

### Section 5 — Criminal History (US-SW-005)
| Field | Type | Rules |
|---|---|---|
| Criminal History | Multi-line textarea | Max chars: configurable (default 10,000); copy/paste enabled; no HTML allowed |

**Implementation Notes:**
- Access restricted: `USER`+ with investigative role only
- Encrypted at rest (AES-256)
- Every edit generates an **immutable** audit log delta entry
- Read-only for `COMPLIANCE_OFFICER`

---

### Section 6 — Other Subject Notes (US-SW-006)
| Field | Type | Rules |
|---|---|---|
| Other Subject Notes | Multi-line textarea | Encrypted; version history retained; copy/paste enabled |

**Implementation Notes:**
- Store each save as a new version record in `dbo.WorkupNarrativeFields` (increment `VersionNumber`)
- Visibility: configurable per record — `RESTRICTED` (Supervisor+) or `GENERAL` (Analyst+)
- Legal hold check: if `LEGAL_HOLD = 'Y'` on parent workup, disable delete on this field and surface a banner to the user

---

### Section 7 — Investigative / Intelligence Notes (US-SW-009)
| Field | Type | Rules |
|---|---|---|
| Investigative/Intelligence Notes | Multi-line textarea | Configurable character limit; HTML sanitized; encrypted at rest |

**Role Visibility:**
- `USER` / `SUPERVISOR`: View + Edit
- `MANAGER` / `ADMIN` / `JAFAR`: View + Edit
- `COMPLIANCE_OFFICER`: View Only

**Implementation Notes:**
- All edits produce field-level audit delta logs with before/after SHA-256 hash reference
- Character limit is configurable — read from application config, not hardcoded

---

### Section 8 — Minimum Collection Checklist (US-SW-010)
Render as a matrix table. Each row = one indicator. Each row has three mutually exclusive states.

**Indicators (18 total):**
`ACCT_STATEMENTS`, `FINCEN_SAR`, `MASTER_OBI_TRAP`, `ADDRESS_INFO`, `PHONE_EMAIL`, `PHONE_CALLS`, `BRANCH_VIDEO_PHOTOS`, `WIRE_ACH`, `DEPOSIT_ACTIVITY`, `WITHDRAWAL_ACTIVITY`, `CRYPTO_ACTIVITY`, `SECURITIES_ACTIVITY`, `DEBIT_CARD_SMS`, `AUTHLOGS_IP`, `DOC_VERIFICATION`, `ACCT_HOLDER_INTERVIEWED`, `SOCIAL_MEDIA`, `ADDITIONAL_CONTACT`

| Column | Type | Behavior |
|---|---|---|
| Positive | Radio/Toggle | Selecting clears Negative |
| Negative | Radio/Toggle | Selecting clears Positive |
| Not Reviewed | Default state | Both Positive and Negative unselected |

**Implementation Notes:**
- Enforce mutual exclusivity both client-side and server-side; reject any payload with both set
- All financial indicators classified as `RESTRICTED_FINANCIAL_INTEL` in the data model
- Financial indicator fields encrypted at rest
- Every state change logs: user ID, timestamp, prior state, new state
- Access: `USER`+ with financial data clearance

---

### Section 9 — Sources: Subject Identification (US-SW-011)
| Source | Toggle | Notes Field | Special Fields |
|---|---|---|---|
| Flashpoint | Positive / Negative | Optional text (encrypted) | Log access if integrated; do not store credentials |
| Photo | Positive / Negative | Optional text (encrypted) | — |
| Vehicle(s) | Positive / Negative | Optional text (encrypted) | Plate # (masked by default), State, Description |

**Implementation Notes:**
- Vehicle plate number stored encrypted; masked in display (`***` + last 3)
- External integrations (Flashpoint): log search event and user only; never store raw API credentials

---

### Section 10 — Property Data Sources (US-SW-012)
| Source | Toggle | Notes |
|---|---|---|
| Map Overlay | Positive / Negative | Do not expose precise geolocation to non-authorized roles |
| Street View | Positive / Negative | — |
| City / Town Tax Card | Positive / Negative | — |

**Implementation Notes:**
- Address data encrypted at rest
- Full address masked in exports for roles below `COMPLIANCE_OFFICER`
- All selections logged with user ID, timestamp, and selected state

---

### Section 11 — Background Databases (US-SW-013)
| Source | Fields |
|---|---|
| CLEAR / Lexis Nexis | Usage recorded; search event logged; querying user logged |

**Implementation Notes:**
- Do not store raw credential tokens or API keys in the database
- If integrated: log search event, log querying user, store only permissible returned data per license
- Results classified as `RESTRICTED_LAW_ENFORCEMENT_DATA`

---

### Section 12 — OSINT / SOCMINT (US-SW-014)
| Field | Type | Rules |
|---|---|---|
| Social Media / CTI | URL + Notes | URL format validation |
| OSINT | URL + Notes + Screenshot attachment | Attachment must be virus scanned before storage |

**Implementation Notes:**
- IP addresses or handles: validate format, encrypt at rest
- File attachments: scan server-side before storing; reject on failure; store path server-side only — never expose full path to client
- Export masking rules apply to all entries

---

### Section 13 — Additional Data / Notes (US-SW-015)
| Field | Type | Rules |
|---|---|---|
| Additional Data / Notes | Multi-line textarea | Character limit enforced; encrypted at rest; audit logged |

**Implementation Notes:**
- Edits tracked via audit logging
- Legal hold: if `LEGAL_HOLD = 'Y'`, deletion disabled; surface legal hold banner to user

---

## 8. RBAC Matrix

> All checks enforced **server-side in API route handlers**. React component-level guards (`usePermission`, `<RoleGate>`) are supplemental UI controls only and must never be the sole protection.
> Role numbers reference the Guardian MVP roles document v2.0.

| Permission | USER (2) | SUPERVISOR (4) | MANAGER (3) | ADMIN (1) | COMPLIANCE OFFICER (5) | JAFAR (6) |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Create workup | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| View own workups | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View all company workups | ❌ | ✅ | ✅ | ✅ | ✅ (read-only) | ✅ |
| Edit draft (own) | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Submit for review | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Approve workup | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Assign workup | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ |
| Recall after submission | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ |
| View biographical fields | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View SSN (unmasked) | ❌ | ✅ * | ✅ * | ✅ * | ✅ * | ✅ * |
| View Account # (unmasked) | ❌ | ✅ * | ✅ * | ✅ * | ✅ * | ✅ * |
| View criminal history | ✅ | ✅ | ✅ | ✅ | ✅ (read) | ✅ |
| View investigative notes | ✅ | ✅ | ✅ | ✅ | ✅ (read) | ✅ |
| View financial indicators | ✅ | ✅ | ✅ | ✅ | ✅ (read) | ✅ |
| Masked PDF export | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Full SPII PDF export | ❌ | ✅ * | ✅ * | ✅ * | ✅ * | ✅ * |
| Manage dropdown config | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| **View audit logs (company)** | ❌ | ❌ | ❌ | ❌ | **✅** | ✅ |
| **View audit logs (cross-company)** | ❌ | ❌ | ❌ | ❌ | ❌ | **✅** |
| User management | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |

`*` Requires `session.hasSensitiveDataPermission === true` in addition to the role. Check both conditions server-side before unmasking or exporting.

### Compliance Officer — Special Notes
- `COMPLIANCE_OFFICER` has **no create, edit, approve, or assign** capabilities anywhere in the workup form
- `COMPLIANCE_OFFICER` is the **only non-JAFAR role** with access to the audit log viewer (`/audit-logs`)
- All `COMPLIANCE_OFFICER` record access must itself be audit logged with action code `COMPLIANCE_REVIEW_ACCESS`
- Suppress all action buttons (Submit, Approve, Assign, Edit, Delete) from the UI when `session.role === 'COMPLIANCE_OFFICER'`
- `COMPLIANCE_OFFICER` audit log access is scoped to their company only — never cross-company

---

## 9. Audit Logging Specification

### Action Codes
| Action Code | Trigger |
|---|---|
| `WORKUP_CREATED` | New workup record created |
| `WORKUP_DRAFT_SAVED` | Draft save action |
| `WORKUP_SUBMITTED` | Submitted to review queue |
| `WORKUP_RECALLED` | Recalled from review queue |
| `WORKUP_APPROVED` | Approved by Supervisor, Manager, Admin, or JAFAR |
| `WORKUP_REJECTED` | Rejected and returned to submitter |
| `FIELD_EDITED` | Any field-level change (include field name) |
| `SSN_VIEWED` | SSN unmasked view event |
| `ACCOUNT_VIEWED` | Account # unmasked view event |
| `SPII_FIELD_VIEWED` | Any SPII field viewed in full |
| `EXPORT_MASKED` | Masked PDF exported |
| `EXPORT_FULL_SPII` | Full SPII PDF exported |
| `ACCESS_DENIED` | Failed RBAC check — log role attempted and permission denied |
| `LOGIN_FAILED` | Failed authentication attempt |
| `DUPLICATE_ALERT` | Duplicate SSN or Name+DOB detected |
| `CONTACT_ADDED` | New contact entry added |
| `CONTACT_EDITED` | Contact entry modified |
| `CONTACT_DELETED` | Contact entry soft-deleted |
| `ATTACHMENT_UPLOADED` | File attachment uploaded |
| `LEGAL_HOLD_SET` | Legal hold flag applied |
| `LEGAL_HOLD_RELEASED` | Legal hold flag removed |
| `COLLECTION_STATE_CHANGED` | Minimum collection checkbox state changed |
| `COMPLIANCE_REVIEW_ACCESS` | Compliance Officer accessed any workup record or audit log |

### Audit Log Rules
- Written using a **separate insert-only DB connection** (no UPDATE/DELETE privileges on this connection)
- Never log plaintext SPII — always hash with SHA-256 before logging
- Timestamps must be UTC (`new Date().toISOString()`)
- Failed audit writes must roll back the parent operation and return a 500 error
- Retention period: configurable per compliance policy (default: 7 years)
- Audit log viewer is accessible **only** to `COMPLIANCE_OFFICER` (company-scoped) and `JAFAR` (cross-company)
- `USER`, `SUPERVISOR`, `MANAGER`, and `ADMIN` roles must receive HTTP 403 if they attempt to access any audit log endpoint

---

## 10. Validation Rules Reference

| Field | Validation Rule |
|---|---|
| Case # | Required; alphanumeric + special chars; must match existing case record via API |
| DOB | Date picker only; no future dates; age range 0–120 (configurable bounds) |
| SSN | Format `###-##-####`; numeric only; duplicate token check on entry |
| Account # | Numeric; duplicate token check on entry |
| IP Address | IPv4: `^(\d{1,3}\.){3}\d{1,3}$` with octet range 0–255; IPv6: RFC 5952 compliant |
| Phone | E.164 format `+[country][number]`; country-aware validation |
| URL fields | Must match `^https?://` scheme; no javascript: or data: URIs |
| Height | Positive numeric; range: 12–120 inches or 30–305 cm |
| Weight | Positive numeric; range: 1–700 lbs or 0.5–317 kg |
| Free-text notes | HTML entities escaped / stripped; no `<script>`, `<iframe>`, event attributes |
| Minimum collection | Positive and Negative cannot both be selected for same row |
| File attachments | Virus scan required; allowed types: PDF, JPG, PNG, DOCX; max size: configurable |

---

## 11. PDF Export Specification (US-SW-020)

**Generation:** Server-side only. Do not generate in browser. Do not expose raw SPII in any client HTML during generation.

**Required PDF Elements:**
- Classification banner at top and bottom of every page (e.g., `CONFIDENTIAL`)
- Subject Workup ID
- Case #
- Analyst name and Analyst/Investigator name
- Export timestamp (UTC) and exporting user's name/ID
- Watermark on every page if Full SPII export: `CONTAINS SENSITIVE PII — RESTRICTED`

**Masking Rules in PDF:**
| Field | Masked Export | Full SPII Export |
|---|---|---|
| SSN | `XXX-XX-####` | Full value |
| Account # | `****last4` | Full value |
| IP Addresses | Last octet(s) masked | Full value |
| Addresses | Street number only | Full address |
| Criminal History | Included | Included |
| Financial Indicators | Included (without raw values) | Included |

**Export Events:**
- Every export triggers an `EXPORT_MASKED` or `EXPORT_FULL_SPII` audit log entry
- Record: user ID, role, timestamp, workup ID, export type (masked vs. full)
- Export button is disabled unless all required fields are complete and validation passes

---

## 12. Non-Functional Security Checklist

> Agent must verify each item is implemented before marking build complete.

**Encryption & Keys**
- [ ] AES-256-GCM field-level encryption at rest for all SPII fields
- [ ] Encryption key loaded exclusively from **Azure Key Vault** via Managed Identity — never from `.env` or source code
- [ ] Azure SQL **Transparent Data Encryption (TDE)** enabled with customer-managed key (CMK) stored in Azure Key Vault
- [ ] SSN and Account # tokenized (HMAC-SHA256) for indexing; plaintext never stored in any searchable column
- [ ] `encryptionService.ts` marked server-only — not included in any client bundle

**Transport & Connection**
- [ ] Azure SQL connection string includes `Encrypt=true;TrustServerCertificate=false`
- [ ] Managed Identity authentication used for Azure SQL — no hardcoded SQL login passwords
- [ ] TLS 1.2+ enforced by Azure SQL (default); confirm no legacy clients can downgrade

**Session & Request Security**
- [ ] Session cookies: `HttpOnly`, `Secure`, `SameSite=Strict`
- [ ] CSRF tokens validated on all non-GET API routes
- [ ] Rate limiting: 10 SPII field view/query requests per user per minute
- [ ] HTML/XSS sanitization on all free-text inputs before persistence
- [ ] All DB queries use Prisma parameterized queries — zero raw SQL string interpolation

**Database Access Control**
- [ ] Three service principals created: `app-workup-rw`, `app-audit-insert`, `app-audit-read`
- [ ] `app-audit-insert` has INSERT only on `audit.WorkupAuditLog` — no SELECT, UPDATE, DELETE
- [ ] `app-audit-read` has SELECT only on `audit.WorkupAuditLog` — used exclusively by compliance/audit API routes
- [ ] Main app principal (`app-workup-rw`) has no access to `audit.*` schema

**File Handling**
- [ ] File attachments scanned server-side (e.g., via **Microsoft Defender for Storage** on Azure Blob) before storage
- [ ] Attachment storage path never exposed to client; serve via signed URL or proxy endpoint

**PDF Export**
- [ ] Secure PDF generation: server-side only via Node.js; no SPII in client-visible HTML
- [ ] Watermark applied on full SPII exports

**Data Governance**
- [ ] Data retention policy: configurable; enforced on archived records
- [ ] Legal hold flag prevents deletion when active
- [ ] Audit log (`audit.WorkupAuditLog`) is immutable — no UPDATE/DELETE rights granted to any app principal; verified via Azure SQL permission audit

**RBAC**
- [ ] RBAC enforced at both the API route handler AND the service layer
- [ ] API routes enforce identical RBAC as the React UI — no endpoint bypasses UI restrictions
- [ ] `COMPLIANCE_OFFICER` audit log access scoped to company only (`CompanyId` filter always applied server-side)

**Other**
- [ ] Duplicate detection on SSN token and Name+DOB before save
- [ ] Concurrency control on draft editing (Prisma optimistic concurrency via `_version` field or row version)
- [ ] All Azure secrets and Key Vault URI stored as **Azure App Service / Container App environment variables** — never in repository
- [ ] Azure AD (Entra ID) authentication configured; role claims mapped to Guardian `UserRole` type on session

---

## 13. Testing Requirements

### Unit Tests (minimum coverage)
- `encryptionService.ts`: encrypt/decrypt round-trip; failure on tampered ciphertext
- `maskingService.ts`: SSN masking; Account masking; IP masking per role (`USER` vs `COMPLIANCE_OFFICER` vs `JAFAR`)
- `rbacService.ts` / `hasWorkupPermission()`: every role against every permission; confirm denial cases
- `auditService.ts`: log write success; log write failure rolls back parent transaction
- Validation (Zod schemas): DOB future date rejection; SSN format; IP format (IPv4 + IPv6); mutex checklist states

### Integration Tests
- Full workup create → draft save → submit → review workflow as `USER` role
- `SUPERVISOR` approval flow; `MANAGER` assign flow
- SPII view events generate correct audit entries with correct role recorded
- PDF export masking rules applied correctly per role — test `USER` (masked) vs `COMPLIANCE_OFFICER` (full SPII with watermark)
- Duplicate SSN detection alert fires correctly
- Legal hold prevents deletion

### Security Tests
- Call Full SPII export API as `USER` role → expect **HTTP 403**
- Call audit log API as `ADMIN` role → expect **HTTP 403** (ADMIN cannot view audit logs — only `COMPLIANCE_OFFICER` and `JAFAR`)
- Call audit log API as `COMPLIANCE_OFFICER` with a different company's `workupId` → expect **HTTP 403** (company scope enforced)
- POST to any API route with CSRF token missing → expect **HTTP 403**
- Inject `<script>alert(1)</script>` in free-text field → verify stored value is sanitized
- Submit checklist with both Positive and Negative set for same row → expect validation error
- Attempt to `PATCH` workup record as `COMPLIANCE_OFFICER` → expect **HTTP 403**

---

## 14. Definition of Done

A user story is **Done** when:

1. All acceptance criteria from the requirements document are implemented
2. Server-side RBAC check is in place (controller + service layer)
3. All relevant fields are encrypted at rest
4. All relevant actions generate audit log entries
5. Masking rules applied in API response DTOs
6. Unit tests written and passing
7. No plaintext SPII appears in any API response, log entry, or client HTML for unauthorized roles
8. Code reviewed against the Non-Functional Security Checklist (Section 12)

The **entire build** is Done when:
- All 20 user stories meet their Definition of Done
- End-to-end workflow test passes (create → draft → submit → review → export)
- Full security checklist (Section 12) is 100% checked
- PDF export tested for both masked and full SPII variants with correct watermarking
- Audit log verified as immutable (attempt to update/delete fails at DB level)

---

*End of Agent Instructions — SUBJECT_WORKUP_FORM_AGENT_INSTRUCTIONS.md v2.0*

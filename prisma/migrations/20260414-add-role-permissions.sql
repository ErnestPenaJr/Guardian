-- Phase 2 of guardian roles & access matrix.
--
-- Three tables back the JAFAR-managed permissions UI. Empty tables means
-- the hardcoded matrix in lib/permissions.cjs is the effective policy
-- (Phase 1 behavior). A row represents an EXPLICIT OVERRIDE — either
-- granting a permission that the matrix denies, or denying one it grants.
--
-- COMPANY_ID is nullable so future per-company overrides drop in without
-- another migration. Phase 2 only writes NULL (global). Resolution
-- precedence (left wins): per-company override > global override > matrix default.
--
-- All three tables follow the same shape so the cache loader can treat
-- them uniformly.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ROLE_PERMISSIONS' AND schema_id = SCHEMA_ID('GUARDIAN'))
BEGIN
    CREATE TABLE GUARDIAN.ROLE_PERMISSIONS (
        ROLE_PERMISSION_ID  BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ROLE_ID             INT NOT NULL,
        PERMISSION_KEY      VARCHAR(64) NOT NULL,
        GRANTED             BIT NOT NULL,
        COMPANY_ID          INT NULL,
        CREATE_DATE         DATETIME2 NOT NULL CONSTRAINT DF_RP_CREATE_DATE DEFAULT SYSUTCDATETIME(),
        UPDATE_DATE         DATETIME2 NULL,
        UPDATE_USER_ID      INT NULL,
        CONSTRAINT FK_RP_ROLE FOREIGN KEY (ROLE_ID) REFERENCES GUARDIAN.ROLES(ROLE_ID)
    );

    -- One row per (role, permission, company-scope). NULL company is the global default.
    CREATE UNIQUE INDEX UX_RP_ROLE_KEY_COMPANY
        ON GUARDIAN.ROLE_PERMISSIONS (ROLE_ID, PERMISSION_KEY, COMPANY_ID);
END;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ROLE_FORM_ALLOWLIST' AND schema_id = SCHEMA_ID('GUARDIAN'))
BEGIN
    CREATE TABLE GUARDIAN.ROLE_FORM_ALLOWLIST (
        ROLE_FORM_ALLOWLIST_ID  BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ROLE_ID                 INT NOT NULL,
        FORM_ID                 INT NOT NULL,
        GRANTED                 BIT NOT NULL,
        COMPANY_ID              INT NULL,
        CREATE_DATE             DATETIME2 NOT NULL CONSTRAINT DF_RFA_CREATE_DATE DEFAULT SYSUTCDATETIME(),
        UPDATE_DATE             DATETIME2 NULL,
        UPDATE_USER_ID          INT NULL,
        CONSTRAINT FK_RFA_ROLE FOREIGN KEY (ROLE_ID) REFERENCES GUARDIAN.ROLES(ROLE_ID),
        CONSTRAINT FK_RFA_FORM FOREIGN KEY (FORM_ID) REFERENCES GUARDIAN.FORMS(FORM_ID)
    );

    CREATE UNIQUE INDEX UX_RFA_ROLE_FORM_COMPANY
        ON GUARDIAN.ROLE_FORM_ALLOWLIST (ROLE_ID, FORM_ID, COMPANY_ID);
END;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ROLE_NOTICE_TYPE_ALLOWLIST' AND schema_id = SCHEMA_ID('GUARDIAN'))
BEGIN
    CREATE TABLE GUARDIAN.ROLE_NOTICE_TYPE_ALLOWLIST (
        ROLE_NOTICE_TYPE_ALLOWLIST_ID   BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ROLE_ID                         INT NOT NULL,
        NOTICE_TYPE                     VARCHAR(64) NOT NULL,
        GRANTED                         BIT NOT NULL,
        COMPANY_ID                      INT NULL,
        CREATE_DATE                     DATETIME2 NOT NULL CONSTRAINT DF_RNTA_CREATE_DATE DEFAULT SYSUTCDATETIME(),
        UPDATE_DATE                     DATETIME2 NULL,
        UPDATE_USER_ID                  INT NULL,
        CONSTRAINT FK_RNTA_ROLE FOREIGN KEY (ROLE_ID) REFERENCES GUARDIAN.ROLES(ROLE_ID)
    );

    CREATE UNIQUE INDEX UX_RNTA_ROLE_TYPE_COMPANY
        ON GUARDIAN.ROLE_NOTICE_TYPE_ALLOWLIST (ROLE_ID, NOTICE_TYPE, COMPANY_ID);
END;

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

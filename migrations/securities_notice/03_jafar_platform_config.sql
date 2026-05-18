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

-- Sample notices for testing the Notice Module
-- Run this AFTER the main migration (add_notice_module.sql)

-- Insert a sample notice
INSERT INTO [GUARDIAN].[NOTICES] (
    [TITLE],
    [CONTENT], 
    [NOTICE_TYPE],
    [STATUS],
    [ISSUED_BY_USER_ID],
    [ISSUE_DATE],
    [COMPANY_ID],
    [CREATE_USER_ID]
) VALUES (
    'Welcome to Guardian Notice System',
    'This is a sample notice to test the new Notice Module functionality. The system allows administrators and managers to send secure notices to users without relying on external email systems.',
    'General',
    'PUBLISHED',
    1111, -- Replace with actual user ID
    GETDATE(),
    26,   -- Replace with actual company ID  
    1111  -- Replace with actual user ID
);

-- Get the notice ID for adding recipients
DECLARE @NoticeId INT = SCOPE_IDENTITY();

-- Add the notice creator as a recipient (self-notification for testing)
INSERT INTO [GUARDIAN].[NOTICE_RECIPIENTS] (
    [NOTICE_ID],
    [RECIPIENT_USER_ID],
    [RECIPIENT_TYPE],
    [COMPANY_ID],
    [CREATE_USER_ID]
) VALUES (
    @NoticeId,
    1111, -- Replace with actual user ID
    'USER',
    26,   -- Replace with actual company ID
    1111  -- Replace with actual user ID
);

-- Insert another sample notice (unread)
INSERT INTO [GUARDIAN].[NOTICES] (
    [TITLE],
    [CONTENT],
    [NOTICE_TYPE], 
    [STATUS],
    [ISSUED_BY_USER_ID],
    [ISSUE_DATE],
    [COMPANY_ID],
    [CREATE_USER_ID]
) VALUES (
    'System Maintenance Notification',
    'Please be aware that system maintenance is scheduled for this weekend. During this time, some features may be temporarily unavailable. We apologize for any inconvenience.',
    'Urgent',
    'PUBLISHED',
    1111, -- Replace with actual user ID
    GETDATE(),
    26,   -- Replace with actual company ID
    1111  -- Replace with actual user ID
);

-- Add recipient for second notice
SET @NoticeId = SCOPE_IDENTITY();
INSERT INTO [GUARDIAN].[NOTICE_RECIPIENTS] (
    [NOTICE_ID],
    [RECIPIENT_USER_ID], 
    [RECIPIENT_TYPE],
    [COMPANY_ID],
    [CREATE_USER_ID]
) VALUES (
    @NoticeId,
    1111, -- Replace with actual user ID
    'USER', 
    26,   -- Replace with actual company ID
    1111  -- Replace with actual user ID
);
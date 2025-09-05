-- Add notification preferences column to USERS table
-- This allows users to configure their notification settings for emails, in-app alerts, and frequency
-- The column stores JSON data with notification preferences

USE [GUARDIAN-DEV];
GO

-- Add NOTIFICATION_PREFERENCES column to USERS table
ALTER TABLE GUARDIAN.USERS 
ADD [NOTIFICATION_PREFERENCES] NVARCHAR(2000) NULL;
GO

-- Add a comment describing the column's purpose
EXEC sys.sp_addextendedproperty 
    @name = N'MS_Description',
    @value = N'JSON string containing user notification preferences for email notifications, in-app notifications, and frequency settings',
    @level0type = N'SCHEMA', @level0name = N'GUARDIAN',
    @level1type = N'TABLE',  @level1name = N'USERS',
    @level2type = N'COLUMN', @level2name = N'NOTIFICATION_PREFERENCES';
GO

-- Create an index for efficient querying
CREATE NONCLUSTERED INDEX IX_USERS_NOTIFICATION_PREFERENCES 
ON GUARDIAN.USERS (NOTIFICATION_PREFERENCES) 
WHERE NOTIFICATION_PREFERENCES IS NOT NULL;
GO

PRINT 'Successfully added NOTIFICATION_PREFERENCES column to GUARDIAN.USERS table';

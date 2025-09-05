-- Add notification preferences column to USERS table
-- This allows users to configure their notification settings for emails, in-app alerts, and frequency
-- The column stores JSON data with notification preferences

-- Add NOTIFICATION_PREFERENCES column to USERS table
ALTER TABLE GUARDIAN.USERS 
ADD [NOTIFICATION_PREFERENCES] NVARCHAR(2000) NULL;
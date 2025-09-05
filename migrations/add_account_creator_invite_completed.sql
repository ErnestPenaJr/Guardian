-- Migration: Add ACCOUNT_CREATOR_INVITE_COMPLETED field to USERS table
-- Date: 2025-01-04
-- Purpose: Track whether the account creator has completed the initial invite modal

-- Add the new column with default value
ALTER TABLE GUARDIAN.USERS 
ADD ACCOUNT_CREATOR_INVITE_COMPLETED BIT NOT NULL DEFAULT 0;

-- Update existing users to default false (0) - this is optional since we have a default
-- UPDATE GUARDIAN.USERS SET ACCOUNT_CREATOR_INVITE_COMPLETED = 0 WHERE ACCOUNT_CREATOR_INVITE_COMPLETED IS NULL;

-- Add a helpful comment explaining the column
-- EXEC sp_addextendedproperty 
--     @name = N'MS_Description',
--     @value = N'Indicates whether the account creator has completed the initial invite modal on first login',
--     @level0type = N'SCHEMA',
--     @level0name = N'GUARDIAN',
--     @level1type = N'TABLE',
--     @level1name = N'USERS',
--     @level2type = N'COLUMN',
--     @level2name = N'ACCOUNT_CREATOR_INVITE_COMPLETED';
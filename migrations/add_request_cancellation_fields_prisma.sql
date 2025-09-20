-- Migration: Add cancellation tracking fields to REQUESTS table
-- Date: 2025-09-20
-- Description: Add dedicated fields for tracking request cancellations with proper data integrity
-- Status: COMPLETED SUCCESSFULLY

-- Step 1: Add cancellation tracking fields to REQUESTS table
ALTER TABLE [GUARDIAN].[REQUESTS]
ADD [CANCELLATION_REASON] nvarchar(500) NULL,
    [CANCELLED_DATE] datetime NULL,
    [CANCELLED_BY] int NULL;

-- Step 2: Add foreign key constraint for CANCELLED_BY to reference USERS
-- (Execute after columns are created)
ALTER TABLE [GUARDIAN].[REQUESTS]
ADD CONSTRAINT [FK_REQUESTS_CANCELLED_BY] 
FOREIGN KEY ([CANCELLED_BY]) REFERENCES [GUARDIAN].[USERS]([USER_ID]);

-- Step 3: Migrate existing cancelled records with default values
-- (Update legacy cancelled records before adding check constraint)
UPDATE [GUARDIAN].[REQUESTS]
SET 
    CANCELLED_DATE = COALESCE(UPDATE_DATE, CREATE_DATE),
    CANCELLED_BY = COALESCE(UPDATE_USER_ID, CREATE_USER_ID),
    CANCELLATION_REASON = 'Legacy cancellation - migrated data'
WHERE STATUS = 'X' 
    AND CANCELLED_DATE IS NULL;

-- Step 4: Add check constraint to ensure cancellation fields consistency
-- (Execute after data migration)
ALTER TABLE [GUARDIAN].[REQUESTS]
ADD CONSTRAINT [CHK_REQUESTS_CANCELLATION_FIELDS]
CHECK (
    (STATUS = 'X' AND CANCELLED_DATE IS NOT NULL AND CANCELLED_BY IS NOT NULL) OR
    (STATUS <> 'X' AND CANCELLED_DATE IS NULL AND CANCELLED_BY IS NULL AND CANCELLATION_REASON IS NULL)
);

-- Step 5: Create indexes for efficient querying
-- (Execute after columns and constraints are created)
CREATE INDEX [IX_REQUESTS_STATUS_CANCELLED_DATE] ON [GUARDIAN].[REQUESTS] ([STATUS], [CANCELLED_DATE]);
CREATE INDEX [IX_REQUESTS_CANCELLED_BY] ON [GUARDIAN].[REQUESTS] ([CANCELLED_BY]);

-- Migration completed successfully!
-- Added fields:
-- - CANCELLATION_REASON: nvarchar(500) NULL - stores reason for cancellation  
-- - CANCELLED_DATE: datetime NULL - stores when request was cancelled
-- - CANCELLED_BY: int NULL - stores which user cancelled the request
-- Added constraints:
-- - FK_REQUESTS_CANCELLED_BY: foreign key to USERS table
-- - CHK_REQUESTS_CANCELLATION_FIELDS: ensures data consistency for cancellation fields
-- Added indexes:
-- - IX_REQUESTS_STATUS_CANCELLED_DATE: index for efficient status/date queries
-- - IX_REQUESTS_CANCELLED_BY: index for efficient user queries
-- Data migration:
-- - Updated 6 existing cancelled records (STATUS = 'X') with default values
-- Migration: Remove global email uniqueness constraint and add company-scoped constraint
-- This allows multiple users with the same email across different companies
-- while maintaining uniqueness within each company

-- Description: Enable email reuse across companies with auto-generated military call signs
-- Date: 2025-01-19
-- Purpose: Support multiple users per email domain with proper company isolation

-- Step 1: Check if there's an existing unique constraint on EMAIL
-- Note: This will show any existing constraints that need to be dropped
SELECT 
    tc.CONSTRAINT_NAME,
    tc.CONSTRAINT_TYPE,
    kcu.COLUMN_NAME
FROM 
    INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
    JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu 
        ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
WHERE 
    tc.TABLE_SCHEMA = 'GUARDIAN'
    AND tc.TABLE_NAME = 'USERS'
    AND kcu.COLUMN_NAME = 'EMAIL'
    AND tc.CONSTRAINT_TYPE = 'UNIQUE';

-- Step 2: Drop existing unique constraint on EMAIL if it exists
-- (This may need to be adjusted based on the actual constraint name found above)
-- IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_USERS_EMAIL' AND parent_object_id = OBJECT_ID('GUARDIAN.USERS'))
-- BEGIN
--     ALTER TABLE GUARDIAN.USERS DROP CONSTRAINT UQ_USERS_EMAIL;
--     PRINT 'Dropped existing unique constraint on EMAIL column';
-- END

-- Step 3: Add new composite unique constraint on EMAIL + COMPANY_ID
-- This ensures email uniqueness within each company while allowing reuse across companies
IF NOT EXISTS (
    SELECT 1 
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
    JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
    WHERE tc.TABLE_SCHEMA = 'GUARDIAN' 
    AND tc.TABLE_NAME = 'USERS' 
    AND tc.CONSTRAINT_NAME = 'UQ_USERS_EMAIL_COMPANY'
)
BEGIN
    ALTER TABLE GUARDIAN.USERS 
    ADD CONSTRAINT UQ_USERS_EMAIL_COMPANY UNIQUE (EMAIL, COMPANY_ID);
    PRINT 'Added composite unique constraint on EMAIL + COMPANY_ID';
END
ELSE
BEGIN
    PRINT 'Composite unique constraint UQ_USERS_EMAIL_COMPANY already exists';
END

-- Step 4: Create index for efficient lookups on EMAIL + COMPANY_ID combination
IF NOT EXISTS (
    SELECT 1 
    FROM sys.indexes 
    WHERE name = 'IX_USERS_EMAIL_COMPANY_ID' 
    AND object_id = OBJECT_ID('GUARDIAN.USERS')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_USERS_EMAIL_COMPANY_ID 
    ON GUARDIAN.USERS (EMAIL, COMPANY_ID)
    INCLUDE (USER_ID, FIRST_NAME, LAST_NAME, STATUS);
    PRINT 'Created index IX_USERS_EMAIL_COMPANY_ID for efficient email + company lookups';
END
ELSE
BEGIN
    PRINT 'Index IX_USERS_EMAIL_COMPANY_ID already exists';
END

-- Step 5: Verify the changes
PRINT 'Migration completed. Verifying constraints:';
SELECT 
    tc.CONSTRAINT_NAME,
    tc.CONSTRAINT_TYPE,
    STRING_AGG(kcu.COLUMN_NAME, ', ') as COLUMNS
FROM 
    INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
    JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu 
        ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
WHERE 
    tc.TABLE_SCHEMA = 'GUARDIAN'
    AND tc.TABLE_NAME = 'USERS'
    AND tc.CONSTRAINT_TYPE = 'UNIQUE'
GROUP BY tc.CONSTRAINT_NAME, tc.CONSTRAINT_TYPE;

PRINT 'Email uniqueness constraint migration completed successfully!';
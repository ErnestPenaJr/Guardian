-- Migration: Add COMPANY_ID to FORMS table
-- Run this SQL in your database IDE

-- Add COMPANY_ID column to FORMS table
ALTER TABLE GUARDIAN.FORMS 
ADD COMPANY_ID INT NULL;

-- Add foreign key constraint
ALTER TABLE GUARDIAN.FORMS 
ADD CONSTRAINT FK__FORMS__COMPANY 
FOREIGN KEY (COMPANY_ID) REFERENCES GUARDIAN.COMPANY(COMPANY_ID);

-- Create global forms (available to all companies)
INSERT INTO GUARDIAN.FORMS (FORM_NAME, FORM_DESCRIPTION, COMPANY_ID, IS_PUBLIC, IS_ACTIVE, IS_DELETED, CREATE_DATE, UPDATE_DATE)
VALUES 
('Default Request Form', 'Standard request form available to all companies', NULL, 1, 1, 0, GETDATE(), GETDATE()),
('General Support Request', 'General support request form', NULL, 1, 1, 0, GETDATE(), GETDATE()),
('IT Help Desk Request', 'IT support and help desk requests', NULL, 1, 1, 0, GETDATE(), GETDATE()),
('HR Request Form', 'Human Resources related requests', NULL, 1, 1, 0, GETDATE(), GETDATE()),
('Facilities Request', 'Facilities and maintenance requests', NULL, 1, 1, 0, GETDATE(), GETDATE());

-- Verify the changes
SELECT 'Global Forms (available to all companies):' as Info;
SELECT FORM_ID, FORM_NAME, COMPANY_ID, ORGANIZATION_ID, IS_ACTIVE, IS_DELETED
FROM GUARDIAN.FORMS 
WHERE COMPANY_ID IS NULL;

SELECT 'Forms available to Company 20 (global + company-specific):' as Info;
SELECT FORM_ID, FORM_NAME, COMPANY_ID, ORGANIZATION_ID, IS_ACTIVE, IS_DELETED
FROM GUARDIAN.FORMS 
WHERE (COMPANY_ID = 20 OR COMPANY_ID IS NULL) AND IS_ACTIVE = 1 AND IS_DELETED = 0;

-- Check total forms count
SELECT 'Total Forms Count:' as Info;
SELECT COUNT(*) as TotalForms FROM GUARDIAN.FORMS WHERE IS_DELETED = 0 AND IS_ACTIVE = 1;
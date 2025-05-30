-- SQL Script to add standard form templates to the database
-- Based on the database schema diagram provided

-- Set variables
DECLARE @CurrentUserId INT = 1; -- Default admin user ID
DECLARE @CurrentDate DATETIME = GETDATE();
DECLARE @OrganizationId INT = 1; -- Default organization ID

-- Create temp table for field types if they don't exist
CREATE TABLE #TempFieldTypes (
    FIELD_TYPE_ID INT,
    FIELD_TYPE_DESC NVARCHAR(100),
    FIELD_TYPE_DESCRIPTION NVARCHAR(255),
    SORT_ORDER INT,
    IS_ACTIVE BIT,
    IS_DELETED BIT,
    CREATE_USER_ID INT,
    UPDATE_USER_ID INT
);

-- Insert field types into temp table
INSERT INTO #TempFieldTypes VALUES
    (1, 'Text', 'Single line text input', 1, 1, 0, @CurrentUserId, @CurrentUserId),
    (2, 'Number', 'Numeric input field', 2, 1, 0, @CurrentUserId, @CurrentUserId),
    (3, 'Date', 'Date picker field', 3, 1, 0, @CurrentUserId, @CurrentUserId),
    (4, 'SSN', 'Social Security Number field', 4, 1, 0, @CurrentUserId, @CurrentUserId);

-- 1. Ensure field types exist
MERGE INTO FIELD_TYPE AS target
USING (VALUES
    (1, 'Text', 'Single line text input', 1, 1, 0, @CurrentUserId, @CurrentUserId),
    (2, 'Number', 'Numeric input field', 2, 1, 0, @CurrentUserId, @CurrentUserId),
    (3, 'Date', 'Date picker field', 3, 1, 0, @CurrentUserId, @CurrentUserId),
    (4, 'SSN', 'Social Security Number field', 4, 1, 0, @CurrentUserId, @CurrentUserId)
) AS source(FIELD_TYPE_ID, FIELD_TYPE_DESC, FIELD_TYPE_DESCRIPTION, SORT_ORDER, IS_ACTIVE, IS_DELETED, CREATE_USER_ID, UPDATE_USER_ID)
ON target.FIELD_TYPE_ID = source.FIELD_TYPE_ID
WHEN MATCHED THEN
    UPDATE SET 
        FIELD_TYPE_DESC = source.FIELD_TYPE_DESC,
        FIELD_TYPE_DESCRIPTION = source.FIELD_TYPE_DESCRIPTION,
        SORT_ORDER = source.SORT_ORDER,
        IS_ACTIVE = source.IS_ACTIVE,
        IS_DELETED = source.IS_DELETED,
        UPDATE_USER_ID = source.UPDATE_USER_ID,
        UPDATE_DATE = @CurrentDate
WHEN NOT MATCHED THEN
    INSERT (FIELD_TYPE_ID, FIELD_TYPE_DESC, FIELD_TYPE_DESCRIPTION, SORT_ORDER, IS_ACTIVE, IS_DELETED, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE)
    VALUES (source.FIELD_TYPE_ID, source.FIELD_TYPE_DESC, source.FIELD_TYPE_DESCRIPTION, source.SORT_ORDER, source.IS_ACTIVE, source.IS_DELETED, source.CREATE_USER_ID, source.UPDATE_USER_ID, @CurrentDate, @CurrentDate);

-- 2. Add SUBJECT template
-- First, add the form
DECLARE @SubjectFormId INT;

IF NOT EXISTS (SELECT 1 FROM FORMS WHERE FORM_NAME = 'SUBJECT')
BEGIN
    INSERT INTO FORMS (FORM_NAME, FORM_DESCRIPTION, ORGANIZATION_ID, IS_PUBLIC, IS_ACTIVE, IS_DELETED, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE)
    VALUES ('SUBJECT', 'Personal information template', @OrganizationId, 1, 1, 0, @CurrentUserId, @CurrentUserId, @CurrentDate, @CurrentDate);
    
    SET @SubjectFormId = SCOPE_IDENTITY();
END
ELSE
BEGIN
    SELECT @SubjectFormId = FORM_ID FROM FORMS WHERE FORM_NAME = 'SUBJECT';
    
    UPDATE FORMS 
    SET FORM_DESCRIPTION = 'Personal information template',
        ORGANIZATION_ID = @OrganizationId,
        IS_PUBLIC = 1,
        IS_ACTIVE = 1,
        IS_DELETED = 0,
        UPDATE_USER_ID = @CurrentUserId,
        UPDATE_DATE = @CurrentDate
    WHERE FORM_ID = @SubjectFormId;
END

-- Then, add the fields for SUBJECT template
-- First Name
IF NOT EXISTS (SELECT 1 FROM FIELDS WHERE FORM_ID = @SubjectFormId AND FIELD_NAME = 'First Name')
BEGIN
    DECLARE @FirstNameFieldId INT;
    
    INSERT INTO FIELDS (FIELD_NAME, FIELD_TYPE_ID, FORM_ID, IS_REQUIRED, IS_PUBLIC, IS_ACTIVE, IS_DELETED, IS_SENSITIVE, HAS_LOOKUP, CAN_SELECT_MULIPLE, DISPLAY_FORMAT, SORT_ORDER, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE)
    VALUES ('First Name', 1, @SubjectFormId, 1, 1, 1, 0, 0, 0, 0, NULL, 1, @CurrentUserId, @CurrentUserId, @CurrentDate, @CurrentDate);
    
    SET @FirstNameFieldId = SCOPE_IDENTITY();
    
    INSERT INTO FORMS_FIELDS (FORM_ID, FIELD_ID, IS_REQUIRED, SORT_ORDER, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE)
    VALUES (@SubjectFormId, @FirstNameFieldId, 1, 1, @CurrentUserId, @CurrentUserId, @CurrentDate, @CurrentDate);
END

-- Middle Name
IF NOT EXISTS (SELECT 1 FROM FIELDS WHERE FORM_ID = @SubjectFormId AND FIELD_NAME = 'Middle Name')
BEGIN
    DECLARE @MiddleNameFieldId INT;
    
    INSERT INTO FIELDS (FIELD_NAME, FIELD_TYPE_ID, FORM_ID, IS_REQUIRED, IS_PUBLIC, IS_ACTIVE, IS_DELETED, IS_SENSITIVE, HAS_LOOKUP, CAN_SELECT_MULIPLE, DISPLAY_FORMAT, SORT_ORDER, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE)
    VALUES ('Middle Name', 1, @SubjectFormId, 0, 1, 1, 0, 0, 0, 0, NULL, 2, @CurrentUserId, @CurrentUserId, @CurrentDate, @CurrentDate);
    
    SET @MiddleNameFieldId = SCOPE_IDENTITY();
    
    INSERT INTO FORMS_FIELDS (FORM_ID, FIELD_ID, IS_REQUIRED, SORT_ORDER, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE)
    VALUES (@SubjectFormId, @MiddleNameFieldId, 0, 2, @CurrentUserId, @CurrentUserId, @CurrentDate, @CurrentDate);
END

-- Last Name
IF NOT EXISTS (SELECT 1 FROM FIELDS WHERE FORM_ID = @SubjectFormId AND FIELD_NAME = 'Last Name')
BEGIN
    DECLARE @LastNameFieldId INT;
    
    INSERT INTO FIELDS (FIELD_NAME, FIELD_TYPE_ID, FORM_ID, IS_REQUIRED, IS_PUBLIC, IS_ACTIVE, IS_DELETED, IS_SENSITIVE, HAS_LOOKUP, CAN_SELECT_MULIPLE, DISPLAY_FORMAT, SORT_ORDER, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE)
    VALUES ('Last Name', 1, @SubjectFormId, 1, 1, 1, 0, 0, 0, 0, NULL, 3, @CurrentUserId, @CurrentUserId, @CurrentDate, @CurrentDate);
    
    SET @LastNameFieldId = SCOPE_IDENTITY();
    
    INSERT INTO FORMS_FIELDS (FORM_ID, FIELD_ID, IS_REQUIRED, SORT_ORDER, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE)
    VALUES (@SubjectFormId, @LastNameFieldId, 1, 3, @CurrentUserId, @CurrentUserId, @CurrentDate, @CurrentDate);
END

-- Date of Birth
IF NOT EXISTS (SELECT 1 FROM FIELDS WHERE FORM_ID = @SubjectFormId AND FIELD_NAME = 'Date of Birth')
BEGIN
    DECLARE @DOBFieldId INT;
    
    INSERT INTO FIELDS (FIELD_NAME, FIELD_TYPE_ID, FORM_ID, IS_REQUIRED, IS_PUBLIC, IS_ACTIVE, IS_DELETED, IS_SENSITIVE, HAS_LOOKUP, CAN_SELECT_MULIPLE, DISPLAY_FORMAT, SORT_ORDER, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE)
    VALUES ('Date of Birth', 3, @SubjectFormId, 1, 1, 1, 0, 1, 0, 0, 'MM/DD/YYYY', 4, @CurrentUserId, @CurrentUserId, @CurrentDate, @CurrentDate);
    
    SET @DOBFieldId = SCOPE_IDENTITY();
    
    INSERT INTO FORMS_FIELDS (FORM_ID, FIELD_ID, IS_REQUIRED, SORT_ORDER, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE)
    VALUES (@SubjectFormId, @DOBFieldId, 1, 4, @CurrentUserId, @CurrentUserId, @CurrentDate, @CurrentDate);
END

-- SSN
IF NOT EXISTS (SELECT 1 FROM FIELDS WHERE FORM_ID = @SubjectFormId AND FIELD_NAME = 'SSN')
BEGIN
    DECLARE @SSNFieldId INT;
    
    INSERT INTO FIELDS (FIELD_NAME, FIELD_TYPE_ID, FORM_ID, IS_REQUIRED, IS_PUBLIC, IS_ACTIVE, IS_DELETED, IS_SENSITIVE, HAS_LOOKUP, CAN_SELECT_MULIPLE, DISPLAY_FORMAT, SORT_ORDER, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE)
    VALUES ('SSN', 4, @SubjectFormId, 1, 1, 1, 0, 1, 0, 0, 'XXX-XX-XXXX', 5, @CurrentUserId, @CurrentUserId, @CurrentDate, @CurrentDate);
    
    SET @SSNFieldId = SCOPE_IDENTITY();
    
    INSERT INTO FORMS_FIELDS (FORM_ID, FIELD_ID, IS_REQUIRED, SORT_ORDER, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE)
    VALUES (@SubjectFormId, @SSNFieldId, 1, 5, @CurrentUserId, @CurrentUserId, @CurrentDate, @CurrentDate);
END

-- 3. Add FINANCIAL template
-- First, add the form
DECLARE @FinancialFormId INT;

IF NOT EXISTS (SELECT 1 FROM FORMS WHERE FORM_NAME = 'FINANCIAL')
BEGIN
    INSERT INTO FORMS (FORM_NAME, FORM_DESCRIPTION, ORGANIZATION_ID, IS_PUBLIC, IS_ACTIVE, IS_DELETED, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE)
    VALUES ('FINANCIAL', 'Banking information template', @OrganizationId, 1, 1, 0, @CurrentUserId, @CurrentUserId, @CurrentDate, @CurrentDate);
    
    SET @FinancialFormId = SCOPE_IDENTITY();
END
ELSE
BEGIN
    SELECT @FinancialFormId = FORM_ID FROM FORMS WHERE FORM_NAME = 'FINANCIAL';
    
    UPDATE FORMS 
    SET FORM_DESCRIPTION = 'Banking information template',
        ORGANIZATION_ID = @OrganizationId,
        IS_PUBLIC = 1,
        IS_ACTIVE = 1,
        IS_DELETED = 0,
        UPDATE_USER_ID = @CurrentUserId,
        UPDATE_DATE = @CurrentDate
    WHERE FORM_ID = @FinancialFormId;
END

-- Then, add the fields for FINANCIAL template
-- Bank Name
IF NOT EXISTS (SELECT 1 FROM FIELDS WHERE FORM_ID = @FinancialFormId AND FIELD_NAME = 'Bank Name')
BEGIN
    DECLARE @BankNameFieldId INT;
    
    INSERT INTO FIELDS (FIELD_NAME, FIELD_TYPE_ID, FORM_ID, IS_REQUIRED, IS_PUBLIC, IS_ACTIVE, IS_DELETED, IS_SENSITIVE, HAS_LOOKUP, CAN_SELECT_MULIPLE, DISPLAY_FORMAT, SORT_ORDER, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE)
    VALUES ('Bank Name', 1, @FinancialFormId, 1, 1, 1, 0, 0, 0, 0, NULL, 1, @CurrentUserId, @CurrentUserId, @CurrentDate, @CurrentDate);
    
    SET @BankNameFieldId = SCOPE_IDENTITY();
    
    INSERT INTO FORMS_FIELDS (FORM_ID, FIELD_ID, IS_REQUIRED, SORT_ORDER, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE)
    VALUES (@FinancialFormId, @BankNameFieldId, 1, 1, @CurrentUserId, @CurrentUserId, @CurrentDate, @CurrentDate);
END

-- Account Number
IF NOT EXISTS (SELECT 1 FROM FIELDS WHERE FORM_ID = @FinancialFormId AND FIELD_NAME = 'Account Number')
BEGIN
    DECLARE @AccountNumberFieldId INT;
    
    INSERT INTO FIELDS (FIELD_NAME, FIELD_TYPE_ID, FORM_ID, IS_REQUIRED, IS_PUBLIC, IS_ACTIVE, IS_DELETED, IS_SENSITIVE, HAS_LOOKUP, CAN_SELECT_MULIPLE, DISPLAY_FORMAT, SORT_ORDER, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE)
    VALUES ('Account Number', 1, @FinancialFormId, 1, 1, 1, 0, 1, 0, 0, NULL, 2, @CurrentUserId, @CurrentUserId, @CurrentDate, @CurrentDate);
    
    SET @AccountNumberFieldId = SCOPE_IDENTITY();
    
    INSERT INTO FORMS_FIELDS (FORM_ID, FIELD_ID, IS_REQUIRED, SORT_ORDER, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE)
    VALUES (@FinancialFormId, @AccountNumberFieldId, 1, 2, @CurrentUserId, @CurrentUserId, @CurrentDate, @CurrentDate);
END

-- Routing Number
IF NOT EXISTS (SELECT 1 FROM FIELDS WHERE FORM_ID = @FinancialFormId AND FIELD_NAME = 'Routing Number')
BEGIN
    DECLARE @RoutingNumberFieldId INT;
    
    INSERT INTO FIELDS (FIELD_NAME, FIELD_TYPE_ID, FORM_ID, IS_REQUIRED, IS_PUBLIC, IS_ACTIVE, IS_DELETED, IS_SENSITIVE, HAS_LOOKUP, CAN_SELECT_MULIPLE, DISPLAY_FORMAT, SORT_ORDER, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE)
    VALUES ('Routing Number', 1, @FinancialFormId, 1, 1, 1, 0, 1, 0, 0, NULL, 3, @CurrentUserId, @CurrentUserId, @CurrentDate, @CurrentDate);
    
    SET @RoutingNumberFieldId = SCOPE_IDENTITY();
    
    INSERT INTO FORMS_FIELDS (FORM_ID, FIELD_ID, IS_REQUIRED, SORT_ORDER, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE)
    VALUES (@FinancialFormId, @RoutingNumberFieldId, 1, 3, @CurrentUserId, @CurrentUserId, @CurrentDate, @CurrentDate);
END

-- 4. Add ADDRESS template
-- First, add the form
DECLARE @AddressFormId INT;

IF NOT EXISTS (SELECT 1 FROM FORMS WHERE FORM_NAME = 'ADDRESS')
BEGIN
    INSERT INTO FORMS (FORM_NAME, FORM_DESCRIPTION, ORGANIZATION_ID, IS_PUBLIC, IS_ACTIVE, IS_DELETED, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE)
    VALUES ('ADDRESS', 'Address information template', @OrganizationId, 1, 1, 0, @CurrentUserId, @CurrentUserId, @CurrentDate, @CurrentDate);
    
    SET @AddressFormId = SCOPE_IDENTITY();
END
ELSE
BEGIN
    SELECT @AddressFormId = FORM_ID FROM FORMS WHERE FORM_NAME = 'ADDRESS';
    
    UPDATE FORMS 
    SET FORM_DESCRIPTION = 'Address information template',
        ORGANIZATION_ID = @OrganizationId,
        IS_PUBLIC = 1,
        IS_ACTIVE = 1,
        IS_DELETED = 0,
        UPDATE_USER_ID = @CurrentUserId,
        UPDATE_DATE = @CurrentDate
    WHERE FORM_ID = @AddressFormId;
END

-- Then, add the fields for ADDRESS template
-- Address Line 1
IF NOT EXISTS (SELECT 1 FROM FIELDS WHERE FORM_ID = @AddressFormId AND FIELD_NAME = 'Address Line 1')
BEGIN
    DECLARE @AddressLine1FieldId INT;
    
    INSERT INTO FIELDS (FIELD_NAME, FIELD_TYPE_ID, FORM_ID, IS_REQUIRED, IS_PUBLIC, IS_ACTIVE, IS_DELETED, IS_SENSITIVE, HAS_LOOKUP, CAN_SELECT_MULIPLE, DISPLAY_FORMAT, SORT_ORDER, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE)
    VALUES ('Address Line 1', 1, @AddressFormId, 1, 1, 1, 0, 0, 0, 0, NULL, 1, @CurrentUserId, @CurrentUserId, @CurrentDate, @CurrentDate);
    
    SET @AddressLine1FieldId = SCOPE_IDENTITY();
    
    INSERT INTO FORMS_FIELDS (FORM_ID, FIELD_ID, IS_REQUIRED, SORT_ORDER, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE)
    VALUES (@AddressFormId, @AddressLine1FieldId, 1, 1, @CurrentUserId, @CurrentUserId, @CurrentDate, @CurrentDate);
END

-- Address Line 2
IF NOT EXISTS (SELECT 1 FROM FIELDS WHERE FORM_ID = @AddressFormId AND FIELD_NAME = 'Address Line 2')
BEGIN
    DECLARE @AddressLine2FieldId INT;
    
    INSERT INTO FIELDS (FIELD_NAME, FIELD_TYPE_ID, FORM_ID, IS_REQUIRED, IS_PUBLIC, IS_ACTIVE, IS_DELETED, IS_SENSITIVE, HAS_LOOKUP, CAN_SELECT_MULIPLE, DISPLAY_FORMAT, SORT_ORDER, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE)
    VALUES ('Address Line 2', 1, @AddressFormId, 0, 1, 1, 0, 0, 0, 0, NULL, 2, @CurrentUserId, @CurrentUserId, @CurrentDate, @CurrentDate);
    
    SET @AddressLine2FieldId = SCOPE_IDENTITY();
    
    INSERT INTO FORMS_FIELDS (FORM_ID, FIELD_ID, IS_REQUIRED, SORT_ORDER, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE)
    VALUES (@AddressFormId, @AddressLine2FieldId, 0, 2, @CurrentUserId, @CurrentUserId, @CurrentDate, @CurrentDate);
END

-- City
IF NOT EXISTS (SELECT 1 FROM FIELDS WHERE FORM_ID = @AddressFormId AND FIELD_NAME = 'City')
BEGIN
    DECLARE @CityFieldId INT;
    
    INSERT INTO FIELDS (FIELD_NAME, FIELD_TYPE_ID, FORM_ID, IS_REQUIRED, IS_PUBLIC, IS_ACTIVE, IS_DELETED, IS_SENSITIVE, HAS_LOOKUP, CAN_SELECT_MULIPLE, DISPLAY_FORMAT, SORT_ORDER, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE)
    VALUES ('City', 1, @AddressFormId, 1, 1, 1, 0, 0, 0, 0, NULL, 3, @CurrentUserId, @CurrentUserId, @CurrentDate, @CurrentDate);
    
    SET @CityFieldId = SCOPE_IDENTITY();
    
    INSERT INTO FORMS_FIELDS (FORM_ID, FIELD_ID, IS_REQUIRED, SORT_ORDER, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE)
    VALUES (@AddressFormId, @CityFieldId, 1, 3, @CurrentUserId, @CurrentUserId, @CurrentDate, @CurrentDate);
END

-- State
IF NOT EXISTS (SELECT 1 FROM FIELDS WHERE FORM_ID = @AddressFormId AND FIELD_NAME = 'State')
BEGIN
    DECLARE @StateFieldId INT;
    
    INSERT INTO FIELDS (FIELD_NAME, FIELD_TYPE_ID, FORM_ID, IS_REQUIRED, IS_PUBLIC, IS_ACTIVE, IS_DELETED, IS_SENSITIVE, HAS_LOOKUP, CAN_SELECT_MULIPLE, DISPLAY_FORMAT, SORT_ORDER, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE)
    VALUES ('State', 1, @AddressFormId, 1, 1, 1, 0, 0, 1, 0, NULL, 4, @CurrentUserId, @CurrentUserId, @CurrentDate, @CurrentDate);
    
    SET @StateFieldId = SCOPE_IDENTITY();
    
    INSERT INTO FORMS_FIELDS (FORM_ID, FIELD_ID, IS_REQUIRED, SORT_ORDER, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE)
    VALUES (@AddressFormId, @StateFieldId, 1, 4, @CurrentUserId, @CurrentUserId, @CurrentDate, @CurrentDate);
END

-- ZIP Code
IF NOT EXISTS (SELECT 1 FROM FIELDS WHERE FORM_ID = @AddressFormId AND FIELD_NAME = 'ZIP Code')
BEGIN
    DECLARE @ZipCodeFieldId INT;
    
    INSERT INTO FIELDS (FIELD_NAME, FIELD_TYPE_ID, FORM_ID, IS_REQUIRED, IS_PUBLIC, IS_ACTIVE, IS_DELETED, IS_SENSITIVE, HAS_LOOKUP, CAN_SELECT_MULIPLE, DISPLAY_FORMAT, SORT_ORDER, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE)
    VALUES ('ZIP Code', 1, @AddressFormId, 1, 1, 1, 0, 0, 0, 0, NULL, 5, @CurrentUserId, @CurrentUserId, @CurrentDate, @CurrentDate);
    
    SET @ZipCodeFieldId = SCOPE_IDENTITY();
    
    INSERT INTO FORMS_FIELDS (FORM_ID, FIELD_ID, IS_REQUIRED, SORT_ORDER, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE)
    VALUES (@AddressFormId, @ZipCodeFieldId, 1, 5, @CurrentUserId, @CurrentUserId, @CurrentDate, @CurrentDate);
END

PRINT 'Standard form templates have been added successfully.';

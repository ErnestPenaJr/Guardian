-- Populate FIELD_TYPE table with standard field types
INSERT INTO GUARDIAN.FIELD_TYPE (FIELD_TYPE_DESC, SORT_ORDER) VALUES
('Text Input', 1),
('Textarea', 2),
('Number', 3),
('Email', 4),
('Phone', 5),
('Date', 6),
('Time', 7),
('DateTime', 8),
('Dropdown', 9),
('Radio Button', 10),
('Checkbox', 11),
('File Upload', 12),
('URL', 13),
('Password', 14),
('Hidden', 15);

-- Populate FIELD_LOOKUP_DISPLAY_TYPE table with display types
INSERT INTO GUARDIAN.FIELD_LOOKUP_DISPLAY_TYPE (FIELD_LOOKUP_DISPLAY_TYPE_DESCRIPTION, SORT_ORDER) VALUES
('Dropdown List', 1),
('Radio Buttons', 2),
('Checkboxes', 3),
('Multi-select List', 4),
('Button Group', 5);

-- Create a default form template if none exists
IF NOT EXISTS (SELECT 1 FROM GUARDIAN.FORMS WHERE FORM_NAME = 'Default Request Form')
BEGIN
    INSERT INTO GUARDIAN.FORMS (FORM_NAME, FORM_DESCRIPTION, IS_PUBLIC, IS_ACTIVE, IS_DELETED, CREATE_DATE, UPDATE_DATE)
    VALUES ('Default Request Form', 'Default form template for requests', 1, 1, 0, GETDATE(), GETDATE());
END

-- Verify the data was inserted
SELECT 'FIELD_TYPE Table:' as TableName;
SELECT * FROM GUARDIAN.FIELD_TYPE ORDER BY SORT_ORDER;

SELECT 'FIELD_LOOKUP_DISPLAY_TYPE Table:' as TableName;
SELECT * FROM GUARDIAN.FIELD_LOOKUP_DISPLAY_TYPE ORDER BY SORT_ORDER;

SELECT 'FORMS Table:' as TableName;
SELECT * FROM GUARDIAN.FORMS WHERE IS_DELETED = 0;
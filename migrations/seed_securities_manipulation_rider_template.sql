-- Seeds the SECURITIES_MANIPULATION subpoena language template for company 54
-- so the rider generator has a template to populate immediately. The body
-- includes [IDENTIFIER_BLOCK] which the server expands from the notice's
-- persisted template values (PII redacted).
--
-- Free-form tokens the Processor fills at generation time:
--   [INSTITUTION_NAME] [INSTITUTION_DEPARTMENT] [INSTITUTION_ADDRESS_LINE_1]
--   [INSTITUTION_CITY_STATE_ZIP] [INSTITUTION_FAX] [PERIOD_START_DATE]
--
-- Idempotent: only inserts if no row exists for (company, fraud_type).
IF NOT EXISTS (
    SELECT 1 FROM GUARDIAN.SUBPOENA_LANGUAGE_TEMPLATES
    WHERE COMPANY_ID = 54 AND FRAUD_TYPE = 'SECURITIES_MANIPULATION'
)
BEGIN
    INSERT INTO GUARDIAN.SUBPOENA_LANGUAGE_TEMPLATES
        (COMPANY_ID, FRAUD_TYPE, BASE_LANGUAGE, TOKENS_JSON, CREATED_BY, CREATED_AT, UPDATED_AT)
    VALUES (
        54,
        'SECURITIES_MANIPULATION',
        N'                                  RIDER

BY FAX
[INSTITUTION_NAME]
Attn: [INSTITUTION_DEPARTMENT]
[INSTITUTION_ADDRESS_LINE_1]
[INSTITUTION_CITY_STATE_ZIP]
Fax: [INSTITUTION_FAX]

For the period of [PERIOD_START_DATE] the date of this subpoena, all
documents relating to the following individuals, entities, and/or
accounts:

[IDENTIFIER_BLOCK]

This should include, but not be limited to, the following documents and data:

  1. All savings, checking, loan and credit card accounts for the above
     listed accounts, individuals and businesses;

  2. The associated financial institution and account numbers;

  3. The associated dates of transaction;

  4. All account opening documentation;

  5. Savings accounts - signature cards, items of deposit, deposit tickets,
     items of withdrawal, withdrawal tickets, statement of account, 1099''s
     issued or other correspondence sent indicating interest earned, and all
     correspondence and notes of telephone conversations or discussions;

  6. Certificates of deposit - signature cards, items of deposit, deposit
     tickets, items of withdrawal, withdrawal tickets, items of payoff,
     payoff ticket, statements of account, 1099''s issued or other
     correspondence sent indicating interest earned, and all correspondence
     and notes of telephone conversations or discussions.',
        N'[
  {"token":"INSTITUTION_NAME","description":"Receiving institution legal name","autoPopulateFromIncident":false},
  {"token":"INSTITUTION_DEPARTMENT","description":"Subpoena processing department","autoPopulateFromIncident":false},
  {"token":"INSTITUTION_ADDRESS_LINE_1","description":"Street address line 1","autoPopulateFromIncident":false},
  {"token":"INSTITUTION_CITY_STATE_ZIP","description":"City, State ZIP","autoPopulateFromIncident":false},
  {"token":"INSTITUTION_FAX","description":"Fax number","autoPopulateFromIncident":false},
  {"token":"PERIOD_START_DATE","description":"Records period start date (e.g. January 1, 2019)","autoPopulateFromIncident":false}
]',
        1,
        GETDATE(),
        GETDATE()
    );
END

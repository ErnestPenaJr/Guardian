# Epic: Secure Subject Workup Request Form (PII / SPII Controlled)

**Epic Goal:**

Enable authorized personnel to securely create, edit, manage, and export
subject workup records containing PII, Sensitive PII (SPII), financial
identifiers, and criminal intelligence data with encryption, RBAC,
validation, and full audit logging.

# US-SW-001: Create Subject Workup Record Header

**As an** authorized investigator or analyst

**I want** to initiate a Subject Workup record

**So that** investigative documentation is standardized and traceable

### Fields (Header Section)

-   Subject Workup ID (System Generated -- Non-PII)

-   Analyst (Auto-populated from authenticated session)

-   Analyst or investigator (Selectable, role-based)

-   Date (Auto UTC timestamp; editable only by privileged role)

-   Case \# (Text field that can handle all numeric and chars)

### Acceptance Criteria

1.  System generates a unique, non-PII identifier.

2.  Analyst auto-populates from logged-in user.

3.  Case \# must validate against existing case records.

4.  Creation event must be audit logged.

5.  All data encrypted in transit (TLS 1.2+ minimum).

# US-SW-002: Capture Subject Identification & Biographical Data

**As an** authorized investigator or analyst

**I want** to securely enter subject biographical and identifying
information

**So that** the subject can be uniquely and accurately identified

### Fields

-   Subject Name(s) (First, Middle, Last, Suffix)

-   AKA(s) (multi-value input)

-   DOB (date picker control; no free-text entry)

-   SSN (Sensitive PII)

-   State DL (with issuing state dropdown)

-   Account \# (financial account identifier)

-   FBISID \# (or similar agency identifier)

-   Other ID #s (multi-value, type-selectable)

### Acceptance Criteria

1.  DOB must:

    a.  Use calendar date picker

    b.  Prevent future dates

    c.  Validate reasonable age range (configurable)

2.  SSN:

    a.  Field-level encryption at rest

    b.  Masked by default (XXX-XX-####)

    c.  Viewable only by authorized roles

    d.  Full-view event must be audit logged

3.  Account #:

    a.  Tokenized for indexing

    b.  Masked except last 4 digits

    c.  Restricted from export without elevated permission

4.  Duplicate detection:

    a.  Alert on exact SSN match

    b.  Alert on Name + DOB combination

5.  All SPII fields encrypted at rest (AES-256 or equivalent).

# US-SW-003: Capture Demographic & Physical Description Data

**As an** authorized investigator or analyst

**I want** structured demographic and physical characteristic inputs

**So that** data remains standardized and searchable

### Fields

-   Gender (controlled dropdown)

-   Race (controlled dropdown)

-   Place of Birth (City, State, Country)

-   Height (unit selectable)

-   Weight (unit selectable)

-   Eye Color (controlled dropdown)

-   Hair Color (controlled dropdown)

-   Tattoos/Marks (controlled dropdown)

    -   Identifier location: controlled dropdown

-   Special Notes (single line of text)

### Acceptance Criteria

1.  Controlled dropdown centrally managed by administrator.

2.  Free-text fields:

    a.  Character limits enforced

    b.  HTML/script injection sanitized

3.  Edits generate field-level audit logs.

# US-SW-004: Capture Contact & Digital Identifiers

**As an** authorized investigator or analyst

**I want** to enter contact and digital identifiers

**So that** subject communication channels are documented

### Fields (Multi-Entry Supported)

-   Address(es)

-   Phone Number(s)

-   IP Address(es)

-   Social Media Accounts (Platform + Handle + URL)

### Acceptance Criteria

1.  Multiple entries allowed per category.

2.  IP addresses validated (IPv4/IPv6 format).

3.  Phone numbers validated by format (country-aware).

4.  All entries encrypted at rest.

5.  Role-based masking for exports.

6.  Add/Edit/Delete actions logged.

# US-SW-005: Criminal History Section

**As an** authorized investigator or analyst

**I want** to document criminal history

**So that** prior conduct is formally recorded

### Field

-   Criminal History (multi-line structured narrative)

### Acceptance Criteria

1.  Field must:

    a.  Enforce character limits

2.  Access restricted to authorized investigative roles.

3.  Allow for users to copy/paste information.

4.  Field encrypted at rest.

5.  Edits generate immutable audit log entries.

# US-SW-006: Other Subject Notes Section

**As an** authorized investigator or analyst

**I want** to record supplemental notes

**So that** contextual intelligence is preserved

### Field

-   Other Subject Notes (multi-line text)

### Acceptance Criteria

1.  Encrypted at rest.

2.  Version history retained.

3.  Allow users ability to copy/paste information.

4.  Role-based visibility (configurable: Restricted / General).

5.  Legal hold flag prevents deletion if active investigation.

# US-SW-007: Role-Based Access Control (RBAC)

**As a** system administrator

**I want** granular permission control over PII fields

**So that** least-privilege access is enforced

### Roles (Example)

-   Analyst or investigator

-   Senior Analyst or investigator

-   Supervisor

-   Compliance Officer

-   Read-Only Reviewer

### Acceptance Criteria

1.  SPII access requires explicit Sensitive Data permission.

2.  Export privileges separated into:

    a.  Masked Export

    b.  Full Export (SPII)

3.  All permission checks enforced server-side.

4.  API enforces identical controls as UI.

# US-SW-008: Audit Logging & Traceability

**As a** compliance officer

**I want** complete logging of access and modifications

**So that** regulatory requirements are met

### Must Log

-   Record creation

-   Field-level edits (delta logging)

-   SSN/full SPII view events

-   Export events

-   Failed access attempts

### Audit Log Data

-   User ID

-   Role at time of action

-   Timestamp (UTC)

-   User IP

-   Action performed

-   Fields impacted

Audit logs must be:

-   Immutable

-   Retained per retention policy

-   Non-editable by standard users

# US-SW-009: Investigative / Intelligence Notes Section

**As an** investigator or analyst\
**I want** to enter narrative investigative notes\
**So that** context and intelligence objectives are clearly documented

### Field

-   Investigative / Intelligence Notes of Interest (Multi-line text)

### Acceptance Criteria

1.  Field must:

    a.  Enforce character limits (configurable)

    b.  Sanitize against HTML/script injection

    c.  Encrypt at rest

2.  Role-based visibility:

    a.  General Investigator or analysts (View/Edit)

    b.  Supervisors (View/Edit)

    c.  Read-only roles (View Only)

3.  All edits produce:

    a.  Field-level audit delta logs (before/after hash reference)

# US-SW-010: Minimum Collection Checklist (Financial & Communication Indicators)

**As an** investigator or analyst\
**I want** to indicate which minimum collection data sources were
reviewed and their results\
**So that** due diligence documentation is standardized

### Minimum Collection Fields (Checkbox Matrix: Positive / Negative Results)

-   Account Statements / Documents

-   FinCEN / SAR

-   Master OBI / TRAP Data

-   Address Information

-   Phone Numbers / Emails

-   Phone Calls

-   Branch Video / Photographs

-   Wire / ACH Activity

-   Deposit Activity

-   Withdrawal Activity

-   Crypto Activity

-   Securities Activity

-   Debit Card Info / SMS Alerts

-   AUTHLOGS / IP Data (Face ID)

-   DOC V x2

-   Account Holder Interviewed

-   Social Media

-   Additional Contact Information

### Acceptance Criteria

1.  Each row must allow:

    a.  Positive Result selection

    b.  Negative Result selection

    c.  Not Reviewed (default state)

2.  Financial indicators (SPII-adjacent data) must:

    a.  Be classified as Restricted Financial Intelligence

    b.  Be encrypted at rest

3.  Changes to checklist must:

    a.  Log user ID, timestamp, prior state

4.  System must prevent both Positive and Negative being selected
    simultaneously.

# US-SW-011: Sources -- Subject Identification

**As an** investigator or analyst\
**I want** to document identification sources consulted\
**So that** subject verification is traceable

### Subject Identification Sources

-   Flashpoint

-   Photo

-   Vehicle(s)

### Acceptance Criteria

1.  Each source must support:

    a.  Positive / Negative result toggle

    b.  Optional notes attachment

2.  External data sources (e.g., Flashpoint):

    a.  Must not store raw third-party credentials

    b.  Must log access if system-integrated

3.  Vehicle entries must support:

    a.  Plate number (masked by default)

    b.  State

    c.  Description

# US-SW-012: Property Data Sources

**As an** investigator or analyst\
**I want** to document property research performed\
**So that** asset intelligence is recorded

### Property Data Sources

-   Map Overlay

-   Street View

-   City / Town Tax Card

### Acceptance Criteria

1.  Address-based searches must:

    a.  Encrypt stored address data

    b.  Mask full address in exports based on role

2.  Map overlays must:

    a.  Not expose precise geolocation to unauthorized roles

3.  All selections must be audit logged.

# US-SW-013: Background Databases

**As an** investigator or analyst\
**I want** to record background database searches performed\
**So that** investigative transparency is maintained

### Database Source

-   CLEAR / Lexis Nexis

### Acceptance Criteria

1.  Database usage must:

    a.  Record that search was conducted

    b.  Not store raw credential tokens

2.  If integrated:

    a.  Log search event

    b.  Log querying user

    c.  Store only permissible returned data per license agreement

3.  Results must be classified as Restricted Law Enforcement Data.

# US-SW-014: OSINT / SOCMINT Section

**As an** investigator or analyst\
**I want** to record open-source intelligence findings\
**So that** digital presence is documented

### Fields

-   Social Media / CTI

-   OSINT

### Acceptance Criteria

1.  Must allow:

    a.  URL entry

    b.  Screenshot/document attachment (virus scanned)

    c.  Notes field

2.  IP addresses or handles entered must:

    a.  Validate format

    b.  Be encrypted at rest

3.  Export must respect masking rules.

# US-SW-015: Additional Data / Notes

**As an** investigator or analyst\
**I want** to add supplemental notes tied to collection results\
**So that** contextual information is preserved

### Field

-   Additional Data See Notes (multi-line text)

### Acceptance Criteria

1.  Character limits enforced.

2.  Field encrypted at rest.

3.  Edits tracked via audit logging.

4.  Legal hold flag must prevent deletion if case is active.

# US-SW-016: Role-Based Access Control & Data Classification

**As a** system administrator\
**I want** role-based access to workup data\
**So that** least-privilege access is enforced

### Roles

-   Analyst or investigator

-   Supervisor

-   Compliance Officer

-   Read-Only Reviewer

### Acceptance Criteria

1.  Sensitive financial indicators require elevated clearance.

2.  SPII (IP logs, financial activity indicators) restricted to
    authorized roles.

3.  All permission checks enforced server-side.

4.  API endpoints enforce identical RBAC as UI.

# US-SW-017: Save Subject Workup as Draft

-   **As an** authorized Analyst or investigator

**I want** to save a Subject Workup form as a draft\
**So that** I can complete it later without losing entered data

### Acceptance Criteria

1.  Draft State Availability

    a.  "Save Draft" button available at all times.

    b.  Required-field validation does NOT block draft save.

    c.  System assigns status: Draft.

2.  Data Protection

    a.  All PII/SPII encrypted at rest even in draft state.

    b.  Draft data encrypted in transit (TLS 1.2+).

    c.  Field-level encryption for SSN, Account #, etc.

3.  Access Control

    a.  Only creator (and supervisor roles) can view/edit draft.

    b.  Draft not visible in general queue.

    c.  RBAC enforced server-side and via API.

4.  Audit Logging

    a.  Draft save event logged with:

        i.  User ID

        ii. Timestamp (UTC)

        iii. Record ID

        iv. Action: Draft Saved

    b.  Field-level delta logs captured for edits.

5.  Concurrency Control

    a.  System prevents simultaneous conflicting edits.

    b.  Record locking or optimistic versioning implemented.

6.  Auto-Save (Optional Enhancement)

    a.  Configurable timed auto-save.

    b.  Auto-save events logged as system-generated.

# US-SW-018: Resume & Edit Draft Workup

**As an** Analyst or investigator\
**I want** to retrieve and continue editing a saved draft\
**So that** I can complete incomplete workups

### Acceptance Criteria

1.  Drafts accessible via:

    a.  "My Drafts" dashboard filter.

    b.  Case-based view.

2.  System displays:

    a.  Last modified date

    b.  Last modified by

    c.  Draft age indicator (configurable threshold warning)

3.  Edits to SPII:

    a.  Require Sensitive Identifier permission.

    b.  Full-view events logged.

4.  Draft expiration:

    a.  Configurable inactivity threshold triggers notification.

    b.  Auto-archival or supervisory review after threshold
        (configurable).

# US-SW-019: Submit Completed Workup to Review Queue

**As an** Analyst or investigator

**I want** to submit a completed Subject Workup to a review queue\
**So that** it can be reviewed, approved, or rejected

### Acceptance Criteria

1.  Submission Validation

    a.  All required fields must pass validation.

    b.  Minimum collection matrix must not contain unresolved states (if
        required).

    c.  No blocking validation errors.

2.  Status Change

    a.  Status transitions from Draft → Submitted.

    b.  System assigns submission timestamp.

    c.  Submission user ID recorded.

3.  Queue Assignment

    a.  Workup routed to:

        i.  Supervisor queue

        ii. Compliance queue

        iii. Configurable workflow group

    b.  Queue assignment based on:

        i.  Case type

        ii. Classification level

        iii. Organizational unit

4.  Access Restrictions

    a.  After submission:

        i.  Investigator cannot modify without recall or rejection.

        ii. Record becomes read-only for submitter unless returned.

    b.  Supervisors gain review access.

5.  Audit Logging

    a.  Submission event logged.

    b.  Includes:

        i.  User ID

        ii. Role

        iii. Timestamp

        iv. Status change

        v.  Queue destination

# **US-SW-020: Export Form to PDF** 

**As an** authorized investigator or analyst

**I want** to export the completed subject workup to PDF

**So that** it can be securely attached to case files or supervisory
review

### Acceptance Criteria

1.  Export button enabled only when:

    a.  Required entire completed

    b.  Validation passes

2.  PDF must:

    a.  Include Subject Workup ID

    b.  Include Case \#

    c.  Include Analyst and Analyst or investigator

    d.  Display classification banner (e.g., CONFIDENTIAL)

    e.  Include export timestamp and exporting user

3.  Masking Rules Applied in PDF:

    a.  SSN masked unless Full Export privilege

    b.  Account \# masked except last 4 digits

    c.  IP addresses partially masked if required

4.  PDF must:

    a.  Be generated server-side

    b.  Not expose raw SPII in client HTML

    c.  Trigger export audit event

    d.  Record masked vs full export type

5.  Watermark required if full SPII is included.

# Non-Functional Security Requirements

-   AES-256 encryption at rest

-   TLS 1.2+ encryption in transit

-   Field-level encryption for SSN & Account \#

-   Tokenized indexing for sensitive identifiers

-   Secure session cookies (HTTPOnly, Secure)

-   CSRF protection

-   Rate limiting for PII queries

-   Data retention configuration

-   Legal hold capability

-   Immutable/WORM audit storage

-   Secure PDF generation service

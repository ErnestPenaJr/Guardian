# Guardian -- Notices Component

## Product Requirements Document (PRD)

## 1. Executive Summary

The **Notices** component is a new standalone process within Guardian designed to securely disseminate information to internal and external users without relying on email. Notices are independent workflows created by administrators using preconfigured templates. This feature provides a centralized, trackable, and secure method of distributing time-sensitive information, intelligence, and operational updates while maintaining compliance and reducing reliance on external communication channels.

The Notices module will allow:

- **Admins** to configure notice templates through the workflow builder.
- **Processors/Managers** to create, edit, cancel, and issue notices to selected recipients.
- **Users** to view and manage notices issued to them, with clear read/unread indicators.
- **All participants** to securely access notice details and attachments within Guardian.

## 2. Product Overview

**Product Name:** Guardian -- Notices Component  
**Product Type:** Secure Information Dissemination Module  
**Target Users:** Guardian Admins, Processors, Managers, General Users, and External Users  
**Scope:** Web-based component integrated into Guardian's landing page, notices landing page, and workflow management system.

## 3. Problem Statement

Currently, important operational and intelligence information is often distributed through email, which presents several issues:

- Lack of tracking for read/unread status.
- Risk of sensitive information being forwarded or exposed outside the intended audience.
- No centralized repository for historical notices.
- Inconsistent formatting and content.

The **Notices** module addresses these challenges by:

- Providing a secure, internal delivery mechanism.
- Enforcing standard formats via templates.
- Tracking readership per recipient.
- Maintaining a historical record within Guardian.

## 4. Vision & Goals

**Vision:**  
Create a secure, centralized system for issuing and tracking notices, ensuring all intended recipients receive, read, and act upon critical information without relying on insecure external channels.

**Primary Goals:**

1. **Secure Delivery:** Keep sensitive information within Guardian's secure environment.
2. **Standardization:** Use templates for consistent formatting and content.
3. **Traceability:** Track read/unread status for each recipient.
4. **Efficiency:** Provide a fast, intuitive way to issue and access notices.
5. **Integration:** Seamlessly fit into existing Guardian workflows and landing page layout.

## 5. Target Users & Personas

**Primary Users:**

- **Processors/Managers:** Create and manage notices.
- **General Users & External Users:** Receive and view notices.
- **Admins:** Configure notice templates and workflows.

## 6. Core Features & Requirements

### 6.1 Notice Display -- Landing Page ("My Notices" Component)

- Fixed card on Guardian Landing Page showing notices issued to the logged-in user.
- Scrollable table with columns: ID, Title, Notice Name, Issued By, Issued Date (yyyy-mm-dd).
- Default sorting: Issued Date DESC.
- Clicking a row opens the Notice Details page in a new window.
- Read/unread status indicated by bold Title (unread) with aqua text color.

### 6.2 Notices Landing Page

- Two tabs: **My Notices** (default) and **Notices**.
- **My Notices:** Displays notices issued to the logged-in user.
- **Notices:** Displays all notices in the system (role-based visibility).
- "New Notice" button available in both tabs for authorized roles.

### 6.3 Notice Details Page

- Displays notice metadata (ID, Title, Issued By, Issued Date, Recipients).
- Displays completed workflow form associated with the notice.
- Close button returns to Notices Landing Page.
- Automatically marks notice as read for the current user upon opening.

### 6.4 Creating & Issuing Notices

- Select notice template from list with description.
- Enter Title (200 chars, required).
- Complete template form fields.
- Add attachments (per Attachments feature).
- Add recipients via searchable modal (Last Name, First Name, Email).
- Remove recipients individually.
- Cancel returns to Notices Landing Page.
- Issue validates required fields, creates notice, and displays Notice ID.

### 6.5 Editing Notices

- Available to Processor, Manager, Admin.
- Modal displays editable notice fields.
- Save Changes updates notice and adds "Updated: [timestamp]" in header.
- Updated notices appear bold in My Notices tab.

### 6.6 Cancelling Notices

- Available to Processor, Manager, Admin.
- Cancel Notice modal with required "Explanation" (max 500 chars).
- Cancelled notices display "Cancelled: [EXPLANATION]" in red in details header.
- Cancelled notices display strikethrough in notice lists.

### 6.7 Read/Unread Tracking

- System tracks per-user read status.
- Notices are unread upon issue.
- Opening Notice Details marks as read for that user.
- Unread = bold aqua title in lists.

## 7. Technical Requirements

**Performance:**

- Same performance SLAs as Guardian (3-second response, 99.5% uptime).
- Support for concurrent reads/writes across departments.

**Security:**

- Role-based access control for all notice actions.
- Encrypted storage for notice content and attachments.
- Audit logging for all create/edit/cancel actions.

**Integration:**

- Extends Guardian workflow admin with "Type" = Request or Notice.
- Integrates with Guardian's authentication and role management.
- Uses existing attachments and notification subsystems.

## 8. Success Metrics

- **User Adoption:** % of processors/managers issuing notices regularly.
- **Read Compliance:** % of issued notices marked as read within target timeframe.
- **Reduction in Email Use:** Measured drop in sensitive content sent via email.
- **Template Usage Consistency:** % of notices issued using standard templates.

## 9. Implementation Phases

### Phase 1 -- Core Notice Delivery (MVP)

- My Notices display on landing page.
- Notices landing page with My Notices tab.
- Create/issue notices from templates.
- Read/unread tracking.

### Phase 2 -- Notice Management Enhancements

- Edit and Cancel functionality.
- Multiple notice types and templates.
- Full notices tab with all notices view.

### Phase 3 -- Advanced Notice Analytics

- Read/unread reporting per user.
- Notice engagement tracking.

## 10. Risks & Mitigation

**Risks:**

- User confusion between Notices and Requests.
- Low adoption if email remains default communication channel.
- Data privacy concerns for external users.

**Mitigation:**

- Clear UI distinctions between notices and requests.
- Training and change management plan.
- Role-based restrictions for external recipients.

## 11. Conclusion

The Notices component is a critical addition to Guardian, enabling secure, standardized, and trackable dissemination of important information to both internal and external audiences. By replacing ad-hoc email communication with an integrated, role-aware platform feature, Guardian will improve compliance, reduce risk, and provide complete visibility into message delivery and acknowledgment.
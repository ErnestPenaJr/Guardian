# Guardian MVP Test Suite

## Overview
This directory contains comprehensive test plans and result templates for the Guardian MVP application. The test suite covers all major functionality areas and provides structured templates for recording test execution results.

## Test Structure

### Test Plans
1. **[Authentication & User Management](01-authentication-user-management.md)** - Login, registration, roles, permissions
2. **[Dashboard & Navigation](02-dashboard-navigation.md)** - UI components, navigation, responsive design
3. **[Request Management](03-request-management.md)** - Request lifecycle, forms, assignments, bulk operations
4. **[Admin Features](04-admin-features.md)** - User management, form builder, system administration
5. **[Security & Mobile](05-security-mobile.md)** - Security testing, mobile experience, accessibility

### Test Results Templates
1. **[Authentication Results](results-01-authentication-user-management.md)** - Results for authentication testing
2. **[Dashboard Results](results-02-dashboard-navigation.md)** - Results for dashboard and navigation testing
3. **[Request Results](results-03-request-management.md)** - Results for request management testing
4. **[Admin Results](results-04-admin-features.md)** - Results for admin features testing
5. **[Security/Mobile Results](results-05-security-mobile.md)** - Results for security and mobile testing

## Test Execution Guidelines

### Prerequisites
Before starting any test execution, ensure:
- ✅ **Test environment is properly configured** (development or production)
- ✅ **Test user accounts created** for all roles (Admin, User, Manager, Processor, External, JAFAR)
- ✅ **Test data populated** (forms, requests, users)
- ✅ **Email service configured** for invitation and notification testing
- ✅ **Database access available** for data verification

### Test User Accounts Required
Create the following test accounts before starting:
```
admin@test.com     - Administrator (role_id: 1)
user@test.com      - General User (role_id: 2)  
manager@test.com   - Manager (role_id: 3)
processor@test.com - Processor (role_id: 4)
external@test.com  - External User (role_id: 5)
jafar@test.com     - JAFAR Developer (role_id: 6)
```

### Execution Order
Recommended test execution sequence:
1. **Authentication & User Management** (Critical foundation)
2. **Dashboard & Navigation** (Core UI functionality)
3. **Request Management** (Primary business logic)
4. **Admin Features** (Administrative capabilities)
5. **Security & Mobile** (Security validation and mobile experience)

### Result Documentation
For each test execution:
1. **Use the corresponding results template** 
2. **Fill out all test case results** with PASS/FAIL/BLOCKED/NOT EXECUTED
3. **Document all issues found** with detailed descriptions
4. **Include screenshots/evidence** for failed tests
5. **Note performance metrics** where applicable
6. **Sign off completed results** with tester and reviewer signatures

## Test Environment Configuration

### Development Environment
- **Frontend**: http://localhost:5175 (Vite dev server)
- **Backend**: http://localhost:3001 (Express server)
- **Database**: SQL Server (GUARDIAN-DEV)
- **Email**: SendGrid (support@shieldlytics.com)

### Production Environment
- **Application**: https://Guardian-ep-dev.azurewebsites.net
- **Database**: Azure SQL Server
- **Email**: SendGrid production configuration

### Browser Testing Matrix
Test on the following browsers and devices:
- **Desktop**: Chrome 120+, Firefox 115+, Safari 16+, Edge 120+
- **Mobile**: iOS Safari, Android Chrome, Samsung Internet
- **Tablets**: iPad Safari, Android Chrome

## Test Data Management

### Setup Scripts
Use these SQL scripts to create test data:

```sql
-- Create test users for each role
INSERT INTO GUARDIAN.USERS (EMAIL, FIRST_NAME, LAST_NAME, ROLE_ID, COMPANY_ID, CREATED_DATE)
VALUES 
('admin@test.com', 'Admin', 'User', 1, 1, GETDATE()),
('user@test.com', 'General', 'User', 2, 1, GETDATE()),
('manager@test.com', 'Manager', 'User', 3, 1, GETDATE()),
('processor@test.com', 'Processor', 'User', 4, 1, GETDATE()),
('external@test.com', 'External', 'User', 5, 1, GETDATE()),
('jafar@test.com', 'JAFAR', 'Developer', 6, 1, GETDATE());
```

### Cleanup Scripts
```sql
-- Remove test data after testing
DELETE FROM GUARDIAN.USERS WHERE EMAIL LIKE '%@test.com';
DELETE FROM GUARDIAN.REQUESTS WHERE CREATED_BY IN (SELECT USER_ID FROM GUARDIAN.USERS WHERE EMAIL LIKE '%@test.com');
```

## Critical Test Areas

### Priority 1 (Must Pass)
- ✅ **Authentication flow** (registration → verification → login)
- ✅ **Role-based access control** (users see only authorized features)
- ✅ **Request lifecycle** (creation → assignment → processing → completion)
- ✅ **Company data isolation** (users only see their company's data)
- ✅ **Security validation** (no unauthorized access, proper data protection)

### Priority 2 (Should Pass)
- ✅ **Mobile responsiveness** (full functionality on mobile devices)
- ✅ **Performance** (acceptable load times and responsiveness)
- ✅ **Admin functionality** (user management, form builder)
- ✅ **File upload/download** (secure and reliable file handling)
- ✅ **Notification system** (assignment and status notifications)

### Priority 3 (Nice to Have)
- ✅ **Advanced filtering and search** (comprehensive data filtering)
- ✅ **Bulk operations** (efficient bulk request processing)
- ✅ **API explorer** (JAFAR developer tools)
- ✅ **Analytics and reporting** (request metrics and charts)
- ✅ **Accessibility compliance** (WCAG AA standards)

## Known Issues to Verify Fixed
Based on the MVP test document, pay special attention to:
- ✅ **Process and Delete button functionality**
- ✅ **API endpoints returning JSON (not HTML)**
- ✅ **Form creation and submission reliability**
- ✅ **Password reset flow completion**
- ✅ **Request assignment features**
- ✅ **Production deployment stability**
- ✅ **Mobile form submission reliability**
- ✅ **Database connection issues in development**

## Issue Severity Classification

### Critical (Stop Ship)
- Security vulnerabilities
- Authentication/authorization bypass
- Data corruption or loss
- Complete feature failure
- Performance issues making system unusable

### High (Must Fix)
- Major feature dysfunction
- Data integrity issues
- Significant performance problems
- Accessibility violations
- Cross-browser compatibility issues

### Medium (Should Fix)
- Minor feature issues
- UI/UX problems
- Performance optimizations
- Documentation gaps
- Non-critical error handling

### Low (Nice to Fix)
- Cosmetic issues
- Enhancement opportunities
- Code optimization
- User experience improvements

## Success Criteria

The Guardian MVP is considered ready for production when:

1. **All Priority 1 tests pass** with no critical or high severity issues
2. **Security assessment complete** with no vulnerabilities above medium severity
3. **Mobile experience acceptable** with core functionality working on all supported devices
4. **Performance metrics met** with acceptable load times and responsiveness
5. **Admin functionality operational** with complete user and system management capabilities
6. **Cross-browser compatibility verified** across all supported browsers
7. **Accessibility compliance achieved** meeting minimum WCAG AA standards

## Contact Information

For questions about testing procedures or to report issues:
- **Project Team**: Guardian MVP Development Team
- **Test Environment Issues**: Check CLAUDE.md for database connection troubleshooting
- **Production Deployment**: Verify through Azure DevOps pipeline

---

**Last Updated**: 2025-07-26  
**Version**: MVP Test Suite v1.0  
**Environments**: Development & Production
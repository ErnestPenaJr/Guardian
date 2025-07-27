# Authentication & User Management Test Plan

## Test Overview
**Test Category**: Authentication & User Management  
**Priority**: Critical  
**Test Environment**: Development (localhost:5175) & Production  
**Prerequisites**: Database access, email service configured

## Test User Accounts Required

Create test accounts for each role:
1. **Administrator** (role_id: 1) - `admin@test.com`
2. **General User** (role_id: 2) - `user@test.com`
3. **Manager** (role_id: 3) - `manager@test.com`
4. **Processor** (role_id: 4) - `processor@test.com`
5. **External User** (role_id: 5) - `external@test.com`
6. **JAFAR Developer** (role_id: 6) - `jafar@test.com`

## Test Cases

### TC-AUTH-001: User Registration Flow
**Objective**: Verify complete user registration process
**Steps**:
1. Navigate to registration page
2. Fill out registration form with valid data
3. Submit registration
4. Check email for verification code
5. Enter verification code
6. Complete registration with password
7. Verify automatic login after registration

**Expected Results**:
- Registration form accepts valid inputs
- Verification email sent via SendGrid
- Email contains valid 6-digit code
- Code verification succeeds
- User can set password and complete registration
- Automatic redirect to dashboard after completion

**Test Data**:
- Email: `newuser@test.com`
- First Name: `Test`
- Last Name: `User`
- Password: `SecurePass123!`

### TC-AUTH-002: Email Verification Process
**Objective**: Test email verification system
**Steps**:
1. Register new user
2. Check email for verification code
3. Test code expiration (if applicable)
4. Test invalid code submission
5. Test resend verification email
6. Verify with correct code

**Expected Results**:
- Verification email received within 2 minutes
- Code format is 6 digits
- Invalid codes rejected with error message
- Resend functionality works
- Valid code accepts and proceeds

### TC-AUTH-003: Login Authentication
**Objective**: Verify login functionality for all user roles
**Steps**:
1. Navigate to login page
2. Test login with each role account
3. Verify JWT token generation
4. Check redirect to appropriate dashboard
5. Test invalid credentials
6. Test account lockout (if implemented)

**Expected Results**:
- Valid credentials accept login
- JWT token stored in localStorage/cookies
- Role-appropriate dashboard displayed
- Invalid credentials show error message
- No sensitive data exposed in responses

### TC-AUTH-004: Password Reset Flow
**Objective**: Test complete password reset process
**Steps**:
1. Click "Forgot Password" on login page
2. Enter registered email address
3. Check email for reset code
4. Enter reset code on reset page
5. Set new password
6. Login with new password
7. Verify old password no longer works

**Expected Results**:
- Reset email sent successfully
- Reset code format is valid
- New password meets security requirements
- Login works with new password
- Old password invalidated

### TC-AUTH-005: JWT Token Management
**Objective**: Verify JWT token handling and security
**Steps**:
1. Login successfully
2. Inspect JWT token in browser storage
3. Test API calls with valid token
4. Test token expiration handling
5. Test logout token invalidation
6. Test unauthorized access attempts

**Expected Results**:
- JWT contains appropriate user/role data
- API calls succeed with valid token
- Expired tokens handled gracefully
- Logout clears token storage
- Unauthorized requests return 401 status

### TC-AUTH-006: Logout Functionality
**Objective**: Test secure logout process
**Steps**:
1. Login as test user
2. Navigate through application
3. Click logout button
4. Confirm logout action
5. Verify redirect to login page
6. Test accessing protected routes after logout

**Expected Results**:
- Logout confirmation dialog appears
- JWT token cleared from storage
- Redirect to login page successful
- Protected routes require re-authentication
- Session data cleared

## Role-Based Access Testing

### TC-AUTH-007: Administrator Role Verification
**Objective**: Verify administrator access and permissions
**Steps**:
1. Login as administrator
2. Verify access to all admin features
3. Test user management capabilities
4. Test system administration access
5. Verify data visibility (all company data)

**Expected Results**:
- Full system access granted
- Admin navigation items visible
- Can manage users and system settings
- No permission errors encountered

### TC-AUTH-008: General User Role Verification
**Objective**: Verify standard user restrictions
**Steps**:
1. Login as general user
2. Attempt to access admin features
3. Verify limited navigation options
4. Test standard user workflows
5. Verify data visibility restrictions

**Expected Results**:
- Admin features not accessible
- Limited navigation menu displayed
- Standard workflows function properly
- Only own company data visible

### TC-AUTH-009: Manager Role Verification
**Objective**: Test manager-specific permissions
**Steps**:
1. Login as manager
2. Test request assignment capabilities
3. Verify oversight features access
4. Test user management permissions
5. Verify enhanced data visibility

**Expected Results**:
- Can assign requests to team members
- Access to management dashboard
- Can view team performance data
- Enhanced but not full admin access

### TC-AUTH-010: Cross-Role Permission Testing
**Objective**: Verify role isolation and security
**Steps**:
1. Test each role's access boundaries
2. Attempt unauthorized actions
3. Verify API endpoint security
4. Test role switching (if applicable)
5. Verify data isolation between roles

**Expected Results**:
- Strict role-based access control
- Unauthorized actions blocked
- API endpoints enforce permissions
- No data leakage between roles

## Security Testing

### TC-AUTH-011: Input Validation
**Objective**: Test input validation and sanitization
**Steps**:
1. Test SQL injection attempts in login
2. Test XSS attempts in registration
3. Test malformed email addresses
4. Test password complexity requirements
5. Test special characters handling

**Expected Results**:
- SQL injection attempts blocked
- XSS attempts sanitized
- Invalid emails rejected
- Password requirements enforced
- Special characters handled safely

### TC-AUTH-012: Session Security
**Objective**: Verify session security measures
**Steps**:
1. Test concurrent logins
2. Test session fixation attacks
3. Verify HTTPS enforcement (production)
4. Test CSRF protection
5. Test session timeout behavior

**Expected Results**:
- Secure session management
- Attack attempts blocked
- HTTPS enforced in production
- CSRF tokens validated
- Sessions timeout appropriately

## Performance Testing

### TC-AUTH-013: Authentication Performance
**Objective**: Verify authentication system performance
**Steps**:
1. Measure login response times
2. Test concurrent user logins
3. Measure JWT token generation time
4. Test database query performance
5. Monitor system resource usage

**Expected Results**:
- Login completes within 2 seconds
- System handles concurrent users
- JWT generation under 100ms
- Database queries optimized
- Resource usage within limits

## Error Handling

### TC-AUTH-014: Error Scenarios
**Objective**: Test error handling and user feedback
**Steps**:
1. Test network connectivity issues
2. Test database connection failures
3. Test email service outages
4. Test malformed requests
5. Test rate limiting (if implemented)

**Expected Results**:
- Graceful error handling
- User-friendly error messages
- No system crashes or exposures
- Appropriate fallback behavior
- Rate limiting enforced

## Browser Compatibility

### TC-AUTH-015: Cross-Browser Testing
**Objective**: Verify authentication works across browsers
**Steps**:
1. Test in Chrome, Firefox, Safari, Edge
2. Verify localStorage/cookie handling
3. Test responsive design on mobile
4. Verify JavaScript functionality
5. Test file upload capabilities

**Expected Results**:
- Consistent behavior across browsers
- Storage mechanisms work properly
- Mobile-responsive authentication
- All JavaScript features functional
- File uploads work reliably

## Test Environment Setup

### Development Environment
- **Frontend**: http://localhost:5175
- **Backend**: http://localhost:3001
- **Database**: SQL Server (GUARDIAN-DEV)
- **Email**: SendGrid (support@shieldlytics.com)

### Production Environment  
- **Frontend**: https://guardian-mvp-dtgph0bcd4ctdbhb.eastus2-01.azurewebsites.net
- **Database**: Azure SQL Server
- **Email**: SendGrid production configuration

## Test Data Management

### Setup Script
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

### Cleanup Script
```sql
-- Remove test users after testing
DELETE FROM GUARDIAN.USERS WHERE EMAIL LIKE '%@test.com';
```

## Success Criteria

✅ **Authentication Flow**: Complete registration → verification → login works flawlessly  
✅ **Role-Based Access**: Each role has appropriate permissions and restrictions  
✅ **Security**: No vulnerabilities in authentication system  
✅ **Performance**: Authentication completes within acceptable time limits  
✅ **Cross-Platform**: Works consistently across all supported browsers and devices  
✅ **Error Handling**: Graceful handling of all error scenarios  

## Known Issues to Verify Fixed
- Password reset email delivery
- JWT token expiration handling
- Role permission enforcement
- Mobile authentication experience
- Production environment authentication
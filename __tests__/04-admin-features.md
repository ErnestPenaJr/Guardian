# Admin Features Test Plan

## Test Overview
**Test Category**: Admin Features  
**Priority**: High  
**Test Environment**: Development (localhost:5175) & Production  
**Prerequisites**: Admin/JAFAR role accounts, test user data

## Test Cases

### TC-ADMIN-001: User Management Dashboard
**Objective**: Test admin user management interface
**Steps**:
1. Login as Admin or JAFAR role
2. Navigate to User Management section
3. Verify all users displayed correctly
4. Test user data table functionality
5. Verify role-based filtering
6. Test search and sorting capabilities

**Expected Results**:
- User management accessible to Admin/JAFAR only
- All company users displayed
- Table sorting and filtering work
- Search finds users by name/email/role
- User data accurate and up-to-date
- No unauthorized user data visible

**User Data Displayed**:
- Full name and email
- Role assignment
- Account status (Active/Inactive)
- Last login date
- Registration date
- Company association

### TC-ADMIN-002: Add New User Manually
**Objective**: Test manual user creation by admins
**Steps**:
1. Click "Add New User" button
2. Fill out new user form
3. Select appropriate role
4. Set temporary password (if applicable)
5. Submit user creation
6. Verify new user appears in list
7. Test new user login capability

**Expected Results**:
- User creation form loads correctly
- All required fields validated
- Role dropdown populated correctly
- User created successfully
- New user receives credentials (email/notification)
- New user can log in immediately
- User appears in management dashboard

**Required User Fields**:
- First Name (required)
- Last Name (required)
- Email Address (required, unique)
- Role selection (required)
- Company assignment
- Initial password or auto-generation

### TC-ADMIN-003: Edit Existing User Information
**Objective**: Test user information modification
**Steps**:
1. Select existing user from list
2. Click "Edit" or similar action
3. Modify user information
4. Change role assignment
5. Update account status
6. Save changes
7. Verify updates reflected in system

**Expected Results**:
- Edit form pre-populated with current data
- All fields editable except sensitive ones (email)
- Role changes applied immediately
- Status changes take effect
- Changes saved to database
- User notified of changes (if applicable)
- Audit trail records modifications

**Editable Fields**:
- First/Last Name
- Role assignment
- Account status (Active/Inactive)
- Company assignment (restricted)
- Password reset flag

### TC-ADMIN-004: Delete Users
**Objective**: Test user deletion functionality
**Steps**:
1. Select user(s) for deletion
2. Click delete action
3. Confirm deletion in modal
4. Verify user marked as deleted
5. Test deleted user login attempt
6. Verify data integrity maintained
7. Test user restoration (if applicable)

**Expected Results**:
- Deletion requires explicit confirmation
- Users soft-deleted (not permanently removed)
- Deleted users cannot log in
- User's historical data preserved
- References in requests/assignments maintained
- Restoration possible through admin interface

### TC-ADMIN-005: Send User Invitations
**Objective**: Test email invitation system
**Steps**:
1. Click "Send Invitation" or "Invite User"
2. Enter invitation email address
3. Select role for invited user
4. Add custom invitation message
5. Send invitation
6. Verify invitation email sent
7. Test invitation acceptance flow

**Expected Results**:
- Invitation form validates email format
- Role selection required
- Custom message appended to invitation
- Email sent via configured service
- Invitation link secure and time-limited
- Acceptance creates user account
- Inviter notified of acceptance

**Invitation Email Content**:
- Company information
- Role assignment details
- Secure registration link
- Expiration date/time
- Contact information for help

### TC-ADMIN-006: Delete Invitations
**Objective**: Test invitation deletion functionality
**Steps**:
1. Navigate to pending invitations list
2. Select invitation(s) to delete
3. Click delete action
4. Confirm deletion
5. Verify invitation removed from list
6. Test deleted invitation link (should be invalid)
7. Verify invitee cannot register with deleted link

**Expected Results**:
- Pending invitations visible to admins
- Deletion requires confirmation
- Deleted invitations immediately invalidated
- Links return appropriate error message
- Invitation removed from database
- No partial registration allowed

### TC-ADMIN-007: Manage User Roles and Permissions
**Objective**: Test role assignment and permission management
**Steps**:
1. Access role management interface
2. View available roles and permissions
3. Assign/change user roles
4. Test role-based access immediately
5. Create custom roles (if supported)
6. Verify permission inheritance

**Expected Results**:
- All system roles displayed clearly
- Role descriptions and permissions visible
- Role changes take effect immediately
- Users gain/lose access appropriately
- Custom role creation functional (if available)
- Permission inheritance logical

**Available Roles**:
- Administrator (role_id: 1) - Full system access
- General User (role_id: 2) - Standard access
- Manager (role_id: 3) - Request assignment capabilities
- Processor (role_id: 4) - Request processing
- External User (role_id: 5) - Limited external access
- JAFAR Developer (role_id: 6) - Enhanced admin + dev tools

### TC-ADMIN-008: Export User Data
**Objective**: Test user data export functionality
**Steps**:
1. Select users for export (all or filtered)
2. Choose export format (Excel, CSV)
3. Configure export options
4. Download exported file
5. Verify file format and content
6. Test large dataset exports

**Expected Results**:
- Export options clearly presented
- Multiple formats supported
- Export includes relevant user data
- File downloads without corruption
- Large exports complete successfully
- No sensitive data inappropriately included

**Export Data Fields**:
- User identification information
- Role and status information
- Registration and activity dates
- Company association
- Non-sensitive profile data

### TC-ADMIN-009: Resend Invitation Emails
**Objective**: Test invitation email resending
**Steps**:
1. Locate pending invitation
2. Click "Resend Invitation"
3. Verify new email sent
4. Check invitation expiration handling
5. Test multiple resend attempts
6. Verify original invitation invalidated

**Expected Results**:
- Resend function available for pending invitations
- New email sent immediately
- Expiration date reset appropriately
- Multiple resends handled correctly
- Previous links invalidated for security
- Activity logged for audit purposes

## Form & Workflow Management

### TC-ADMIN-010: Create Workflow Templates
**Objective**: Test form builder and template creation
**Steps**:
1. Access form builder interface
2. Create new form template
3. Add various field types
4. Configure field properties and validation
5. Set up field groups
6. Save template
7. Test template usage

**Expected Results**:
- Form builder interface intuitive
- All field types available and functional
- Field properties save correctly
- Validation rules work properly
- Field groups organize logically
- Templates save and load correctly
- Created forms usable immediately

**Form Builder Features**:
- Drag-and-drop field placement
- Field type library (text, number, date, SSN, etc.)
- Property configuration panel
- Validation rule setup
- Preview functionality
- Template naming and categorization

### TC-ADMIN-011: Manage Form Fields and Types
**Objective**: Test field type administration
**Steps**:
1. Access field type management
2. View existing field types
3. Create custom field type
4. Configure field properties
5. Test field type in forms
6. Modify existing field types
7. Delete unused field types

**Expected Results**:
- All field types displayed with descriptions
- Custom field types created successfully
- Field properties configurable
- New field types available in form builder
- Modifications applied to existing forms
- Deletion handled safely (prevent data loss)

**Field Types to Manage**:
- Text (single-line, multi-line)
- Numeric (integer, decimal, currency)
- Date/Time (various formats)
- Selection (dropdown, radio, checkbox)
- File upload (with type restrictions)
- SSN (with automatic masking)
- Address (structured components)

### TC-ADMIN-012: Form Groups Management
**Objective**: Test form organization and grouping
**Steps**:
1. Access form groups interface
2. Create new form groups
3. Assign forms to groups
4. Set group permissions
5. Test group-based form access
6. Modify group assignments
7. Delete empty groups

**Expected Results**:
- Form groups created successfully
- Forms assigned to appropriate groups
- Group permissions enforced
- Users see only accessible groups
- Group modifications save correctly
- Empty groups removable safely

### TC-ADMIN-013: Field Lookups Configuration
**Objective**: Test dynamic field lookup configuration
**Steps**:
1. Access lookup configuration
2. Create new lookup tables
3. Configure lookup relationships
4. Test lookup fields in forms
5. Update lookup data
6. Test cascading lookups

**Expected Results**:
- Lookup tables created and populated
- Relationships configured correctly
- Lookup fields populate dynamically
- Data updates reflected immediately
- Cascading lookups work properly
- Performance acceptable for large lookups

## System Administration

### TC-ADMIN-014: Role and Permissions Management
**Objective**: Test comprehensive role administration
**Steps**:
1. Access role administration interface
2. View all system roles
3. Modify role permissions
4. Create new custom roles
5. Test permission combinations
6. Verify role inheritance
7. Test role deletion safeguards

**Expected Results**:
- All roles displayed with current permissions
- Permission modifications save correctly
- Custom roles function as configured
- Permission combinations work logically
- Role inheritance prevents conflicts
- Deletion safeguards prevent data issues

### TC-ADMIN-015: Field Types Administration
**Objective**: Test system-level field type management
**Steps**:
1. Access field type administration
2. Review all available field types
3. Configure global field settings
4. Test field type validation rules
5. Modify existing field behaviors
6. Test field type dependencies

**Expected Results**:
- All field types accessible for configuration
- Global settings apply consistently
- Validation rules enforced system-wide
- Modifications don't break existing forms
- Dependencies handled appropriately
- Changes logged for audit purposes

### TC-ADMIN-016: System Health Monitoring
**Objective**: Test system monitoring and health checks
**Steps**:
1. Access system health dashboard
2. Review system status indicators
3. Check database connectivity
4. Monitor system performance metrics
5. Test alert configurations
6. Review system logs

**Expected Results**:
- Health dashboard shows current status
- All system components monitored
- Database status accurate
- Performance metrics meaningful
- Alerts trigger appropriately
- Logs accessible and searchable

**Health Metrics**:
- Database connection status
- API response times
- User session counts
- System resource usage
- Error rates and patterns
- Background job status

## Developer Tools (JAFAR Role Only)

### TC-ADMIN-017: API Explorer
**Objective**: Test API exploration and testing tools
**Steps**:
1. Login as JAFAR role user
2. Access API Explorer
3. Browse available endpoints
4. Test API calls with authentication
5. View API documentation
6. Test different HTTP methods
7. Export API definitions

**Expected Results**:
- API Explorer accessible to JAFAR role only
- All endpoints listed with descriptions
- Authentication handled automatically
- API calls execute successfully
- Documentation complete and accurate
- Export functionality works
- Request/response data formatted correctly

**API Categories**:
- Authentication endpoints
- User management APIs
- Request management APIs
- Form and field APIs
- Admin utility endpoints
- System health checks

### TC-ADMIN-018: API Documentation and Testing
**Objective**: Test integrated API documentation
**Steps**:
1. Access API documentation interface
2. Review endpoint documentation
3. Test API calls directly from docs
4. Verify request/response examples
5. Test authentication methods
6. Export API specifications

**Expected Results**:
- Documentation complete for all endpoints
- Examples accurate and helpful
- Direct testing functional
- Authentication properly documented
- Specifications exportable (OpenAPI/Swagger)
- Documentation stays current with code

## Performance Testing

### TC-ADMIN-019: Admin Interface Performance
**Objective**: Test admin interface performance with large datasets
**Steps**:
1. Load user management with 1000+ users
2. Test form builder with complex forms
3. Measure dashboard load times
4. Test bulk operations performance
5. Monitor memory usage during admin tasks
6. Test concurrent admin operations

**Expected Results**:
- Large user lists load within 5 seconds
- Form builder remains responsive
- Dashboard loads acceptable for admin use
- Bulk operations complete successfully
- Memory usage stays within limits
- Concurrent operations don't conflict

### TC-ADMIN-020: Data Export Performance
**Objective**: Test large data export performance
**Steps**:
1. Export large user datasets
2. Test form data exports
3. Monitor export generation time
4. Test concurrent export requests
5. Verify export file integrity
6. Test export cancellation

**Expected Results**:
- Large exports complete within reasonable time
- Export progress indicated to user
- Multiple exports handled correctly
- Files generated without corruption
- Cancellation works properly
- System remains responsive during exports

## Security Testing

### TC-ADMIN-021: Admin Access Control
**Objective**: Verify admin-only access restrictions
**Steps**:
1. Test admin features with non-admin roles
2. Verify API endpoint protection
3. Test privilege escalation attempts
4. Verify data access restrictions
5. Test admin session security
6. Verify audit logging

**Expected Results**:
- Non-admin users blocked from admin features
- API endpoints enforce role requirements
- Privilege escalation prevented
- Data access properly restricted
- Admin sessions secured appropriately
- All admin actions logged

### TC-ADMIN-022: Data Protection in Admin Functions
**Objective**: Test data protection during admin operations
**Steps**:
1. Verify sensitive data handling
2. Test data masking in admin views
3. Check audit trail completeness
4. Test data export security
5. Verify deletion safeguards
6. Test backup and recovery procedures

**Expected Results**:
- Sensitive data properly masked/protected
- Audit trails complete and immutable
- Exports don't expose sensitive data
- Deletion requires appropriate confirmation
- Backup procedures functional
- Recovery procedures tested and documented

## Success Criteria

✅ **User Management**: Complete user lifecycle management functional  
✅ **Role Administration**: Comprehensive role and permission management  
✅ **Form Builder**: Intuitive form creation and management tools  
✅ **System Monitoring**: Effective system health monitoring and alerting  
✅ **Developer Tools**: Complete API exploration and testing capabilities  
✅ **Security**: Robust access control and data protection  
✅ **Performance**: Admin functions perform well under load  
✅ **Audit Trail**: Complete logging of all administrative actions  

## Test Environment Requirements

### Admin Test Accounts
- **Primary Admin**: admin@test.com (role_id: 1)
- **JAFAR Developer**: jafar@test.com (role_id: 6)
- **Secondary Admin**: admin2@test.com (role_id: 1)

### Test Data Sets
- Large user dataset (1000+ users)
- Various form templates
- Complex field configurations
- Historical audit data
- Test invitation scenarios

### System Configuration
- Email service configured for invitations
- Database with comprehensive test data
- API endpoints fully functional
- Logging and monitoring enabled

## Known Issues to Verify Fixed
- User invitation email delivery
- Bulk user operations completion
- Form builder field validation
- API Explorer authentication
- Role permission inheritance
- Data export file formatting
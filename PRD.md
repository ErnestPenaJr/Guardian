# Guardian MVP - Product Requirements Document

## Executive Summary

Guardian is a secure workflow and request management platform designed to streamline business processes, manage user access, and handle form-based workflows. It provides a robust authentication system with role-based access control, allowing organizations to manage both internal and external user workflows securely.

## Product Overview

Guardian is a web application built on modern technologies that enables organizations to create, manage, and track custom workflow processes. It provides administrative controls, user management, form building capabilities, and a comprehensive dashboard for monitoring request status.

### Tech Stack
- Frontend: React + TypeScript + Axios
- Backend: Node.js + Express + Zod
- Database: SQL Server (with Prisma)
- Authentication: JWT + Passport.js
- Hosting: Azure App Service
- Development Tools: Docker, ESLint, Prettier

## User Personas

### 1. Administrator (role_id: 1, "Guardian Admin")
- IT professionals responsible for system configuration
- Has access to the Admin Dashboard with user management capabilities
- Can create and manage workflow templates and field types
- Responsible for inviting and managing users
- **Notices**: Configure notice templates, edit/cancel notices, full notice management

### 2. JAFAR Developer (role_id: 6, "Dark Sorcerer")
- Technical developer with enhanced access privileges
- Has full administrative access plus developer tools
- Can access the API Explorer and advanced user management
- Has access to all administrative features
- **Notices**: Full notice system access including template configuration and management

### 3. External User (role_id: 5, "External User")
- Client or external stakeholder submitting requests
- Limited access to only relevant forms and workflows
- Can track status of their submitted requests
- Has a simplified user interface
- **Notices**: View notices issued specifically to them with secure access

### 4. General User (role_id: 2, "User")
- Internal employee using the system for standard workflows
- Can create and track requests
- Access determined by assigned role permissions
- **Notices**: View and track notices issued to them, with read/unread status indicators

### 5. Manager (role_id: 3, "Manager")
- Oversees request workflows and approvals
- Has access to reporting dashboards
- Can assign and reassign requests
- **Notices**: Create, issue, edit, and cancel notices; view all notices in organization

### 6. Processor (role_id: 4, "Processor")
- Handles request processing and updates
- Works with assigned requests in their queue
- **Notices**: Create, issue, edit, and cancel notices; manage notice workflows

## Key Features and Requirements

### 1. Authentication and User Management

#### 1.1 User Authentication
- Secure login with email and password
- JWT-based authentication
- Password reset functionality
- Email verification for new accounts
- Rate limiting for login attempts (5 attempts per 15 minutes)

#### 1.2 User Registration
- Self-registration with email verification
- Administrator-initiated user invitations
- Temporary password generation for new users
- Company association during registration

#### 1.3 Role-Based Access Control
- Predefined roles with specific permissions
- Role assignment during user creation or invitation
- Special privileged roles (Admin and JAFAR Developer)
- Middleware for permission verification

#### 1.4 User Management Interface
- User creation, editing, and deactivation
- Role assignment and modification
- Bulk user invitation capability
- User status monitoring

### 2. Form Building and Management

#### 2.1 Form Builder
- Drag-and-drop field arrangement
- Multiple field type support
- Required field designation
- Field validation rules

#### 2.2 Field Type Management
- Custom field type creation
- Support for various data formats (text, number, date, etc.)
- Field option configuration
- Field validation rules

#### 2.3 Workflow Templates
- Template creation and management
- Multi-step workflow definition
- Assignment rules configuration
- Status tracking setup

### 3. Request Management

#### 3.1 Request Creation
- Form-based request submission
- File attachment support
- Request tracking ID generation
- Draft saving capability

#### 3.2 Request Processing
- Status updates and tracking
- Assignment to processors
- Comment and feedback functionality
- Approval/rejection workflow

#### 3.3 Request Dashboard
- Filterable request list
- Status visualization
- Sorting and searching capabilities
- Export functionality

### 4. Administration Features

#### 4.1 Admin Dashboard
- System health monitoring
- User activity tracking
- Configuration management
- Template and workflow management

#### 4.2 API Access Portal
- API key management
- Endpoint documentation
- Request testing interface
- Access restricted to admin and JAFAR roles

#### 4.3 System Configuration
- Email templates customization
- Notification settings
- System parameters adjustment

### 5. Notices Component

#### 5.1 Notice Display and Management
- **Landing Page Integration**: Fixed card on Guardian Landing Page showing user's notices
- **Notices Landing Page**: Two-tab interface (My Notices, All Notices) with role-based visibility
- **Notice Details Page**: Complete notice metadata display with automatic read tracking
- **Read/Unread Status**: Visual indicators with bold aqua text for unread notices

#### 5.2 Notice Creation and Workflow
- **Template-Based Creation**: Standardized notice templates through workflow builder
- **Form Integration**: Complete template form fields with attachment support
- **Recipient Management**: Searchable modal for recipient selection with individual removal
- **Notice Issuing**: Validation, creation, and Notice ID assignment

#### 5.3 Notice Management Operations
- **Edit Functionality**: Modal-based editing for Processor, Manager, Admin roles
- **Cancellation Process**: Required explanation with visual strikethrough indicators
- **Audit Tracking**: Timestamps for updates and cancellations
- **Status Management**: Real-time status updates with role-based permissions

#### 5.4 Security and Compliance
- **Secure Internal Delivery**: No external email dependency for sensitive information
- **Role-Based Access Control**: Granular permissions for all notice operations
- **Encrypted Storage**: Secure storage for notice content and attachments
- **Audit Logging**: Complete tracking of create/edit/cancel actions

### 6. External User Experience

#### 6.1 External Portal
- Simplified interface for external users
- Form submission capability
- Request status tracking
- Secure communication channel
- **Notice Access**: Secure viewing of notices issued to external users

#### 6.2 External User Management
- Self-service registration
- Profile management
- Password reset capabilities

### 7. Security Requirements

#### 7.1 Data Protection
- Encryption for sensitive data
- Secure password storage (bcrypt)
- Input validation and sanitization
- Protection against common web vulnerabilities

#### 7.2 Access Control
- Principle of least privilege implementation
- Session management and timeout
- Failed login attempt limiting
- IP-based restrictions (optional)

#### 7.3 Audit Trail
- User action logging
- Access attempt recording
- System change tracking
- Compliance reporting

## Technical Requirements

### 1. Performance
- Response time under 2 seconds for standard operations
- Support for concurrent users
- Efficient database queries
- Optimized frontend rendering

### 2. Scalability
- Horizontal scaling capability
- Database connection pooling
- Caching strategy
- Resource optimization

### 3. Reliability
- Error handling and graceful degradation
- Automated health checks
- Backup and recovery procedures
- Monitoring and alerting

### 4. Deployment
- Azure App Service hosting
- CI/CD pipeline integration
- Environment-specific configurations
- Version control and release management

## Future Enhancements

### Phase 2 Considerations
- Advanced reporting and analytics
- Workflow automation improvements
- Mobile application development
- Integration with third-party systems
- Enhanced document management
- Customizable dashboards
- **Notices Phase 2**: Enhanced edit/cancel functionality, multiple notice types
- **Notices Phase 3**: Advanced notice analytics, read/unread reporting, engagement tracking

## Appendix

### Database Schema Overview
- USERS: User account information
- ROLES: Role definitions and permissions
- USER_ROLES: Many-to-many relationship between users and roles
- COMPANY: Organization information
- FORMS: Form definitions and metadata
- FIELDS: Field definitions and configuration
- FORMS_FIELDS: Relationship between forms and fields
- FORMS_INSTANCE: Tracks form submissions
- FORMS_INSTANCE_VALUES: Stores submitted field values
- **NOTICES**: Notice definitions, metadata, and status tracking
- **NOTICE_RECIPIENTS**: Many-to-many relationship between notices and recipients
- **NOTICE_READ_STATUS**: Per-user read tracking for notices

### API Endpoints Summary
- Authentication: /api/login, /api/register, /api/verify-email
- User Management: /api/users, /api/invites
- Forms: /api/forms, /api/forms/submit, /api/forms/instances
- Fields: /api/fields, /api/field-types
- Requests: /api/requests
- **Notices**: /api/notices, /api/notices/:id, /api/notices/:id/read, /api/notices/templates

### Deployment Architecture
- Frontend: Static files served from Azure App Service
- Backend: Node.js Express server on Azure App Service
- Database: SQL Server managed instance
- Authentication: JWT tokens with Passport.js middleware
- Deployment: Azure DevOps Pipeline

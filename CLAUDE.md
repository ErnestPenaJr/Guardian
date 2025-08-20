# Guardian MVP - Project Documentation

## Efficient Development Workflow with Specialized Agents

### Core Principles
- **Use specialized sub-agents automatically** for their areas of expertise
- **Minimize manual steps** by leveraging agent automation
- **Maintain simplicity** - every change should impact minimal code
- **Company isolation first** - always ensure data security and proper filtering

### Guardian MVP Specialized Agents Directory

The project includes 12 specialized agents located in `.claude/agents/` that provide expert capabilities across all aspects of the Guardian MVP system:

**Frontend Development:**
- `frontend-react-expert` - Senior frontend engineer specializing in React, Tailwind CSS, and ShadCN/UI for modern, responsive, and accessible user interfaces
- `react-specialist` - Guardian MVP React component expert for TypeScript, form builders, data tables, and project-specific UI patterns
- `design-review-agent` - Comprehensive UI/UX evaluation specialist using Playwright for live testing, ensuring world-class design standards through systematic 7-phase review methodology

**Backend & API Development:**
- `api-specialist` - Expert in Guardian MVP API endpoints, Express.js server management, and critical multi-server synchronization across development, testing, and production environments
- `database-specialist` - SQL Server and Prisma ORM specialist focused on Guardian MVP's company-based data isolation and security architecture
- `security-specialist` - JWT authentication, role-based access control, and company-based data isolation security expert
- `resend-email-specialist` - Resend API integration expert for transactional emails, templates, verification workflows, and email deliverability optimization

**Infrastructure & Deployment:**
- `deployment-specialist` - Azure App Service, DevOps pipelines, and IIS configuration expert with deep knowledge of Guardian MVP's unique three-server deployment architecture
- `error-monitor-specialist` - Application debugging, error analysis, and system monitoring specialist for production issue resolution

**Quality Assurance & Documentation:**
- `testing-qa-specialist` - Government-grade testing coverage, quality assurance validation, and comprehensive test strategy development
- `doc-updater` - Documentation maintenance specialist that automatically updates READMEs, CLAUDE.md, and project documentation after any code changes
- `typescript-pro` - Advanced TypeScript expert for complex type systems, enterprise patterns, and type safety optimization

### Automatic Sub-Agent Usage Patterns

**Frontend Development:**
- Use `frontend-react-expert` for React components, UI optimization, and responsive design
- Use `react-specialist` for Guardian-specific React patterns, TypeScript fixes, and form builders
- Use `design-review-agent` automatically after UI changes or via `/design-review` command for comprehensive design evaluation
- Use `typescript-pro` proactively for complex TypeScript architectures and type optimization

**Backend Development:**
- Use `api-specialist` for API endpoints, Express server management, and multi-server synchronization
- Use `database-specialist` for database operations, Prisma queries, and company-based data isolation
- Use `security-specialist` for authentication, authorization, and security reviews
- Use `resend-email-specialist` for any email functionality including verification, notifications, and deliverability issues

**Infrastructure & Deployment:**
- Use `deployment-specialist` proactively for Azure deployment issues, pipeline failures, and IIS configuration
- Use `error-monitor-specialist` for production errors, debugging, and system monitoring
- Use `doc-updater` automatically after ANY code changes to update documentation

**Quality Assurance & Testing:**
- Use `testing-qa-specialist` for comprehensive testing coverage, quality assurance validation, and test strategy development for government-grade applications

### Task-Based Sub-Agent Selection

| Task Type | Primary Agent | Secondary Agent | Use When |
|-----------|---------------|-----------------|----------|
| React Component Creation | `frontend-react-expert` | `react-specialist` | Building/modifying UI components |
| TypeScript Architecture | `typescript-pro` | `frontend-react-expert` | Complex type systems, enterprise patterns |
| API Endpoint Changes | `api-specialist` | `security-specialist` | Adding/modifying endpoints across server files |
| Database Schema/Queries | `database-specialist` | `security-specialist` | Any database operations or schema changes |
| Form Builder Features | `react-specialist` | `database-specialist` | Form templates, field management, validation |
| Authentication/Security | `security-specialist` | `database-specialist` | Auth flows, JWT tokens, company isolation |
| Email Integration | `resend-email-specialist` | `api-specialist` | Verification emails, notifications, deliverability |
| Testing & Quality Assurance | `testing-qa-specialist` | `security-specialist` | Test coverage, QA validation, pre-deployment testing |
| Production Errors | `error-monitor-specialist` | `deployment-specialist` | Debugging, monitoring, error analysis |
| Deployment Issues | `deployment-specialist` | `api-specialist` | Pipeline failures, Azure/IIS problems |
| Documentation Updates | `doc-updater` | N/A | After any code changes (MANDATORY) |

### Streamlined Workflow

1. **Auto-Planning**: Use TodoWrite tool immediately when receiving multi-step tasks
2. **Agent Selection**: Automatically choose appropriate sub-agent based on task type (see table above)
3. **Parallel Execution**: Run multiple agents concurrently when tasks are independent
4. **Validation**: Use `security-specialist` to review any changes affecting company data isolation
5. **Quality Assurance**: Use `testing-qa-specialist` for comprehensive testing coverage and pre-deployment validation
6. **Documentation**: Use `doc-updater` proactively after ANY code modifications
7. **Testing**: Run appropriate tests (`bun test`, `bun run lint`, `tsc --noEmit`) before completion

### Multi-Server Synchronization Protocol

**CRITICAL**: When modifying API endpoints, automatically ensure synchronization:
1. Use `api-specialist` to update ALL THREE server files simultaneously:
   - `server.cjs` (development)
   - `server-production.js` (production source)
   - `server.js` (local production testing)
2. Use `deployment-specialist` if deployment issues arise
3. Use `doc-updater` to update endpoint documentation

### Efficiency Guidelines

**DO automatically:**
- Use specialized agents for their expertise areas
- Run multiple agents in parallel for independent tasks
- Use `testing-qa-specialist` for comprehensive test coverage and quality validation
- Update documentation after code changes
- Validate company isolation in database operations
- Test code before marking tasks complete

**DON'T do manually:**
- Search for code patterns (use agents with search tools)
- Manually synchronize endpoints across server files
- Skip documentation updates
- Bypass security validation for database changes
- Work on multiple complex tasks simultaneously

### Agent Automation Examples

**Example 1: Adding New API Endpoint**
```
User Request: "Add a new endpoint to get user preferences"
Automatic Response: Use api-specialist to:
1. Add endpoint to all 3 server files simultaneously
2. Implement company-based data filtering
3. Use security-specialist to validate authorization
4. Use doc-updater to update API documentation
```

**Example 2: Creating React Component**
```
User Request: "Create a user profile modal component"
Automatic Response: Use frontend-react-expert to:
1. Build responsive modal with Guardian design patterns
2. Use react-specialist for TypeScript integration
3. Use typescript-pro for complex type definitions
4. Use database-specialist if data fetching needed
5. Use doc-updater to document component usage
```

**Example 3: Database Schema Change**
```
User Request: "Add notification preferences table"
Automatic Response: Use database-specialist to:
1. Design schema with proper company isolation
2. Create Prisma migrations
3. Use security-specialist to validate data access patterns
4. Use api-specialist to create related endpoints
5. Use doc-updater to update schema documentation
```

**Example 4: Email Integration**
```
User Request: "Add email verification to user registration"
Automatic Response: Use resend-email-specialist to:
1. Configure Resend API integration
2. Create responsive email templates
3. Use api-specialist for verification endpoints
4. Use security-specialist for token security
5. Use doc-updater to document email workflows
```

**Example 5: Production Error Resolution**
```
User Request: "Users are getting 500 errors on the requests page"
Automatic Response: Use error-monitor-specialist to:
1. Analyze error logs and identify root cause
2. Use deployment-specialist for server-side issues
3. Use database-specialist for query problems
4. Use api-specialist for endpoint fixes
5. Use testing-qa-specialist for validation
```

**Example 6: Quality Assurance & Testing**
```
User Request: "I just implemented a new authentication endpoint and need thorough testing"
Automatic Response: Use testing-qa-specialist to:
1. Create comprehensive test coverage for the endpoint
2. Validate security and authorization patterns
3. Test edge cases and error handling
4. Create pre-deployment testing checklist
5. Use security-specialist for security validation
```

### Performance Optimization Guidelines

**Concurrent Agent Execution:**
- Run independent agents in parallel using single message with multiple tool calls  
- Example: api-specialist + database-specialist + security-specialist + testing-qa-specialist + resend-email-specialist simultaneously
- Avoid sequential execution when tasks don't depend on each other

**Agent Specialization Benefits:**
- **11 Specialized Domains**: Complete coverage from frontend React to production monitoring
- **Reduced Context Switching**: Each agent maintains deep focus in their expertise area
- **Guardian MVP Conventions**: Automatic adherence to project patterns and security requirements
- **Built-in Validation**: Security, company isolation, and quality standards enforced automatically
- **Production-Ready**: Error monitoring, deployment, and testing specialists ensure reliability


### User Registration

1. User visits the registration page
2. User fills out the email form
3. User clicks the "Send Verification Code" button
4. User receives a verification code via email
5. User fills out the verification code form
6. User clicks the "Verify" button
7. User fills out the fullname, company name, and password form
8. User clicks the "Register" button
9. User is redirected to the login page

### User Login (Enhanced - 2025-08-08)

1. User visits the login page
2. User fills out user email and password form (with enhanced validation)
3. User clicks the "Login" button
4. User is redirected to roles based dashboard

#### Enhanced Security Features (Added 2025-08-08)
- **Email Validation**: 125 character limit with security-hardened validation
- **Rate Limiting**: 5 login attempts maximum with 15-minute lockout period
- **Anti-Enumeration**: Generic error messages to prevent user account discovery
- **Input Sanitization**: Client and server-side validation across all environments

### User Logout

1. User visits the dashboard
2. User clicks the "Logout" button
3. User is redirected to the login page

## Design Review Workflow (New - 2025-08-17)

### Automated Design Reviews
Guardian MVP includes a comprehensive design review system that ensures world-class UI/UX standards through automated evaluation using Playwright live testing.

#### Design Review Agent (`design-review-agent`)
- **7-Phase Review Methodology**: Systematic evaluation covering interaction, responsiveness, accessibility, code quality
- **Live Browser Testing**: Real-time UI testing using Playwright MCP integration
- **Evidence-Based Feedback**: Screenshots, metrics, and specific examples for all findings
- **Triage Matrix**: Issues categorized by severity (Critical, High, Medium, Low priority)
- **Government Standards**: WCAG 2.1 AA compliance and enterprise-grade requirements

#### Quick Visual Verification (After Frontend Changes)
Automatically perform after any UI modifications:
1. **Identify Modified Components**: Review git diff for frontend file changes
2. **Navigate to Affected Pages**: Test impacted user interfaces
3. **Verify Design Compliance**: Check against Guardian MVP design principles
4. **Validate Feature Implementation**: Ensure functionality works as intended
5. **Check Acceptance Criteria**: Confirm requirements are met
6. **Capture Screenshots**: Document current state (1440px viewport standard)
7. **Console Error Check**: Verify no JavaScript errors or warnings

#### Comprehensive Design Validation
Use `/design-review` command for:
- **Significant UI/UX Features**: New components or major interface changes
- **Pre-PR Visual Changes**: Before submitting pull requests with frontend modifications
- **Accessibility Testing**: WCAG compliance and government accessibility standards
- **Cross-Browser Compatibility**: Ensure consistent experience across platforms
- **Performance Impact**: Validate UI changes don't negatively affect load times

#### 7-Phase Review Process
1. **Preparation**: Identify changes, review design principles, set testing viewport
2. **Interaction Testing**: User flows, interactive elements, keyboard navigation
3. **Responsiveness**: Multiple device sizes, layout adaptation, touch targets
4. **Visual Polish**: Typography, color contrast, spacing, brand consistency
5. **Accessibility**: WCAG 2.1 AA compliance, screen reader compatibility
6. **Robustness**: Error states, edge cases, performance under load
7. **Code Health**: Component structure, CSS organization, maintainability

#### Design Principles Integration
All reviews reference `/docs/design-principles.md` covering:
- **Users First**: Government worker efficiency and workflow optimization
- **Professional Standards**: Enterprise-grade polish for government use
- **Security-First Design**: Visual data separation and role-based UI
- **Accessibility Excellence**: WCAG 2.1 AA+ compliance requirements
- **Mobile-Responsive**: Touch-friendly design for government mobile usage
- **Performance**: Fast load times on typical government networks
- **Clarity & Simplicity**: Plain English and logical information hierarchy

#### Usage Commands
```bash
# Comprehensive design review of recent changes
/design-review

# Component-specific review
/design-review RequestModal
/design-review dashboard
/design-review forms/new-request
```

#### Integration Points
- **Automatic Triggers**: Frontend file changes, new components, major UI modifications
- **Manual Triggers**: `/design-review` slash command, pre-deployment validation
- **Git Integration**: Analyzes recent changes using `git diff`
- **Playwright Integration**: Live browser testing with screenshot capture
- **Documentation**: Updates design review findings in project documentation

### User Request Fulfillment Workflow

#### First-Time Admin Onboarding (New - 2025-08-08)
For administrators logging in for the first time:
1. System automatically detects Admin (role ID 1) or Super Admin (role ID 6) users
2. System checks for existing company form templates using COMPANY_ID filtering
3. If no templates exist, displays "Configure your first form!" wizard modal
4. **Guided Form Creation Process:**
   - **Step 1**: Select form type (Requests, Self-Service, Notice)
   - **Step 2**: Create form title and description
   - **Step 3**: Build form fields using familiar interface
5. Form template is saved with proper company isolation
6. User can then proceed with normal dashboard functionality

#### Standard Request Creation Flow
1. User visits the dashboard
2. User clicks the "Fill Request Form" button
3. User is redirected to the request fulfillment page
4. User fills out the request fulfillment form
5. User clicks the "Submit" button
6. User is redirected to the dashboard

#### Request Processing with Task Management
1. **Processor/Manager** opens request from dashboard
2. **Work Progress Modal** displays with 4 tabs:
   - **Details**: Request information and status
   - **Form**: Form data and field values
   - **Progress**: Status updates and completion tracking
   - **Tasks**: Comprehensive task management interface

#### Task Management Workflow (Enhanced - 2025-08-07)

**Task Creation:**
1. From Tasks tab, click "Add Task" button
2. **AddTaskModal** opens with form fields:
   - **Assigned To**: Dropdown with organization users + UNASSIGNED option (default)
   - **Description**: Required multi-line text field (250 character limit)
3. Task auto-generates tracking ID (TSK-{timestamp}-{random})
4. Auto-creates notifications for task assignments

**Task Status Management:**
- **Available Status Flow**:
  - `Pending → In Progress → Completed` (traditional flow)
  - `Pending → Completed` (direct completion)
  - `Pending → Cancelled` (task cancellation)

**Task Operations:**
- **Start Task**: Changes status from Pending → In Progress (assigns to current user)
- **Complete Task**: Changes status from Pending OR In Progress → Completed (flexible completion)
- **Cancel Task**: Changes status from Pending → Cancelled (only pending tasks allowed)
- **Multi-select Operations**: Batch operations with confirmation dialogs

**Task Table Features:**
- **AG Grid Display**: Task ID, Description, Status, Assigned To, Created Date
- **Status Filtering**: All, Pending, In Progress, Completed, Cancelled
- **Status Summary Cards**: Real-time counts by status
- **Export Options**: CSV and Excel export functionality
- **Multi-select**: Checkboxes for batch operations

**Role Access:**
- **Processor**: Full task management within assigned requests
- **Manager**: Complete oversight of all company tasks
- **User**: View task status and updates
- **Admin**: Full administrative access to task system


## Environment Configuration

This project uses a **two-environment configuration** with distinct server setups for development and production.

### Development Environment

**File:** `server.cjs`  
**Purpose:** Full-featured development server with comprehensive authentication and email services  
**Runtime:** Local development (port 3001 - Fixed 2025-08-12)

**Features:**
- Static file serving via Express (`express.static('.')`)
- SPA fallback route (`app.get('*', ...)`) for React Router
- Database-backed email verification storage
- Resend email service integration for verification emails
- Complete registration/authentication flow
- Company isolation through `getAuthenticatedUserCompany` middleware
- Enhanced form template creation with proper SQL Server compatibility (Fixed 2025-08-12)

**Key Dependencies:**
- Email service with Resend API
- Database storage for verification codes
- Comprehensive error handling and fallback forms
- SQL Server parameterized queries with proper syntax

### Production Environment (IIS)

**File:** `server.js`  
**Purpose:** Production-ready server optimized for IIS deployment  
**Runtime:** Production IIS server

**Features:**
- No static file serving (handled by IIS via web.config)
- Memory-based verification code storage (for production simplicity)
- Company-based data isolation and security
- Same API endpoints as development
- Optimized for IIS deployment

**Key Differences:**
- Static files served by IIS instead of Express
- Verification codes stored in memory vs database
- No SPA fallback route (handled by web.config)

## API Endpoints

Both environments support the same complete set of API endpoints:

### Authentication & Registration (Enhanced Security - 2025-08-08)
- `POST /api/login` - User authentication with enhanced email validation and rate limiting
- `POST /api/register` - Start registration process
- `POST /api/verify-email` - Verify email with code
- `POST /api/complete-registration` - Complete user registration
- `POST /api/request-password-reset` - Request password reset (streamlined flow)
- `POST /api/verify-reset-code` - Verify reset code (enhanced resend functionality)
- `POST /api/reset-password` - Reset password with code
- `POST /api/send-verification-email` - Resend verification email
- `POST /logout` - User logout

### User Management
- `GET /api/users` - Get users (company-filtered)
- `GET /api/users/company/:companyId` - Get users by company
- `POST /api/validate-email` - Email validation

### Invites System
- `GET /api/invites` - Get invites (company-filtered)
- `POST /api/invites` - Send invites
- `DELETE /api/invites/:id` - Delete invite (Added 2025-07-26)
- `POST /api/invite/accept` - Accept invite

### Requests Management
- `GET /api/requests` - Get requests (company-filtered)
- `GET /api/requests/assigned/me` - Get assigned requests
- `POST /api/requests` - Create new request
- `PUT /api/requests/:requestId/assign` - Assign request
- `POST /api/requests/:id/start` - Start request
- `POST /api/requests/:id/complete` - Complete request
- `PUT /api/requests/:id/progress` - Update progress

### Task Management (New - 2025-08-07)
- `GET /api/requests/:requestId/tasks` - Get tasks for specific request (company-filtered)
- `POST /api/tasks` - Create new task with auto-generated tracking ID and notifications
- `PUT /api/tasks/:taskId` - Update task (status, assignment, description)
- `DELETE /api/tasks/:taskId` - Delete task with validation

### Task Management Features (Added 2025-08-07)
- **Status Management**: Flexible status transitions (Pending → In Progress → Completed, or direct Pending → Completed)
- **Auto-Assignment**: Tasks can auto-assign to current user when started
- **Batch Operations**: Multi-select support for bulk status changes with confirmation dialogs
- **Tracking Integration**: Auto-generated tracking IDs (TSK-{timestamp}-{random})
- **Notification System**: Automatic notification creation for task assignments
- **Export Functionality**: CSV and Excel export of task data
- **Company Isolation**: All task operations filtered by user's company for security

### Forms & Fields (Enhanced Company Isolation - 2025-08-08)
- `GET /api/forms` - Get forms (company-filtered with COMPANY_ID support)
- `POST /api/forms` - Create new form template with proper company isolation (Fixed 2025-08-12)
- `GET /api/forms/:id` - Get specific form with fields
- `GET /api/fields` - Get fields (company-filtered)
- `POST /api/fields` - Create new field with duplicate name checking and validation (Added 2025-07-29)
- `PUT /api/fields/:fieldId` - Update existing field with validation (Added 2025-07-29)
- `GET /api/field-types` - Get available field types including specialized types
- `GET /api/roles` - Get roles

### Field Management Features (Added 2025-07-29)
- **Duplicate Name Prevention**: Automatic checking for duplicate field names within company scope
- **Specialized Field Types**: Support for address, banking, phone, email validation
- **Custom Validation Rules**: Field-specific validation patterns and requirements
- **Bulk Operations**: Support for batch field creation and updates

### Notifications (New - 2025-07-26)
- `GET /api/notifications` - Get user notifications (company-filtered)
- `GET /api/notifications/count` - Get unread notification count
- `PUT /api/notifications/:id/read` - Mark notification as read
- `PUT /api/notifications/read-all` - Mark all notifications as read

### System
- `GET /api/health` - Health check
- `GET /api/test` - API test endpoint

## Security Features

Both environments implement:

### Company-Based Data Isolation
- All endpoints filter data by user's company ID from JWT token
- `getAuthenticatedUserCompany` middleware extracts company from JWT
- Database queries include `WHERE COMPANY_ID = ${req.companyId}` clauses

### Authentication
- JWT token-based authentication
- Company ID embedded in JWT tokens
- Protected routes require valid authentication

### Data Security
- Users can only access their company's data
- Request assignments limited to same-company users
- Cross-company data access prevented

## Database Schema

The application uses these key tables:
- `GUARDIAN.ATTACHMENTS` - Attachments with request association
- `GUARDIAN.USERS` - User accounts with company association
- `GUARDIAN.USER_ROLES` - User roles with user association
- `GUARDIAN.ROLES` - User roles and permissions
- `GUARDIAN.COMPANY` - Companies with organization association
- `GUARDIAN.COMPANY_INFO` - Company information
- `GUARDIAN.REQUESTS` - Requests with company filtering
- `GUARDIAN.TASKS` - Tasks with request association
- `GUARDIAN.INVITES` - Invitation system
- `GUARDIAN.FORMS` - Form templates (by ORGANIZATION_ID)
- `GUARDIAN.FIELDS` - Form fields (by ORGANIZATION_ID)
- `GUARDIAN.FIELD_TYPE` - Field type definitions
- `GUARDIAN.NOTIFICATIONS` - User notifications with read tracking (Added 2025-07-26) 
- `GUARDIAN.FORMS_INSTANCE` - Form instances
- `GUARDIAN.FORMS_INSTANCE_VALUES` - Form instance values

## Forms Templates & Company Isolation (Enhanced - 2025-08-08)

### Template Types & Access Control
- **Global Forms Templates**: Stored in `GUARDIAN.FORMS` table with `COMPANY_ID` set to `null`
  - Can be created and edited by users with role ID 6 (Super Admin)
  - Available to all companies as base templates
- **Company Forms Templates**: Stored in `GUARDIAN.FORMS` table with `COMPANY_ID` set to the company ID
  - Can be created and edited by users with role IDs 1 (Admin) and 6 (Super Admin)
  - Isolated by company for multi-tenant security

### First-Time Admin Template Creation (New - 2025-08-08)
- **Automatic Detection**: System checks for existing company templates using COMPANY_ID filtering
- **Guided Creation**: First-time admins are guided through template creation process
- **Form Service Integration**: Enhanced formService.ts supports both COMPANY_ID and ORGANIZATION_ID filtering
- **Database Schema**: Updated DbForm interface includes COMPANY_ID field for proper data isolation
- **Security**: All template operations filtered by user's company ID to prevent cross-company access

## Development Commands

### Development Environment Setup

**Start Development Servers:**
```bash
# Backend development server (port 3001) - Fixed configuration 2025-08-12
DATABASE_URL="sqlserver://guardian-dev-db.database.windows.net:1433;database=GUARDIAN-DEV;user=GUARDIAN;password=Sh13ldlyt1c$;encrypt=true;trustServerCertificate=false" bun server.cjs

# Frontend development server (port 5175) with proxy to backend
bun run dev

# Both simultaneously (in separate terminals)
bun run backend    # Backend with proper DATABASE_URL
bun run dev        # Frontend with proxy routing to port 3001
```

**Database Management:**
```bash
# Generate Prisma client after schema changes
bun prisma generate

# Populate field types (run once after setup)
bun populate-field-types

# Add standard form templates (run once after setup)  
bun add-templates
```

**Build Commands:**
```bash
# Build everything for production
bun run build:all

# Build frontend only
bun run build

# Build backend only  
bun run build:server
```

**Testing & Quality:**
```bash
# Run test suite
bun test

# Lint code
bun run lint

# Type checking
tsc --noEmit
```

### Environment Configuration Notes

**IMPORTANT: Password character escaping required (Fixed 2025-07-26)**
```bash
# The $ character in passwords must be escaped as \$ in .env files
# Correct format in .env.development:
DATABASE_URL="sqlserver://guardian-dev-db.database.windows.net:1433;database=GUARDIAN-DEV;user=GUARDIAN;password=Sh13ldlyt1c\$;encrypt=true;trustServerCertificate=false;schema=GUARDIAN"
```

**Production Testing:**
```bash
# Test production build locally
bun server.js  # or node server.js
```

## Important Notes

1. **Never confuse the environments** - `server.cjs` is for development, `server.js` is for production
2. **Company isolation is critical** - All user data must be filtered by company ID for security
3. **Both servers have identical API endpoints** - Only the implementation details differ between environments
4. **Production uses IIS** - Static file serving and SPA routing handled by web.config
5. **Development uses full Express** - Includes static serving and SPA fallback for React Router
6. **Database connection requirement** - Development server MUST use explicit DATABASE_URL for stable connection (Fixed 2025-08-12)
7. **Form template creation** - SimpleFormBuilder fully functional with enhanced SQL Server compatibility and proper company isolation (Fixed 2025-08-12)
8. **Port configuration** - Frontend runs on port 5175, backend on port 3001 with Vite proxy routing (Standardized 2025-08-12)
9. **Field Management** - New CRUD operations for fields require proper validation and duplicate checking
10. **Email Integration** - Resend API handles all transactional emails including assignments and verifications
11. **Notification System** - Real-time notifications with database persistence and read tracking
12. **Workflow Management** - Advanced form template management with role-based access control and first-time admin onboarding
13. **Task Management System** - Comprehensive task system with flexible status management, batch operations, and automatic notification integration (Added 2025-08-07)
14. **First-Time Admin Experience** - Guided workflow template creation with automatic detection and company-based isolation (Added 2025-08-08)
15. **Enhanced Security** - Hardened email validation, rate limiting, and anti-enumeration protection (Added 2025-08-08)
16. **SQL Server Compatibility** - All database operations use proper parameterized queries with `${variable}` syntax for security and compatibility (Fixed 2025-08-12)

## Deployment

### Development
- Run `server.cjs` locally with explicit DATABASE_URL (required for stable connection - Fixed 2025-08-12)
- Static files served by Express
- Email service requires Resend API key
- Frontend runs on port 5175 via Vite with proxy configuration
- Backend runs on port 3001 with proper SQL Server compatibility
- Vite proxy routes API calls from frontend (port 5175) to backend (port 3001)
- Form template creation fully functional with enhanced database integration

### Production (Azure App Service)
- Deploy via Azure DevOps pipeline
- Pipeline deploys `server-production.js` (renamed to `server.js` during deployment)
- Configure web.config for static files and SPA routing
- Ensure database connection string is configured
- JWT_SECRET environment variable required

## Project Structure & Statistics

### Current Codebase Overview (2025-07-30)
- **Version**: 2.5.0 (from package.json)
- **Frontend Components**: 96 TypeScript/React files in src/
- **Backend Servers**: 13 server files for different environments
- **Active Development Files**: 
  - `server.cjs` (Development - 120KB)
  - `server-production.js` (Production Source - 135KB)
  - `server.js` (Production Deployed - 134KB)

### Key Components Added Recently
- **TaskTable.tsx**: Comprehensive task management with AG Grid, multi-select, and export functionality (Added 2025-08-07)
- **AddTaskModal.tsx**: Task creation modal with user assignment and validation (Added 2025-08-07)
- **WorkflowManagementModal.tsx**: Advanced workflow template management
- **AdminFields.tsx**: Complete field CRUD operations with AG Grid
- **NotificationDropdown.tsx**: Real-time notification system
- **FormFieldItem.tsx** & **FormFieldPreview.tsx**: Enhanced form building
- **Enhanced Authentication**: Role-based access with JWT tokens

### Database Schema Complexity
- **Core Tables**: 15+ tables in GUARDIAN schema
- **Form System**: Dynamic form generation with field validation
- **User Management**: Multi-role system with company isolation
- **Notification System**: Real-time alerts with read tracking
- **Request Tracking**: Full lifecycle management with auto-generated IDs

## Critical Deployment Information

⚠️ **IMPORTANT: Pipeline Configuration** ⚠️

The Azure DevOps pipeline (`azure-pipelines.yml`) has a **specific file mapping** that must be maintained:

```yaml
# Line 52 in azure-pipelines.yml
cp server-production.js deployment/server.js
```

**This means:**
- **Development server**: `server.cjs` (for local development)
- **Production source**: `server-production.js` (source file with all endpoints)
- **Production deployed**: `server.js` (what actually runs on Azure)

### Why This Matters

1. **When updating API endpoints**, you MUST update `server-production.js`, not just `server.js`
2. **The pipeline copies `server-production.js` → `server.js` during deployment**
3. **If you only update `server.js`, your changes will NOT be deployed to production**

### Endpoint Synchronization Checklist

When adding/modifying API endpoints, ensure they exist in ALL THREE files:
- ✅ `server.cjs` (development)
- ✅ `server-production.js` (production source) 
- ✅ `server.js` (for local production testing)

### Common Pitfall Prevention

**Symptom:** "Pipeline runs successfully but endpoints return 404 in production"
**Cause:** Updated `server.js` but not `server-production.js`
**Fix:** Copy changes from `server.js` to `server-production.js` and redeploy

**Command to sync:**
```bash
cp server.js server-production.js
git add server-production.js
git commit -m "sync: update server-production.js with latest endpoints"
git push origin main
```

### Verification Steps

After any server changes:
1. **Local testing**: Run `bun server.js` to test production code locally
2. **Update production source**: Ensure `server-production.js` has your changes
3. **Deploy**: Push to trigger pipeline 
4. **Verify**: Test endpoints on `https://guardian-mvp-dtgph0bcd4ctdbhb.eastus2-01.azurewebsites.net`
5. **Debug endpoint**: Check `/api/debug/endpoints` for confirmation

## Technology Stack

### Backend Technologies
- **Runtime:** Node.js/Bun with Express.js framework
- **Database:** Microsoft SQL Server with Prisma ORM
- **Authentication:** JWT tokens with bcrypt password hashing
- **Email Service:** Resend API for transactional emails
- **File Handling:** Multer for file uploads and attachments
- **Validation:** Custom validation with specialized field types

### Frontend Technologies  
- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite for development and production builds
- **Routing:** React Router DOM v7 with protected routes
- **UI Components:** Custom components with React Bootstrap
- **Data Grids:** AG Grid Community for advanced table functionality
- **Styling:** Tailwind CSS with Bootstrap utilities
- **Icons:** Lucide React and React Icons
- **Notifications:** React Toastify for user feedback
- **Modals:** React Modal for dialogs and forms

### Development & Deployment
- **Package Manager:** Bun (preferred) or npm
- **Version Control:** Git with Azure DevOps pipelines
- **Deployment:** Azure App Service with IIS
- **Environment Management:** Multiple environment configuration
- **Testing:** Bun test framework with comprehensive test suites
- **Linting:** ESLint with TypeScript and React rules

## Troubleshooting

### Database Connection Issues in Development
If you see "Authentication failed against database server" errors when starting `server.cjs`:

**Symptom:** Prisma can't connect to database, login fails
**Solution:** Start development server with explicit DATABASE_URL:
```bash
DATABASE_URL="sqlserver://guardian-dev-db.database.windows.net:1433;database=GUARDIAN-DEV;user=GUARDIAN;password=Sh13ldlyt1c$;encrypt=true;trustServerCertificate=false" bun server.cjs
```

**CORRECT Database Connection Details:**
- Server: `guardian-dev-db.database.windows.net`
- Port: `1433`
- Database: `GUARDIAN-DEV`
- User: `GUARDIAN`
- Password: `Sh13ldlyt1c$`
- Additional parameters: `encrypt=true;trustServerCertificate=false`

**Success indicators:**
- Log shows "✅ Database connected successfully"
- Login attempts work (queries database for user validation)
- API endpoints return data instead of authentication errors

### Form Template Creation Issues (Fixed 2025-08-12)
If form template creation fails or returns server errors:

**Common Symptoms:**
- "Form template creation failed" error messages
- 500 Internal Server Error on POST /api/forms
- SimpleFormBuilder component not saving templates

**Root Causes & Solutions:**
- ✅ **SQL Server Query Syntax**: Fixed parameterized query format from `?` to `${variable}` syntax
- ✅ **Table Name References**: Corrected FORM_FIELDS vs FIELDS table naming issues
- ✅ **JWT Middleware**: Fixed req.user.userId vs req.userId property access
- ✅ **Company ID Filtering**: Proper multi-tenant security with company-based isolation
- ✅ **Port Configuration**: Ensure frontend (5175) properly proxies to backend (3001)

**Verification Steps:**
1. Check server logs for "✅ Database connected successfully" 
2. Verify all three server files are synchronized
3. Test form creation through SimpleFormBuilder component
4. Confirm form templates appear in GUARDIAN.FORMS table

## Recent Changes & Fixes

### Latest Updates (2025-08-20)

#### Enhanced Notice Creation with Contact Groups Support
- ✅ **Contact Groups Integration**: POST /api/notices endpoint now supports both individual recipients and contact groups in a single request
- ✅ **Backward Compatibility**: Maintains support for existing `recipientUserIds` format while adding new `recipients` and `contactGroups` arrays
- ✅ **Contact Group Resolution**: Automatically resolves contact group IDs to individual user IDs by querying NOTICE_CONTACT_GROUP_MEMBERS table
- ✅ **Duplicate Prevention**: Uses Set to remove duplicate recipients when combining individual users and contact group members
- ✅ **Enhanced Validation**: Validates contact groups belong to the same company and only includes active users with active membership status
- ✅ **Multi-Server Synchronization**: Updated all three server files (server.cjs, server.js, server-production.js) with identical functionality
- ✅ **Security Enhancement**: Proper company-based data isolation maintained throughout contact group resolution process
- ✅ **Detailed Logging**: Enhanced console logging shows recipient resolution details including individual vs contact group counts

#### API Enhancement Details
**New Request Format:**
```json
{
  "TITLE": "Notice Title",
  "CONTENT": "Notice content",
  "NOTICE_TYPE": "GENERAL",
  "recipients": [1, 2, 3],           // Individual user IDs (optional)
  "contactGroups": [10, 11],         // Contact group IDs (optional)
  "STATUS": "PUBLISHED"
}
```

**Resolution Process:**
1. Extract both `recipients` and `contactGroups` arrays from request body
2. Validate contact groups exist and belong to user's company
3. Query NOTICE_CONTACT_GROUP_MEMBERS to get all active members from specified groups
4. Combine individual recipients with resolved contact group members
5. Remove duplicates using Set to ensure each user receives only one notice
6. Validate all final recipients are active users from the same company
7. Create notice recipients entries for all resolved users

### Previous Updates (2025-08-12)

#### First-Time Admin Modal System & Company Isolation - FULLY RESOLVED
- ✅ **COMPANY_ID Field Transmission Fixed**: Resolved critical database-to-frontend data flow issue where COMPANY_ID wasn't being transmitted from SQL Server queries to React components
- ✅ **Enhanced Company-Based Form Template Detection**: Fixed logic that determines when to show first-time admin modal based on existing company form templates
- ✅ **Modal Display Logic Corrected**: NewRequestModal now correctly shows/hides based on proper COMPANY_ID filtering and template existence checking
- ✅ **Multi-Tenant Company Isolation**: Each company's admins see the modal independently - works for any admin (role 1) or super admin (role 6) in any company on first login after account creation
- ✅ **Authentication Flow Integration**: System properly detects first-time admin status and guides them through template creation workflow

#### API Endpoint Debugging & Server Synchronization Enhancements
- ✅ **Comprehensive Debug Logging**: Added detailed server-side logging to GET /api/forms endpoint showing raw database results and formatted API responses
- ✅ **Enhanced Troubleshooting**: Server logs now display COMPANY_ID field values, database query results, and response formatting for debugging complex data flow issues
- ✅ **Multi-Server File Synchronization**: Ensured all fixes propagated across server.cjs, server.js, and server-production.js for complete development/production parity
- ✅ **Database Query Validation**: Verified SQL Server query results include all required fields (COMPANY_ID, ORGANIZATION_ID, form details) with proper data types
- ✅ **API Response Consistency**: Standardized response formatting across all environments to ensure frontend components receive expected data structure

#### Authentication & Company Data Flow Architecture
- ✅ **localStorage Company ID Storage**: Confirmed localStorage-based company ID storage working correctly across browser sessions
- ✅ **Complete Data Flow Chain**: Verified company ID flows properly: Database → API Response → localStorage → useAuth hook → Frontend components
- ✅ **Dual-Layer Company Filtering**: Company-based data isolation working on both backend (JWT token validation) and frontend (localStorage-based filtering)
- ✅ **Role-Based Access Control**: First-time admin modal correctly detects admin/super admin roles and applies proper company-based template checking
- ✅ **Cross-Component Integration**: NewRequestModal, SimpleFormBuilder, and form management components all properly integrated with company isolation system

#### Technical Improvements & System Stability
- ✅ **Database Connection Reliability**: Enhanced development server stability with improved DATABASE_URL configuration handling
- ✅ **Error Handling Enhancement**: Added comprehensive error logging and fallback mechanisms for company ID retrieval and template detection
- ✅ **Production Deployment Verification**: Confirmed all fixes properly synchronized across development and production server configurations
- ✅ **Form Template Creation Workflow**: Complete end-to-end testing of admin onboarding flow from login to first template creation with company isolation

### Previous Updates (2025-08-12)

#### SimpleFormBuilder Database Integration - RESOLVED
- ✅ **POST /api/forms Endpoint Fixed**: Resolved critical server-side issues preventing form template creation
- ✅ **SQL Server Compatibility**: Fixed parameterized query syntax errors - changed from `?` placeholders to `${variable}` syntax
- ✅ **Table Name Resolution**: Corrected database table references (FORM_FIELDS vs FIELDS) in junction table queries
- ✅ **JWT Authentication**: Fixed middleware issues with req.user.userId vs req.userId property access
- ✅ **Company vs Organization ID**: Proper COMPANY_ID vs ORGANIZATION_ID usage for multi-tenant security
- ✅ **Port Configuration**: Stabilized frontend-backend communication between ports 5175 and 3001
- ✅ **Database Schema Integration**: Enhanced form-field relationship management through GUARDIAN.FORMS_FIELDS junction table
- ✅ **SQL Injection Prevention**: Implemented proper string escaping and parameterized queries
- ✅ **Development Workflow**: Improved server startup with explicit DATABASE_URL configuration
- ✅ **Multi-Server Synchronization**: Ensured all three server files (server.cjs, server-production.js, server.js) include fixes

#### Technical Architecture Improvements (2025-08-12)
- ✅ **Database Connection Stability**: Resolved authentication issues with explicit environment variable configuration
- ✅ **Form Template Storage**: Properly implemented GUARDIAN.FORMS table integration with company-based isolation
- ✅ **Field Definition Management**: Enhanced GUARDIAN.FIELDS table operations with validation and duplicate checking
- ✅ **Security Enhancement**: Multi-tenant security with proper company ID filtering across all form operations
- ✅ **Error Handling**: Comprehensive error logging and fallback mechanisms for form creation failures
- ✅ **Development Experience**: Streamlined local development setup with clear configuration requirements

### Previous Updates (2025-08-08)

#### First-Time Admin Workflow Template Creation
- ✅ **Automatic Admin Detection**: System automatically identifies first-time admins (roles 1, 6) without existing form templates
- ✅ **Company-Based Template Checking**: Uses COMPANY_ID filtering instead of ORGANIZATION_ID for proper multi-tenant security
- ✅ **Guided Form Creation Wizard**: Replaces complex WorkflowManagementModal with step-by-step NewRequestModal interface
- ✅ **Form Type Selection**: Supports Requests, Self-Service, and Notice template types with guided setup process
- ✅ **Enhanced Form Service**: Updated formService.ts with COMPANY_ID field support and proper TypeScript typing
- ✅ **Database Integration**: Updated DbForm interface to include COMPANY_ID for proper data isolation

#### Enhanced Authentication & Security Features
- ✅ **Security-Hardened Email Validation**: Implemented 125 character limit with comprehensive input sanitization
- ✅ **Client-Side Rate Limiting**: 5 login attempts maximum with 15-minute lockout protection
- ✅ **Anti-Enumeration Protection**: Generic error messages prevent user account discovery vulnerabilities
- ✅ **Cross-Environment Validation**: Updated email validation across all 3 server files (server.cjs, server-production.js, server.js)

#### Improved Password Reset User Experience
- ✅ **Streamlined Flow**: ForgotPassword component bypasses success modal and navigates directly to verification
- ✅ **Enhanced Resend Functionality**: VerifyForgotPassword "resend" generates new codes and resets countdown timer
- ✅ **User Experience Optimization**: Removed unnecessary modal steps for faster password reset workflow

#### Form Management System Enhancements
- ✅ **Company Isolation**: All form operations now use COMPANY_ID filtering for proper multi-tenant security
- ✅ **TypeScript Safety**: Eliminated unsafe type assertions with proper interface definitions
- ✅ **Backward Compatibility**: Maintained existing form management functionality while adding new features

### Previous Updates (2025-08-07)

#### Comprehensive Task Management System Implementation
- ✅ **Task Management Integration**: Full task system available from Request Details → Tasks tab in Work Progress Modal
- ✅ **TaskTable Component**: AG Grid with multi-select, status filtering, and export functionality (CSV/Excel)
- ✅ **AddTaskModal Component**: Task creation with user assignment and description validation (250 char limit)
- ✅ **Flexible Status Management**: Support for multiple status flows (Pending→In Progress→Completed OR Pending→Completed)
- ✅ **Batch Operations**: Multi-select task operations with confirmation dialogs for Start, Complete, and Cancel
- ✅ **Auto-Generated Tracking IDs**: Unique task identifiers (TSK-{timestamp}-{random}) with database integration
- ✅ **Notification Integration**: Automatic notifications created for task assignments with company isolation
- ✅ **Role-Based Access**: Processor, Manager, User, and Admin roles with appropriate task permissions
- ✅ **API Endpoints**: Complete CRUD operations for tasks with company-based data filtering
- ✅ **Status Summary Cards**: Real-time task counts by status (Pending, In Progress, Completed, Cancelled)
- ✅ **Enhanced Database Integration**: Full utilization of existing GUARDIAN.TASKS table with audit trails

### Previous Updates (2025-07-29 to 2025-07-30)

#### Workflow Management & Field CRUD Operations
- ✅ **Advanced Field Management**: Complete CRUD operations for custom fields with duplicate name checking
- ✅ **Specialized Field Types**: Support for address fields, banking information, and custom validation rules  
- ✅ **WorkflowManagementModal**: New component for managing form templates and workflows
- ✅ **Enhanced Field Types**: Extended field type system with banking, address, and specialized validation
- ✅ **Batch Operations**: Support for bulk field operations and validation

#### Database & Request Improvements
- ✅ **Database-Generated Tracking IDs**: Automatic tracking ID generation using SQL Server sequences
- ✅ **Raw SQL Integration**: Enhanced database queries using `$queryRawUnsafe` for complex operations
- ✅ **Request Creation Optimization**: Streamlined request creation with better error handling
- ✅ **Enhanced Logging**: Comprehensive logging for company info updates and request tracking

#### Email Notification System Enhancement
- ✅ **Assignment Notifications**: Email notifications sent when requests are assigned to users
- ✅ **Resend Integration**: Full integration with Resend API for reliable email delivery
- ✅ **Email Templates**: Professional HTML email templates for verification and notifications
- ✅ **Notification Persistence**: Database storage for notification history and read tracking

### Previous Fixes (2025-07-26)

#### Notification System Implementation
- ✅ **Complete notification system** for user assignments and workflow updates
- ✅ **Database schema**: Added `GUARDIAN.NOTIFICATIONS` table with `READ_DATE` column for read tracking
- ✅ **API endpoints**: Full CRUD operations for notifications with company filtering
- ✅ **Frontend component**: `NotificationDropdown.tsx` with real-time updates and unread counts
- ✅ **Auto-creation**: Notifications created automatically when requests are assigned

#### Database Connection Issues Resolved
- ✅ **Password escaping fix**: Special characters (`$`) in passwords must be escaped as `\$` in .env files
- ✅ **Environment variable loading**: Fixed Bun environment variable processing and connection handling
- ✅ **Connection string format**: Verified correct Azure SQL connection parameters and authentication
- ✅ **Development server stability**: Improved connection reliability for local development

#### Admin Role Support & Access Control
- ✅ **Role-based access**: Users with role IDs 1,3,4,6 can see all company data with proper filtering
- ✅ **Form instance access**: Admin users can access all form instances within their organization
- ✅ **Enhanced authentication**: Middleware now includes user roles in JWT tokens for granular control
- ✅ **Permission validation**: Proper validation of user permissions across all endpoints

#### API Completeness & Synchronization
- ✅ **Missing endpoints added**: POST /api/invites and DELETE /api/invites/:id across all server files
- ✅ **Request modal fixes**: User dropdown API response parsing corrected for proper display
- ✅ **Prisma query fixes**: Replaced invalid `prisma.Prisma.raw` with `prisma.$queryRawUnsafe` for compatibility
- ✅ **Invite management**: Users can now delete invited users from AdminUserManagement interface

#### Production Deployment Synchronization
- ✅ **Server file synchronization**: All endpoints properly synchronized across development, production, and production-source files
- ✅ **Pipeline compatibility**: Changes applied to `server-production.js` ensuring proper Azure deployment
- ✅ **Endpoint verification**: Added debug endpoints to verify all routes are properly deployed
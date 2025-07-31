# Guardian MVP - Project Documentation

## Standard Workflow
1. First think through the problem, read the codebase for relevant files, and write a plan to tasks/todo.md.
2. The plan should have a list of todo items that you can check off as you complete them
3. Before you begin working, check in with me and I will verify the plan.
4. Then, begin working on the todo items, marking them as complete as you go.
5. Please every step of the way just give me a high level explanation of what changes you made
6. Make every task and code change you do as simple as possible. We want to avoid making any massive or complex changes. Every change should impact as little code as possible. Everything is about simplicity.
7. Finally, add a review section to the [todo.md](http://todo.md/) file with a summary of the changes you made and any other relevant information.


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

### User Login

1. User visits the login page
2. User fills out user email and password form
3. User clicks the "Login" button
4. User is redirected to roles based dashboard

### User Logout

1. User visits the dashboard
2. User clicks the "Logout" button
3. User is redirected to the login page


### User request fulfillment

1. User visits the dashboard
2. User clicks the "Fill Request Form" button
3. User is redirected to the request fulfillment page
4. User fills out the request fulfillment form
5. User clicks the "Submit" button
6. User is redirected to the dashboard



## Environment Configuration

This project uses a **two-environment configuration** with distinct server setups for development and production.

### Development Environment

**File:** `server.cjs`  
**Purpose:** Full-featured development server with comprehensive authentication and email services  
**Runtime:** Local development (typically port 3000)

**Features:**
- Static file serving via Express (`express.static('.')`)
- SPA fallback route (`app.get('*', ...)`) for React Router
- Database-backed email verification storage
- Resend email service integration for verification emails
- Complete registration/authentication flow
- Company isolation through `getAuthenticatedUserCompany` middleware

**Key Dependencies:**
- Email service with Resend API
- Database storage for verification codes
- Comprehensive error handling and fallback forms

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

### Authentication & Registration
- `POST /api/login` - User authentication
- `POST /api/register` - Start registration process
- `POST /api/verify-email` - Verify email with code
- `POST /api/complete-registration` - Complete user registration
- `POST /api/request-password-reset` - Request password reset
- `POST /api/verify-reset-code` - Verify reset code
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

### Forms & Fields
- `GET /api/forms` - Get forms (company-filtered)
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

## Global Forms Templates
- Global Forms Templates are stored in the `GUARDIAN.FORMS` table with `COMPANY_ID` set to `null`
- Global Forms Templates can be created and edited in the `GUARDIAN.FORMS` table with `COMPANY_ID` set to `null` by users with role IDs 6 (Super Admin)
- Company Forms Templates are stored in the `GUARDIAN.FORMS` table with `COMPANY_ID` set to the company ID
- Company Forms Templates can be created and edited in the `GUARDIAN.FORMS` table with `COMPANY_ID` set to the company ID by users with role IDs 1 (Admin) and 6 (Super Admin)

## Development Commands

### Development Environment Setup

**Start Development Servers:**
```bash
# Backend development server (port 3001)
bun server.cjs  # or node server.cjs

# Frontend development server (port 5175) 
bun run dev

# Both simultaneously (in separate terminals)
bun run backend    # Equivalent to backend server start
bun run dev        # Frontend with hot reload
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
6. **Database connection fix** - If development server has database connection issues, explicitly set DATABASE_URL when starting
7. **Field Management** - New CRUD operations for fields require proper validation and duplicate checking
8. **Email Integration** - Resend API handles all transactional emails including assignments and verifications
9. **Notification System** - Real-time notifications with database persistence and read tracking
10. **Workflow Management** - Advanced form template management with role-based access control

## Deployment

### Development
- Run `server.cjs` locally (use explicit DATABASE_URL if connection fails)
- Static files served by Express
- Email service requires Resend API key
- Frontend runs on port 5175 via Vite
- Backend runs on port 3001 
- Vite proxy routes API calls from frontend to backend

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
DATABASE_URL="sqlserver://guardian-dev-db.database.windows.net:1433;database=GUARDIAN-DEV;user=GUARDIAN@guardian-dev-db;password=Sh13ldlyt1c$;encrypt=true;trustServerCertificate=false" bun server.cjs
```

**CORRECT Database Connection Details:**
- Server: `guardian-dev-db.database.windows.net`
- Port: `1433`
- Database: `GUARDIAN-DEV`
- User: `GUARDIAN@guardian-dev-db`
- Password: `Sh13ldlyt1c$`
- Additional parameters: `encrypt=true;trustServerCertificate=false`

**Success indicators:**
- Log shows "✅ Database connected successfully"
- Login attempts work (queries database for user validation)
- API endpoints return data instead of authentication errors

## Recent Changes & Fixes

### Latest Updates (2025-07-29 to 2025-07-30)

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
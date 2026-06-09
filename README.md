# Guardian MVP - Request Management Platform

![Version](https://img.shields.io/badge/version-2.5.0-blue.svg)
![Node](https://img.shields.io/badge/node-18%2B-green.svg)
![React](https://img.shields.io/badge/react-18.3.1-blue.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.8.3-blue.svg)

Guardian MVP is a comprehensive request management platform designed for enterprise environments. It provides secure, company-isolated workflows for managing requests, user assignments, notifications, and form-based data collection with advanced field management capabilities.

## Features

### Core Functionality
- **Company-Based Data Isolation**: Multi-tenant architecture with complete data separation
- **Request Management**: Full lifecycle management from creation to completion with progress tracking
- **Task Management**: Comprehensive task system with status tracking, assignments, and batch operations
- **User Management**: Role-based access control with invite system
- **Workflow Management**: Customizable forms and templates for different request types with first-time admin onboarding
- **Real-time Notifications**: Email notifications and in-app alerts for assignments and task updates
- **Field Management**: Advanced field types including addresses, banking info, and custom validation

### Advanced Features
- **Email Integration**: Resend API for verification emails and notifications
- **Database-Generated Tracking**: Auto-generated tracking IDs for all requests and tasks
- **Batch Operations**: Support for bulk invites, field operations, and multi-task management
- **Export Functionality**: CSV and Excel export capabilities for task data and reporting
- **Mobile-Responsive Design**: Bootstrap and Tailwind CSS for all devices
- **File Attachments**: Support for document uploads and management
- **Progress Tracking**: Real-time updates on request and task completion status
- **Status Management**: Flexible task status transitions with confirmation dialogs

### Security & Authentication
- **JWT-Based Authentication**: Secure token-based access control
- **Enhanced Email Validation**: Security-hardened email validation with 125 character limit and rate limiting
- **Password Reset Flow**: Streamlined email-based password recovery system with improved user experience
- **Email Verification**: Required email verification for new accounts with anti-enumeration protection
- **Role-Based Permissions**: Granular access control based on user roles
- **Cross-Company Security**: Prevents unauthorized access to other company data

## Technology Stack

### Backend
- **Runtime**: Node.js with Express.js framework (TypeScript: `server/index.ts`)
- **Database**: PostgreSQL (Neon in production, Docker Postgres locally) with Prisma as a client
- **Authentication**: JWT tokens with bcrypt password hashing
- **Email Service**: Resend API for transactional emails
- **File Handling**: Multer for file uploads

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for development and production builds
- **Routing**: React Router DOM v7
- **UI Components**: Custom components with React Bootstrap
- **Styling**: Tailwind CSS with Bootstrap utilities
- **Data Grid**: AG Grid Community for advanced table functionality
- **Icons**: Lucide React and React Icons
- **State Management**: React Context API with custom hooks

### Development Tools
- **Package Manager**: npm
- **Type Checking**: TypeScript with strict configuration
- **Linting**: ESLint with React-specific rules
- **Testing**: Bun test framework
- **Database**: Prisma as a client (schema owned by `postgres/*.sql`)

## Architecture

> **Azure was fully retired on 2026-06-08.** The legacy CommonJS monolith
> (`server.cjs` / `server.js` / `server-production.js`), the DevOps pipeline,
> IIS, and web.config were deleted. See `DEPLOYMENT.md` for current deploy details.

Guardian MVP now runs as:

- **Frontend**: a React + Vite static build deployed to **Netlify** (site `guardian-mvp`), auto-deploying from `github.com/ErnestPenaJr/Guardian` on push. Config in `netlify.toml` (build `npm run build`, publish `dist`, SPA redirect).
- **Backend**: a single **TypeScript Express server** — `server/index.ts`, compiled to `dist-server/index.js` via `npm run build:server` and started with `node dist-server/index.js`. New/changed API endpoints live in `server/routes/*.ts`, mounted in `server/index.ts`. Hosted **off Netlify** (host TBD).
- **Database**: **PostgreSQL** — **Neon** (Netlify DB, database `netlifydb`, `GUARDIAN` schema) in production; Docker Postgres at `localhost:5433` locally.

Local development: `npm run dev:pg` runs the API + Vite frontend together (backend on 3001, frontend on 5175 with proxy routing).

### Database Schema

The application uses a comprehensive PostgreSQL schema (`GUARDIAN` schema):

#### Core Tables
- `GUARDIAN.USERS` - User accounts with company association
- `GUARDIAN.COMPANY` - Company information and organization structure  
- `GUARDIAN.REQUESTS` - Request tracking with company filtering
- `GUARDIAN.TASKS` - Enhanced task management with request association, status tracking, and audit trails
- `GUARDIAN.NOTIFICATIONS` - Real-time notification system with read tracking and task assignment alerts

#### Form Management
- `GUARDIAN.FORMS` - Form templates (supports global and company-specific templates)
- `GUARDIAN.FIELDS` - Custom field definitions with validation rules
- `GUARDIAN.FIELD_TYPE` - Field type definitions (text, email, address, banking, etc.)
- `GUARDIAN.FORMS_INSTANCE` - Form instances for specific requests
- `GUARDIAN.FORMS_INSTANCE_VALUES` - Form data storage

#### User Management
- `GUARDIAN.ROLES` - Role definitions and permissions
- `GUARDIAN.USER_ROLES` - User-role associations
- `GUARDIAN.INVITES` - User invitation system

## API Endpoints

### Authentication & Registration
```
POST /api/login                    - User authentication
POST /api/register                 - Start registration process  
POST /api/verify-email             - Verify email with code
POST /api/complete-registration    - Complete user registration
POST /api/request-password-reset   - Request password reset
POST /api/verify-reset-code        - Verify reset code
POST /api/reset-password          - Reset password with code
POST /api/send-verification-email - Resend verification email
POST /logout                      - User logout
```

### User & Company Management
```
GET  /api/users                   - Get users (company-filtered)
GET  /api/users/company/:id       - Get users by company
POST /api/validate-email          - Email validation
GET  /api/roles                   - Get available roles
```

### Invites System
```
GET    /api/invites               - Get invites (company-filtered)
POST   /api/invites               - Send batch invites
DELETE /api/invites/:id           - Delete invite
POST   /api/invite/accept         - Accept invite
```

### Request Management
```
GET  /api/requests                - Get requests (company-filtered)
GET  /api/requests/assigned/me    - Get assigned requests
POST /api/requests                - Create new request with tracking ID
PUT  /api/requests/:id/assign     - Assign request to user
POST /api/requests/:id/start      - Start request processing
POST /api/requests/:id/complete   - Complete request
PUT  /api/requests/:id/progress   - Update progress
```

### Task Management
```
GET    /api/requests/:requestId/tasks - Get tasks for specific request (company-filtered)
POST   /api/tasks                     - Create new task with auto-generated tracking ID
PUT    /api/tasks/:taskId             - Update task (status, assignment, description)
DELETE /api/tasks/:taskId             - Delete task with validation
```

**Task Status Flow:**
- `Pending → In Progress → Completed` (traditional workflow)
- `Pending → Completed` (direct completion)
- `Pending → Cancelled` (task cancellation)

**Task Features:**
- Auto-generated tracking IDs: `TSK-{timestamp}-{random}`
- Batch operations with multi-select support
- Status filtering: All, Pending, In Progress, Completed, Cancelled
- Export functionality: CSV and Excel formats
- Automatic notification creation for assignments
- Company-based data isolation and role-based access control

### Forms & Field Management
```
GET  /api/forms                   - Get forms (company-filtered)
POST /api/forms                   - Create new form template (Fixed 2025-08-12)
GET  /api/forms/:id               - Get specific form with fields
GET  /api/fields                  - Get fields (company-filtered)
POST /api/fields                  - Create new field with duplicate checking
PUT  /api/fields/:id              - Update field
GET  /api/field-types             - Get available field types
```

### Notifications
```
GET /api/notifications            - Get user notifications
GET /api/notifications/count      - Get unread notification count
PUT /api/notifications/:id/read   - Mark notification as read
PUT /api/notifications/read-all   - Mark all notifications as read
```

### System Endpoints
```
GET /api/health                   - Health check
GET /api/test                     - API test endpoint
GET /api/debug/endpoints          - List all available endpoints
```

## User Experience Features

### First-Time Admin Onboarding (New - 2025-08-08)

Guardian MVP provides a guided onboarding experience for first-time administrators to help them get started with workflow template creation:

#### Automatic Detection
- **Admin Role Detection**: Automatically identifies users with Admin (role ID 1) or Super Admin (role ID 6) permissions
- **Template Check**: Checks for existing form templates using company-based data isolation (COMPANY_ID filtering)
- **First-Time Experience**: Triggers guided setup when no company templates exist

#### Guided Workflow Creation
- **Wizard Modal**: Uses the familiar NewRequestModal component as a step-by-step form creation wizard
- **Template Types**: Offers three primary form types:
  - **Requests**: Standard request fulfillment forms
  - **Self-Service**: Self-service user forms
  - **Notice**: Notification and announcement forms
- **Progressive Setup**: Guides users through: Select Type → Create Title → Build Form Fields

#### Key Benefits
- **Reduced Complexity**: Replaces advanced WorkflowManagementModal with simpler guided experience
- **Company Isolation**: Maintains security with proper company-based data filtering
- **TypeScript Safety**: Implements proper typing without type assertions
- **Seamless Integration**: Works with existing form service infrastructure

#### Technical Implementation
- **Form Service Integration**: Updated formService.ts with COMPANY_ID support for proper data filtering
- **Database Schema**: Updated DbForm interface to include COMPANY_ID field
- **Security**: All operations filtered by user's company ID for multi-tenant security

## Installation & Setup

### Prerequisites
- Node.js 18+
- A PostgreSQL database (Docker Postgres locally; Neon in production)
- Resend API key for email services

### Environment Configuration

`DATABASE_URL` is a PostgreSQL connection string. Keep the
`connection_limit=30&pool_timeout=20` params (Prisma's default pool is too small).
Use placeholders for credentials — never commit real passwords.

#### `.env.development` (local Docker Postgres)
```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5433/guardian?schema=GUARDIAN&connection_limit=30&pool_timeout=20"
JWT_SECRET="your-jwt-secret-key"
SMTP_PASSWORD="your-resend-api-key"
EMAIL_FROM="support@yourdomain.com"
```

#### `.env.production` (Neon / Netlify DB)
```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/netlifydb?sslmode=require&schema=GUARDIAN&connection_limit=30&pool_timeout=20"
JWT_SECRET="your-production-jwt-secret"
SMTP_PASSWORD="your-resend-api-key"
EMAIL_FROM="support@yourdomain.com"
```

### Installation Steps

1. **Clone Repository**
   ```bash
   git clone <repository-url>
   cd "Guardian MVP"
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```
   On a fresh / `--ignore-scripts` checkout, also run `npx prisma generate`.

3. **Generate Prisma Client**
   ```bash
   npx prisma generate
   ```
   The database schema is owned by `postgres/01_schema.sql` + `02_seed.sql` +
   `03_app_schema_patches.sql` (no Prisma `migrate`/`db push`).

4. **Build Application**
   ```bash
   npm run build         # Frontend (Vite) -> dist/
   npm run build:server  # Backend (TypeScript) -> dist-server/
   ```

## Development

### Development Commands

**Start Development Environment:**
```bash
# API + frontend together (against local Docker Postgres)
npm run dev:pg

# Or run them separately (in separate terminals):
npm run server:dev:pg   # TS backend against local Docker Postgres (localhost:5433)
npm run dev             # Vite frontend (proxies API calls to the backend)
```

**Database Management:**
```bash
# Generate Prisma client
npx prisma generate
```
The DB schema is owned by `postgres/01_schema.sql` + `02_seed.sql` +
`03_app_schema_patches.sql` (no Prisma `migrate`/`db push`).

**Build / run the server:**
```bash
npm run build:server          # compile server/index.ts -> dist-server/index.js
node dist-server/index.js     # run the compiled server
```

**Testing:**
```bash
bun test       # Run tests
npm run lint   # Lint code
```

### Development Workflow

1. **Frontend Development**: Use `npm run dev` for hot-reload development
2. **Backend Development**: Use `npm run server:dev:pg` for API development
3. **API Endpoints**: Add/edit routes under `server/routes/*.ts`, mounted in `server/index.ts`
4. **Testing**: Run `bun test` before committing changes

### Important Development Notes

- **Single backend**: The TypeScript Express server (`server/index.ts` → `dist-server/index.js`) is the only backend; there are no separate dev/prod server files
- **Database**: PostgreSQL — Neon (`netlifydb`, `GUARDIAN` schema) in production, Docker Postgres (`localhost:5433`) locally
- **DATABASE_URL**: PostgreSQL string; keep `connection_limit=30&pool_timeout=20`; never commit real passwords
- **Prisma is a client only**: schema owned by `postgres/*.sql` (no `migrate`/`db push`)
- **Frontend/Backend Communication**: Vite proxy routes API calls from port 5175 to 3001
- **Neon cold starts**: the `dbWakeUp` overlay covers the first-request wake-up — expected behavior

## Production Deployment

> **Azure was fully retired on 2026-06-08.** The DevOps pipeline, IIS, web.config,
> `package.production.json`, and the legacy CommonJS servers were deleted.

The stack now deploys as:

- **Frontend (Netlify)**: Vite static build (`dist/`) deployed to Netlify (site `guardian-mvp`), auto-deploying from `github.com/ErnestPenaJr/Guardian` on push. Config in `netlify.toml` (`npm run build`, publish `dist`, SPA redirect, `NPM_FLAGS=--ignore-scripts`).
- **Backend (off-Netlify TS server)**: compile with `npm run build:server` and run `node dist-server/index.js` on the chosen host (host TBD). Set the frontend's API base URL to point at it.
- **Database (Neon)**: PostgreSQL via Netlify DB (`netlifydb`, `GUARDIAN` schema).

**Required environment variables:**
```
DATABASE_URL=<postgresql://...?schema=GUARDIAN&connection_limit=30&pool_timeout=20>
JWT_SECRET=<secure-jwt-secret>
SMTP_PASSWORD=<resend-api-key>
EMAIL_FROM=<production-email>
```

See `DEPLOYMENT.md` for full step-by-step deploy details.

## Troubleshooting

### Common Issues

#### Database Connection Errors
**Symptom**: Prisma can't connect to the database, login fails

**Solutions**:
1. Verify `DATABASE_URL` points at a running Postgres and includes `?schema=GUARDIAN&connection_limit=30&pool_timeout=20`
2. For local dev, ensure the Docker Postgres at `localhost:5433` is up, then start with `npm run server:dev:pg` (or `npm run dev:pg`)
3. For production, confirm the Neon (`netlifydb`) connection string and `sslmode=require`
4. Use placeholders for credentials — never commit real passwords:
   ```
   DATABASE_URL="postgresql://USER:PASSWORD@localhost:5433/guardian?schema=GUARDIAN&connection_limit=30&pool_timeout=20"
   ```

> **Neon cold starts**: Neon may sleep an idle database; the `dbWakeUp` overlay covers the first-request wake-up. This is expected — do not remove it.

#### Form Template Creation Issues
**Symptom**: Form creation fails with server errors in SimpleFormBuilder

**Root Causes & Solutions**:
- ✅ **JWT Authentication**: Correct `req.user` company/user resolution
- ✅ **Company Isolation**: Proper COMPANY_ID filtering for multi-tenant security
- ✅ **Port Configuration**: Stabilized frontend-backend communication (5175 ↔ 3001)

**Verification Steps**:
1. Check server logs for a successful database connection
2. Test form creation through the SimpleFormBuilder interface
3. Verify templates are saved to the `GUARDIAN.FORMS` table

#### Email Service Issues
**Symptom**: Verification emails not being sent

**Solutions**:
1. Verify Resend API key is correct
2. Check FROM_EMAIL domain verification
3. Review email logs in application output
4. Ensure SMTP_PASSWORD environment variable is set

#### Frontend Build Errors
**Symptom**: Build fails with TypeScript errors

**Solutions**:
1. Run `bun run lint` to identify issues
2. Check TypeScript configuration
3. Verify all imports are correct
4. Clear node_modules and reinstall dependencies

### Performance Optimization

#### Database Queries
- Use company-filtered queries with proper indexing
- Implement pagination for large datasets  
- Use raw SQL for complex queries when needed
- Monitor query performance with PostgreSQL tooling (e.g. `EXPLAIN ANALYZE`, Neon metrics)

#### Frontend Performance
- Implement lazy loading for routes
- Use React.memo for expensive components
- Optimize bundle size with tree shaking
- Use AG Grid virtualization for large datasets

#### Memory Management
- Production server uses memory-based verification storage
- Implement proper cleanup for temporary data
- Monitor memory usage in production
- Use connection pooling for database access

## Contributing

### Code Standards
- **TypeScript**: Use strict type checking
- **ESLint**: Follow configured linting rules  
- **Naming**: Use descriptive variable and function names
- **Comments**: Document complex business logic
- **Testing**: Write tests for new features

### Git Workflow
1. Create feature branch from `main`
2. Make changes with descriptive commits
3. Update documentation if needed
4. Test locally before pushing
5. Create pull request with description
6. Push to `github.com/ErnestPenaJr/Guardian` (Netlify deploys the frontend on push)

### Database Changes
1. Update the `postgres/*.sql` schema files (the DB is owned by these, not Prisma migrations)
2. Apply them to the target database, then run `npx prisma generate` to refresh the client
3. Document schema changes
4. Update API endpoints (`server/routes/*.ts`) if needed

## Security Considerations

### Data Protection
- All data is company-isolated by default
- JWT tokens include company ID for verification
- Passwords are hashed with bcrypt
- Sensitive data is not logged

### API Security
- Rate limiting on authentication endpoints
- Input validation and sanitization
- SQL injection prevention with Prisma
- CORS configuration for production

### User Privacy
- Email verification required for accounts
- Secure password reset flows
- Optional data retention policies
- Audit trails for user actions

## License

This project is proprietary software. All rights reserved.

## Support

For technical support or questions:
- Check the troubleshooting section above
- Review the API documentation in CLAUDE.md
- Contact the development team
- Submit issues through the appropriate channels

---

---

## Key Components (Updated 2025-08-07)

### Task Management System
- **TaskTable.tsx**: AG Grid-based task display with multi-select, filtering, and export
- **AddTaskModal.tsx**: Task creation modal with user assignment and validation
- **Task Status Management**: Flexible status transitions with confirmation dialogs
- **Batch Operations**: Multi-select task operations (Start, Complete, Cancel)
- **Export Functionality**: CSV and Excel export capabilities
- **Notification Integration**: Auto-notification system for task assignments

### Request Processing Workflow
- **Work Progress Modal**: 4-tab interface (Details, Form, Progress, Tasks)
- **RequestFulfillmentDashboard.tsx**: Enhanced with task management integration
- **Company Isolation**: All operations filtered by user's company for security
- **Role-Based Access**: Processor, Manager, User, and Admin role permissions

## Recent Enhancements (2025-08-08)

### Authentication & Security Improvements
- **Enhanced Email Validation**: Implemented security-hardened email validation with:
  - 125 character maximum length limit
  - Client-side rate limiting (5 attempts, 15-minute lockout)
  - Generic error messages to prevent user enumeration vulnerabilities
  - Updated validation across all 3 server environments
- **Improved Password Reset Flow**: Streamlined user experience with:
  - Direct navigation from email request to verification form
  - Enhanced resend functionality that generates new codes and resets countdown
  - Removed unnecessary success modal steps for faster workflow

### First-Time Admin Experience
- **Guided Template Creation**: New first-time admin detection and onboarding:
  - Automatic identification of admins without existing form templates
  - Guided wizard using familiar NewRequestModal interface
  - Company-based template filtering for proper multi-tenant security
  - Step-by-step form creation: Type Selection → Title → Field Building
- **Form Service Enhancements**: Updated database integration:
  - Added COMPANY_ID field to DbForm interface for proper data isolation
  - Enhanced form filtering logic using company-based queries
  - Maintained backward compatibility with existing form management

### Security & Data Protection
- **Company-Based Data Isolation**: Enhanced security measures:
  - All form template operations filtered by user's company ID
  - Proper TypeScript typing without unsafe type assertions
  - Multi-tenant architecture ensures cross-company data protection
- **Anti-Enumeration Protection**: Generic error messages prevent user account discovery
- **Rate Limiting**: Client-side protection against brute force login attempts

## Recent Critical Fixes (2025-08-12)

### SimpleFormBuilder Database Integration - RESOLVED
- ✅ **POST /api/forms Endpoint**: Fixed critical server-side issues preventing form template creation
- ✅ **SQL Server Compatibility**: Resolved parameterized query syntax errors across all server environments
- ✅ **Database Schema Integration**: Enhanced form-field relationship management through GUARDIAN.FORMS_FIELDS junction table
- ✅ **JWT Authentication**: Fixed middleware property access issues for proper user identification
- ✅ **Company Isolation**: Proper COMPANY_ID vs ORGANIZATION_ID usage for multi-tenant security
- ✅ **Development Stability**: Standardized port configuration (frontend: 5175, backend: 3001) with explicit DATABASE_URL requirement
- ✅ **Multi-Server Synchronization**: All three server files (server.cjs, server-production.js, server.js) updated with fixes

### Technical Architecture Improvements
- ✅ **Database Connection**: Resolved authentication issues with explicit environment variable configuration
- ✅ **Form Template Storage**: Properly implemented GUARDIAN.FORMS table integration with company-based isolation
- ✅ **SQL Injection Prevention**: Enhanced security with proper string escaping and parameterized queries
- ✅ **Error Handling**: Comprehensive error logging and fallback mechanisms for form creation failures

---

---

## Recent Critical Updates (2025-08-21)

> **Superseded (2026-06-08):** the Azure/CommonJS work below is historical.
> Azure was fully retired on 2026-06-08 — the app now runs on Netlify (frontend)
> + a TypeScript Express server on PostgreSQL/Neon. See `DEPLOYMENT.md`.

### CRITICAL PRODUCTION SERVER RESTORATION - SUCCESSFUL
- ✅ **Production Server Fully Operational**: Resolved critical server startup failures and 500 errors on basic API endpoints
- ✅ **ES Module/CommonJS Issue Resolved**: Fixed Node.js production runtime compatibility by enforcing CommonJS module system  
- ✅ **Foundation Methodology Established**: Created proven deployment approach using exact copy of working development server
- ✅ **Emergency Recovery Protocol**: Documented comprehensive recovery process for future production server failures
- ✅ **Deployment Best Practices**: Implemented strict guidelines preventing over-engineering and preserving working configurations

### Technical Resolution Achievements
- ✅ **Root Cause Analysis**: ES Module vs CommonJS incompatibility in Node.js v20.18.3 production environment
- ✅ **Working Configuration**: `package.production.json` enforces CommonJS, Express static serving, SPA routing support
- ✅ **API Logic Preservation**: Maintained identical authentication, JWT, and endpoint functionality from development server
- ✅ **Testing Protocol**: Established mandatory `node server.js` local testing requirement before Azure deployment

---

**Last Updated**: 2026-06-08  
**Version**: 2.5.0  
**Node.js Compatibility**: 18+  
**Database**: PostgreSQL (Neon in production, Docker Postgres locally)  
**Deployment**: Netlify (frontend) + off-Netlify TypeScript Express server + Neon (Azure retired 2026-06-08; see `DEPLOYMENT.md`)
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
- **Runtime**: Node.js with Express.js framework
- **Database**: Microsoft SQL Server with Prisma ORM
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
- **Package Manager**: Bun (preferred) or npm
- **Type Checking**: TypeScript with strict configuration
- **Linting**: ESLint with React-specific rules
- **Testing**: Bun test framework
- **Database**: Prisma for schema management and queries

## Architecture

### Multi-Environment Setup

Guardian MVP uses a sophisticated multi-environment architecture:

#### Development Environment (`server.cjs`)
- Full-featured development server with comprehensive authentication
- Static file serving via Express
- Database-backed email verification storage
- Complete registration/authentication flow
- SPA fallback routing for React Router
- Runs on port 3001 (backend) with Vite dev server on 5175 (frontend)

#### Production Environment (`server-production.js` → `server.js`)
- Production-optimized server for Azure App Service deployment
- No static file serving (handled by IIS via web.config)
- Memory-based verification storage for production simplicity
- Identical API endpoints to development
- Optimized for IIS deployment with web.config routing

### Database Schema

The application uses a comprehensive SQL Server schema:

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
- Node.js 18+ (or Bun runtime)
- Microsoft SQL Server access
- Resend API key for email services

### Environment Configuration

Create environment files for different environments:

#### `.env.development`
```env
DATABASE_URL="sqlserver://server:1433;database=GUARDIAN-DEV;user=username;password=password;encrypt=true;trustServerCertificate=false"
JWT_SECRET="your-jwt-secret-key"
SMTP_PASSWORD="your-resend-api-key"
EMAIL_FROM="support@yourdomain.com"
```

#### `.env.production`  
```env
DATABASE_URL="sqlserver://production-server:1433;database=GUARDIAN-PROD;user=username;password=password;encrypt=true;trustServerCertificate=false"
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

2. **Install Dependencies** (using Bun - preferred)
   ```bash
   bun install
   ```
   
   Or with npm:
   ```bash
   npm install
   ```

3. **Setup Database**
   ```bash
   # Generate Prisma client
   bun prisma generate
   
   # Populate field types (if needed)
   bun populate-field-types
   ```

4. **Build Application**
   ```bash
   # Build everything
   bun run build:all
   
   # Or build separately
   bun run build        # Frontend only
   bun run build:server # Backend only
   ```

## Development

### Development Commands

**Start Development Environment:**
```bash
# Backend server (development)
bun server.cjs

# Frontend development server
bun run dev

# Both simultaneously (in separate terminals)
bun run backend    # Backend on port 3001
bun run dev        # Frontend on port 5175
```

**Database Management:**
```bash
# Generate Prisma client
bun prisma generate

# Add standard templates
bun add-templates

# Populate field types
bun populate-field-types
```

**Testing:**
```bash
# Run tests
bun test

# Lint code
bun run lint
```

### Development Workflow

1. **Frontend Development**: Use `bun run dev` for hot-reload development
2. **Backend Development**: Use `bun server.cjs` for API development
3. **Database Changes**: Update Prisma schema and run `bun prisma generate`
4. **Testing**: Run `bun test` before committing changes

### Important Development Notes

- **Database Password Escaping**: Special characters like `$` must be escaped as `\$` in .env files
- **Frontend/Backend Communication**: Vite proxy routes API calls from port 5175 to 3001
- **File Synchronization**: Always update `server-production.js` when modifying API endpoints

## Production Deployment

### Azure App Service Deployment

The application uses Azure DevOps pipelines for automated deployment:

#### Critical Pipeline Configuration
```yaml
# azure-pipelines.yml line 52
cp server-production.js deployment/server.js
```

**File Mapping:**
- **Development**: `server.cjs` (local development)
- **Production Source**: `server-production.js` (source file with all endpoints)
- **Production Deployed**: `server.js` (deployed to Azure)

#### Deployment Checklist

1. **Update All Server Files**: When adding/modifying API endpoints, update:
   - ✅ `server.cjs` (development)
   - ✅ `server-production.js` (production source)
   - ✅ `server.js` (local production testing)

2. **Environment Variables**: Configure in Azure App Service:
   ```
   DATABASE_URL=<production-connection-string>
   JWT_SECRET=<secure-jwt-secret>
   SMTP_PASSWORD=<resend-api-key>
   EMAIL_FROM=<production-email>
   ```

3. **Web.config**: Ensure proper IIS configuration for:
   - Static file serving
   - SPA routing
   - API proxying

4. **Verification**: Test endpoints at production URL after deployment

### Manual Deployment

For manual deployment to other environments:

```bash
# Build for production
bun run build:all

# Copy files to deployment directory
cp -r dist/ deployment/
cp server-production.js deployment/server.js
cp web.config deployment/
cp package.json deployment/

# Install production dependencies
cd deployment
npm install --production
```

## Troubleshooting

### Common Issues

#### Database Connection Errors
**Symptom**: "Authentication failed against database server"

**Solutions**:
1. Verify connection string format
2. Escape special characters in passwords (`$` → `\$`)
3. Check firewall and network connectivity
4. Use explicit DATABASE_URL when starting server:
   ```bash
   DATABASE_URL="your-connection-string" bun server.cjs
   ```

#### Production Endpoint 404 Errors
**Symptom**: "Endpoints work locally but return 404 in production"

**Cause**: Updated `server.js` but not `server-production.js`

**Fix**:
```bash
cp server.js server-production.js
git add server-production.js
git commit -m "sync: update server-production.js with latest endpoints"
git push origin main
```

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
- Monitor query performance with SQL Server tools

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
6. Ensure CI/CD pipeline passes

### Database Changes
1. Update Prisma schema files
2. Generate new Prisma client
3. Test migrations locally
4. Document schema changes
5. Update API endpoints if needed

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

---

**Last Updated**: 2025-08-08  
**Version**: 2.5.0  
**Node.js Compatibility**: 18+  
**Database**: Microsoft SQL Server  
**Deployment**: Azure App Service with IIS
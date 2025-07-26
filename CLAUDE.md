# Guardian MVP - Project Documentation

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
- `GET /api/field-types` - Get field types
- `GET /api/roles` - Get roles

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
- `GUARDIAN.USERS` - User accounts with company association
- `GUARDIAN.REQUESTS` - Requests with company filtering
- `GUARDIAN.ROLES` - User roles and permissions
- `GUARDIAN.INVITES` - Invitation system
- `GUARDIAN.FORMS` - Form templates (by ORGANIZATION_ID)
- `GUARDIAN.FIELDS` - Form fields (by ORGANIZATION_ID)
- `GUARDIAN.FIELD_TYPE` - Field type definitions
- `GUARDIAN.NOTIFICATIONS` - User notifications with read tracking (Added 2025-07-26)

## Development Commands

**Development Server:**
```bash
# Standard way (may have database connection issues)
bun server.cjs  # or node server.cjs

# IMPORTANT: Password character escaping required (Fixed 2025-07-26)
# The $ character in passwords must be escaped as \$ in .env files
# Correct format in .env.development:
DATABASE_URL="sqlserver://guardian-dev-db.database.windows.net:1433;database=GUARDIAN-DEV;user=GUARDIAN;password=Sh13ldlyt1c\$;encrypt=true;trustServerCertificate=false;schema=GUARDIAN"
```

**Production Testing:**
```bash
bun server.js  # or node server.js
```

**Frontend Development:**
```bash
bun run dev  # Start Vite dev server
```

**Build for Production:**
```bash
bun run build  # Build React app to dist/
```

## Important Notes

1. **Never confuse the environments** - `server.cjs` is for development, `server.js` is for production
2. **Company isolation is critical** - All user data must be filtered by company ID
3. **Both servers have identical API endpoints** - Only the implementation details differ
4. **Production uses IIS** - Static file serving and SPA routing handled by web.config
5. **Development uses full Express** - Includes static serving and SPA fallback
6. **Database connection fix** - If development server has database connection issues, explicitly set DATABASE_URL when starting

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

- **Backend:** Node.js/Bun with Express
- **Database:** SQL Server with Prisma ORM
- **Frontend:** React + TypeScript + Vite
- **Authentication:** JWT tokens
- **Email:** Resend API (development)
- **Deployment:** IIS (production)
- **Styling:** Tailwind CSS + Bootstrap

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

## Recent Fixes (2025-07-26)

### Notification System Implementation
- ✅ **Added complete notification system** for user assignments
- ✅ **Database schema**: Added `GUARDIAN.NOTIFICATIONS` table with `READ_DATE` column
- ✅ **API endpoints**: Full CRUD operations for notifications
- ✅ **Frontend component**: `NotificationDropdown.tsx` with real-time updates
- ✅ **Integration**: Notifications created automatically when requests are assigned

### Database Connection Issues Resolved
- ✅ **Password escaping fix**: Special characters (`$`) in passwords must be escaped as `\$` in .env files
- ✅ **Environment variable loading**: Fixed Bun environment variable processing
- ✅ **Connection string format**: Verified correct Azure SQL connection parameters

### Admin Role Support
- ✅ **Role-based access**: Users with role IDs 1,3,4,6 can see all company data
- ✅ **Form instance access**: Admin users can access all form instances
- ✅ **Enhanced authentication**: Middleware now includes user roles in JWT tokens

### API Completeness
- ✅ **Added missing endpoints**: POST /api/invites across all server files
- ✅ **Request modal fixes**: User dropdown API response parsing corrected
- ✅ **Prisma query fixes**: Replaced invalid `prisma.Prisma.raw` with `prisma.$queryRawUnsafe`

### Production Deployment Sync
- ✅ **Server file synchronization**: All endpoints added to development, production, and production-source files
- ✅ **Pipeline compatibility**: Changes applied to `server-production.js` for proper Azure deployment
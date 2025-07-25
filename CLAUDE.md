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

## Development Commands

**Development Server:**
```bash
bun server.cjs  # or node server.cjs
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

## Deployment

### Development
- Run `server.cjs` locally
- Static files served by Express
- Email service requires Resend API key

### Production
- Deploy `server.js` to IIS
- Configure web.config for static files and SPA routing
- Ensure database connection string is configured
- JWT_SECRET environment variable required

## Technology Stack

- **Backend:** Node.js/Bun with Express
- **Database:** SQL Server with Prisma ORM
- **Frontend:** React + TypeScript + Vite
- **Authentication:** JWT tokens
- **Email:** Resend API (development)
- **Deployment:** IIS (production)
- **Styling:** Tailwind CSS + Bootstrap
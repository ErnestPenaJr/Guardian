# Guardian MVP - Windsurf Development Rules

## Core Development Principles

### 1. Company-Based Data Isolation (CRITICAL)
- **ABSOLUTE REQUIREMENT**: Every database query MUST include company-based filtering
- **Pattern**: Always use `WHERE COMPANY_ID = ${req.companyId}` in all queries
- **Security**: Cross-company data access is STRICTLY FORBIDDEN
- **Middleware**: Use `getAuthenticatedUserCompany` for all protected endpoints

### 2. Single TypeScript Server (Postgres)
- **One backend**: the TypeScript Express server `server/index.ts`, compiled to `dist-server/index.js` and started with `node dist-server/index.js` (build via `npm run build:server`).
- **Routes**: new API endpoints live in `server/routes/*.ts` and are mounted in `server/index.ts`. There is no "three-server" / multi-server-sync concept — the legacy CommonJS monolith (`server.cjs`/`server.js`/`server-production.js`) has been removed.
- **Database**: PostgreSQL. Production is Neon (Netlify DB, database `netlifydb`, `GUARDIAN` schema); local dev is Docker Postgres at `localhost:5433`.
- **Deployment**: the React/Vite frontend deploys to Netlify from GitHub on push (Azure DevOps is retired). See `DEPLOYMENT.md` for full deployment details.

### 3. Specialized Agent Patterns
Use specialized approaches for different development areas:

#### Frontend Development
- **React Components**: Use modern hooks, functional components, TypeScript interfaces
- **Styling**: Tailwind CSS utility-first approach with responsive design
- **UI Components**: Leverage existing patterns from Guardian MVP components
- **Accessibility**: WCAG 2.1 AA compliance for government applications

#### Backend API Development
- **Company Isolation**: All endpoints must filter by user's company ID
- **Authentication**: JWT tokens with `getAuthenticatedUserCompany` middleware
- **Error Handling**: Consistent response formats with proper logging
- **Database Queries**: Use Prisma ORM with company-based filtering

#### Security & Authentication
- **JWT Structure**: Include userId, companyId, roleId in token payload
- **Role-Based Access**: Implement proper role checking for all endpoints
- **Input Validation**: Sanitize all user inputs to prevent XSS/SQL injection
- **Password Security**: Use bcrypt with high salt rounds (12+)

#### Database Operations
- **Prisma ORM**: Primary database interaction method (client only — the DB schema is owned by `postgres/*.sql`)
- **PostgreSQL**: GUARDIAN schema (Neon in production, Docker Postgres at `localhost:5433` for local dev)
- **Company Filtering**: Every query must include `COMPANY_ID = ${req.companyId}`
- **Transactions**: Use Prisma transactions for complex operations

## API Endpoint Standards

### Protected Endpoint Pattern
```javascript
app.get('/api/endpoint', getAuthenticatedUserCompany, async (req, res) => {
  try {
    const data = await prisma.$queryRaw`
      SELECT * FROM GUARDIAN.TABLE 
      WHERE COMPANY_ID = ${req.companyId}
    `;
    res.json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### Company Data Isolation Enforcement
```javascript
// CORRECT - Company filtering
const users = await prisma.uSERS.findMany({
  where: { COMPANY_ID: req.companyId }
});

// WRONG - No company filtering (NEVER DO THIS)
const allUsers = await prisma.uSERS.findMany(); // Exposes all companies!
```

## Security Requirements

### Authentication Middleware
```javascript
const getAuthenticatedUserCompany = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.companyId = decoded.companyId;
    req.roleId = decoded.roleId;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

### Role-Based Access Control
- **Super Admin (6)**: Full system access across all companies
- **Admin (1)**: Full company access and management
- **Manager (3)**: Team oversight and request assignment
- **Processor (4)**: Process and work on assigned requests
- **User (2)**: Submit and view their own requests
- **External User**: Read-only access to assigned items

## Development Environment Configuration

### Backend Server Setup
```bash
# API + Vite together (recommended) — builds the TS server and runs it against local Docker Postgres,
# alongside the Vite dev server
npm run dev:pg

# Or run them separately:
npm run server:dev:pg   # builds + starts dist-server/index.js on port 3001 (local Postgres)
npm run dev             # Vite frontend (port 5175) with proxy to the API

# DATABASE_URL is a postgresql:// connection string (NOT sqlserver://). Example placeholder:
# DATABASE_URL="postgresql://USER:PASSWORD@HOST/DB?schema=GUARDIAN&connection_limit=30&pool_timeout=20"
```

### Production Deployment Rules
- **Single server**: build the TS server with `npm run build:server`, run with `node dist-server/index.js`.
- **Frontend**: React/Vite static bundle deployed to Netlify from GitHub on push.
- **Database**: production PostgreSQL on Neon (Netlify DB); configure `DATABASE_URL` and `JWT_SECRET` in the host environment.
- **Details**: see `DEPLOYMENT.md`.

## Task Management Workflow

### Task Creation and Status Management
- **Status Flow**: Pending → In Progress → Completed (or direct Pending → Completed)
- **Auto-Assignment**: Tasks can assign to current user when started
- **Tracking IDs**: Auto-generated format: TSK-{timestamp}-{random}
- **Notifications**: Automatic creation for task assignments
- **Company Isolation**: All task operations filtered by company

### Request Processing Workflow
- **Details Tab**: Request information and action buttons (Assign, Start, Complete, Cancel)
- **Form Tab**: Form data and field values
- **Progress Tab**: Status updates and completion tracking
- **Tasks Tab**: Comprehensive task management interface

## UI/UX Component Standards

### Action Button Visibility Rules
- **Assign Button**: Show for users with assignment permissions
- **Start Button**: Show for pending requests when user has permission
- **Complete Button**: Show for active requests when user can work on them
- **Cancel Button**: Show for pending/active requests for authorized users
- **Super Admin Override**: Users with role_id 6 see all buttons regardless of conditions

### Component Architecture
- **React Functional Components**: Use hooks and modern patterns
- **TypeScript Interfaces**: Strong typing for all props and state
- **Bootstrap UI**: Consistent modal and form patterns
- **AG Grid**: For data tables with sorting, filtering, export functionality
- **Responsive Design**: Mobile-first approach with Tailwind CSS

## Database Schema and Operations

### Key Tables
- `GUARDIAN.USERS` - User accounts with company association
- `GUARDIAN.REQUESTS` - Requests with company filtering
- `GUARDIAN.TASKS` - Tasks with request association  
- `GUARDIAN.FORMS` - Form templates with company isolation
- `GUARDIAN.NOTIFICATIONS` - User notifications with read tracking
- `GUARDIAN.COMPANY` - Company information and organization data

### Query Patterns
```javascript
// Standard company-filtered query
const requests = await prisma.$queryRaw`
  SELECT * FROM GUARDIAN.REQUESTS 
  WHERE COMPANY_ID = ${req.companyId}
  ORDER BY CREATED_DATE DESC
`;

// Update with company verification
await prisma.$executeRaw`
  UPDATE GUARDIAN.REQUESTS 
  SET STATUS = ${newStatus}
  WHERE REQUEST_ID = ${requestId} AND COMPANY_ID = ${req.companyId}
`;
```

## Email and Notification System

### Email Integration (Resend API)
- **Transactional Emails**: Verification, assignments, notifications
- **Email Templates**: Professional HTML templates for all email types
- **Company Isolation**: Email notifications filtered by company
- **Notification Persistence**: Database storage with read tracking

### Notification Creation
```javascript
await prisma.$executeRaw`
  INSERT INTO GUARDIAN.NOTIFICATIONS (
    USER_ID, TYPE, TITLE, MESSAGE, RELATED_ID, 
    COMPANY_ID, CREATED_DATE, IS_READ
  ) VALUES (
    ${assignedUserId}, 'assignment', 'New Request Assigned',
    ${notificationMessage}, ${requestId}, ${req.companyId},
    NOW(), 0
  )
`;
```

## Testing and Quality Assurance

### Pre-Deployment Checklist
1. ✅ Company-based data isolation implemented
2. ✅ TypeScript compilation successful (`tsc --noEmit`)
3. ✅ Linting passes (`npm run lint`)
4. ✅ Database connectivity verified (Postgres)
5. ✅ JWT authentication working
6. ✅ API endpoints returning correct data
7. ✅ Frontend components render properly
8. ✅ TS server builds and runs locally (`npm run build:server` + `node dist-server/index.js`)

### Testing Commands
```bash
# Type checking
tsc --noEmit

# Linting
npm run lint

# Run API + frontend together (local Postgres)
npm run dev:pg

# Build the TS server
npm run build:server

# Run the built server locally
node dist-server/index.js

# Test frontend only
npm run dev

# Build everything for production
npm run build:all
```

## Error Handling Standards

### API Error Responses
```javascript
try {
  // Database operation
  const result = await prisma.operation();
  res.json(result);
} catch (error) {
  console.error(`[${new Date().toISOString()}] API Error:`, error);
  res.status(500).json({ 
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
}
```

### Frontend Error Handling
- **Toast Notifications**: Use react-toastify for user feedback
- **Loading States**: Show loading indicators during API calls
- **Error Boundaries**: Implement React error boundaries for component errors
- **Validation**: Client-side validation with server-side verification

## Performance and Optimization

### Database Query Optimization
- **Indexed Queries**: Ensure COMPANY_ID columns are indexed
- **Query Limiting**: Use LIMIT/TOP for large result sets
- **Connection Pooling**: Leverage Prisma connection pooling
- **Raw Queries**: Use `$queryRaw` for complex operations when needed

### Frontend Performance
- **Component Memoization**: Use React.memo for expensive components
- **Lazy Loading**: Implement code splitting for large components
- **Bundle Optimization**: Monitor and optimize bundle size
- **Responsive Images**: Optimize image loading and sizing

## Deployment Architecture

### Netlify + Neon (Postgres)
- **Frontend**: React/Vite static bundle deployed to Netlify from GitHub on push.
- **Backend**: single TypeScript Express server (`server/index.ts` → `dist-server/index.js`), run with `node dist-server/index.js` after `npm run build:server`.
- **Database**: PostgreSQL on Neon (Netlify DB, database `netlifydb`, `GUARDIAN` schema). Schema is owned by `postgres/*.sql`; Prisma is a client only.
- **Environment Variables**: `JWT_SECRET` and a `postgresql://` `DATABASE_URL` configured in the host environment.
- **Details**: see `DEPLOYMENT.md`.

### Critical Deployment Rules
- ✅ **ALWAYS build** the TS server (`npm run build:server`) before deploying the backend.
- ✅ **ALWAYS test** locally with `node dist-server/index.js` against local Postgres first.
- ✅ **ALWAYS verify** endpoints after deployment.
- ✅ **ALWAYS keep** `DATABASE_URL` as a `postgresql://` string with `connection_limit=30&pool_timeout=20`.

## Emergency Response Protocols

### Security Incidents
1. **Rotate JWT Secret**: Invalidate all tokens immediately
2. **Audit Data Access**: Check for unauthorized cross-company access
3. **Force Re-authentication**: Require all users to log in again
4. **Review Logs**: Analyze access patterns for anomalies

## Form Builder and Field Management

### Form Template Creation
- **Company Isolation**: Forms filtered by COMPANY_ID
- **Field Types**: Support for text, email, address, banking, specialized fields
- **Validation**: Client and server-side field validation
- **Template Types**: Requests, Self-Service, Notice templates

### Dynamic Form Generation
```javascript
// Company-filtered form retrieval
const forms = await prisma.$queryRaw`
  SELECT * FROM GUARDIAN.FORMS 
  WHERE COMPANY_ID = ${req.companyId} OR COMPANY_ID IS NULL
  ORDER BY CREATED_DATE DESC
`;
```

## Code Organization and Best Practices

### File Structure Standards
- **Components**: Organized by feature in src/components/
- **Services**: API calls and business logic in src/services/
- **Types**: TypeScript interfaces in src/types/
- **Utilities**: Helper functions in src/utils/

### Naming Conventions
- **Components**: PascalCase (e.g., RequestModal.tsx)
- **Files**: camelCase for utilities, PascalCase for components
- **Variables**: camelCase for JavaScript/TypeScript
- **Database**: UPPER_CASE for Postgres columns in the GUARDIAN schema (COMPANY_ID, USER_ID)

### Documentation Requirements
- **Code Comments**: JSDoc for complex functions
- **README Updates**: Keep project documentation current
- **API Documentation**: Document all endpoint changes
- **Component Documentation**: Document prop interfaces and usage

## Integration Points

### Frontend-Backend Communication
- **API Base URL**: Proxy configuration for development
- **Authentication Headers**: Include Bearer token in all requests
- **Error Handling**: Consistent error response parsing
- **Loading States**: Show appropriate loading indicators

### Third-Party Integrations
- **Resend API**: Email service integration with proper error handling
- **PostgreSQL (Neon / Docker)**: Database connection with retry logic
- **JWT**: Secure token generation and validation
- **Prisma ORM**: Database abstraction with type safety (client only)

This comprehensive set of rules ensures consistent development practices across the Guardian MVP project, maintaining security, performance, and code quality standards while following the established architectural patterns.
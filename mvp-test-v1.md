# Guardian MVP - Test User Feature Validation Checklist

## 🔐 **Authentication & User Management**

**Login & Registration**
- [ ] User registration with email validation (SendGrid integration)
- [ ] Email verification process after registration
- [ ] Login with email/password authentication
- [ ] Password reset flow (forgot password → email verification → reset)
- [ ] JWT token-based session management
- [ ] Logout functionality with confirmation

**User Roles & Permissions** (Test with different role accounts)
- [ ] **Administrator (role_id: 1)** - Full system access
- [ ] **General User (role_id: 2)** - Standard user access
- [ ] **Manager (role_id: 3)** - Request assignment and oversight
- [ ] **Processor (role_id: 4)** - Request processing capabilities
- [ ] **External User (role_id: 5)** - Limited external access
- [ ] **JAFAR Developer (role_id: 6)** - Enhanced admin + developer tools

## 🏠 **Dashboard & Navigation**

**Home Dashboard**
- [ ] Role-based dashboard display (different views per role)
- [ ] Request statistics and charts (Pie chart with status breakdown)
- [ ] Recent requests table with sorting/filtering
- [ ] Mobile-responsive navigation bar
- [ ] Theme switching (light/dark/system)
- [ ] Profile dropdown with user information

**Navigation & UI**
- [ ] Sidebar navigation (expandable/collapsible)
- [ ] Mobile bottom navigation bar
- [ ] Responsive design across devices
- [ ] Notification dropdown functionality
- [ ] Settings access (role-dependent)

## 📋 **Request Management**

**Request Creation**
- [ ] Create new requests using form templates
- [ ] Request form builder with drag-and-drop fields
- [ ] Field types: text, number, date, SSN, address, financial info
- [ ] Template application (SUBJECT, FINANCIAL, ADDRESS)
- [ ] File attachment support
- [ ] Request tracking ID generation

**Request Processing**
- [ ] View request details in modal
- [ ] Assign requests to users (Manager/Admin/JAFAR roles)
- [ ] Process selected requests (bulk operations)
- [ ] Delete requests (soft delete)
- [ ] Status updates (New → In Progress → Completed)
- [ ] Request fulfillment dashboard for assigned users

**Request Dashboard Features**
- [ ] Data table with sorting, filtering, pagination
- [ ] Status-based filtering (All, New, In Progress, Completed, etc.)
- [ ] Bulk selection and operations
- [ ] "Start Assignment" button functionality
- [ ] Request details modal with assignment capabilities

## 🔧 **Admin Features** (Admin & JAFAR roles only)

**User Management**
- [ ] View all users in the system
- [ ] Add new users manually
- [ ] Edit existing user information
- [ ] Delete users
- [ ] Send user invitations via email
- [ ] Manage user roles and permissions
- [ ] Export user data to Excel
- [ ] Resend invitation emails

**Form & Workflow Management**
- [ ] Create workflow templates using form builder
- [ ] Manage form fields and field types
- [ ] Form groups management
- [ ] Field lookups configuration
- [ ] Template management (SUBJECT, FINANCIAL, ADDRESS)

**System Administration**
- [ ] Role and permissions management
- [ ] Field types administration
- [ ] Forms groups and field associations
- [ ] System health monitoring

## 🛠 **Developer Tools** (JAFAR role only)

**API Explorer**
- [ ] Browse available API endpoints
- [ ] Test API calls with authentication
- [ ] View API documentation
- [ ] Endpoint categorization (Authentication, Users, Requests, etc.)
- [ ] Request/response testing interface

## 📧 **Communication Features**

**Email Integration**
- [ ] SendGrid email validation during registration
- [ ] Email verification for new accounts
- [ ] Password reset emails
- [ ] User invitation emails
- [ ] Email notifications for request updates

**Notifications**
- [ ] In-app notification system
- [ ] Toast notifications for user actions
- [ ] Success/error message handling
- [ ] SweetAlert2 confirmation dialogs

## 🔒 **Security Features**

**Access Control**
- [ ] Role-based access restrictions
- [ ] JWT token validation
- [ ] Protected routes based on authentication
- [ ] API endpoint security (middleware protection)
- [ ] Session timeout handling

**Data Protection**
- [ ] Sensitive data masking (SSN fields)
- [ ] Secure password handling
- [ ] HTTPS enforcement (production)
- [ ] Input validation and sanitization

## 📱 **Mobile Experience**

**Responsive Design**
- [ ] Mobile-optimized layouts
- [ ] Touch-friendly interface elements
- [ ] Mobile navigation patterns
- [ ] Tablet compatibility
- [ ] Cross-browser compatibility

## 🔍 **Search & Filtering**

**Data Management**
- [ ] Request search functionality
- [ ] Advanced filtering options
- [ ] Sorting capabilities
- [ ] Pagination controls
- [ ] Data export features

## ⚡ **Performance & Reliability**

**System Performance**
- [ ] Page load times
- [ ] API response times
- [ ] Database query performance
- [ ] File upload handling
- [ ] Error handling and recovery

**Production Deployment**
- [ ] Azure App Service deployment
- [ ] Database connectivity (SQL Server)
- [ ] Environment configuration
- [ ] SSL certificate functionality
- [ ] Backup and recovery procedures

## 🧪 **Testing Scenarios**

**User Journey Testing**
1. **New User Registration** → Email verification → First login → Dashboard exploration
2. **Request Creation** → Form filling → Submission → Tracking
3. **Request Assignment** → Processing → Status updates → Completion
4. **Admin Workflow** → User management → Form creation → System administration
5. **Mobile Usage** → All features on mobile devices
6. **Error Handling** → Network issues → Invalid inputs → Permission errors

**Cross-Role Testing**
- [ ] Test feature access with each role type
- [ ] Verify role-based UI differences
- [ ] Confirm permission enforcement
- [ ] Validate data visibility restrictions

## 📝 **Test Notes**

### Test Environment Setup
- **Frontend**: Running on port 5175 (Vite dev server)
- **Backend**: Running on port 3001 (Express server)
- **Database**: SQL Server with Guardian schema
- **Email**: SendGrid integration (support@shieldlytics.com)

### Test User Accounts Needed
Create test accounts for each role:
1. Administrator (role_id: 1)
2. General User (role_id: 2)
3. Manager (role_id: 3)
4. Processor (role_id: 4)
5. External User (role_id: 5)
6. JAFAR Developer (role_id: 6)

### Critical Test Areas
- **Authentication flow** (registration → verification → login)
- **Request lifecycle** (creation → assignment → processing → completion)
- **Role-based access control** (ensure proper restrictions)
- **Mobile responsiveness** (test on various devices)
- **Error handling** (network issues, invalid inputs)

### Known Issues to Verify Fixed
- Process and Delete buttons functionality
- API endpoints returning JSON (not HTML)
- Form creation and submission
- Password reset flow
- Request assignment features
- Production deployment stability

---

**Last Updated**: 2025-07-26  
**Version**: MVP Test v1.0  
**Environment**: Development & Production

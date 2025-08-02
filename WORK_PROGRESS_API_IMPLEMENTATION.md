# Work Progress Tracking System - API Implementation

## Overview

A comprehensive work progress tracking and attachment management system has been implemented for the Guardian MVP project. This system provides detailed progress tracking, milestone management, file attachments, and real-time notifications for all request-related activities.

## Database Schema

### New WORK_PROGRESS Table

```sql
CREATE TABLE GUARDIAN.WORK_PROGRESS (
    WORK_PROGRESS_ID INT IDENTITY(1,1) PRIMARY KEY,
    REQUEST_ID INT NOT NULL,
    USER_ID INT NOT NULL,
    COMPANY_ID INT NOT NULL,
    PROGRESS_TYPE VARCHAR(50) NOT NULL DEFAULT 'note',
    TITLE VARCHAR(255) NOT NULL,
    DESCRIPTION VARCHAR(2000),
    HOURS_WORKED DECIMAL(5,2),
    STATUS_UPDATE VARCHAR(100),
    RELATED_ATTACHMENT_ID INT,
    IS_MILESTONE BIT NOT NULL DEFAULT 0,
    IS_VISIBLE_TO_REQUESTOR BIT NOT NULL DEFAULT 1,
    CREATE_DATE DATETIME NOT NULL DEFAULT GETDATE(),
    UPDATE_DATE DATETIME NOT NULL DEFAULT GETDATE(),
    CREATE_USER_ID INT,
    UPDATE_USER_ID INT
);
```

### Enhanced ATTACHMENTS Table

- Added `COMPANY_ID` column for proper company isolation
- Indexed for performance with company-based filtering
- Supports file uploads up to 10MB

### Progress Types Supported

- **note**: General progress notes
- **milestone**: Important progress milestones
- **discovery**: Discovery findings
- **attachment**: File-related progress
- **status_update**: Status changes

## API Endpoints Implemented

### Work Progress Management

#### 1. Get Work Progress for Request
```http
GET /api/requests/:id/progress
```
**Purpose**: Retrieve all progress entries for a specific request
**Authentication**: Required (getAuthenticatedUserCompany)
**Company Filtering**: Yes
**Response**: Array of progress entries with user information and attachment details

#### 2. Add Progress Entry
```http
POST /api/requests/:id/progress
```
**Purpose**: Create new progress entry with optional file upload
**Authentication**: Required (getAuthenticatedUserCompany)
**File Upload**: Supported via multer (attachment field)
**Authorization**: Assigned user, requestor, or admin
**Notifications**: Creates notifications for milestones and status updates

**Request Body**:
```json
{
  "progressType": "note|milestone|discovery|attachment|status_update",
  "title": "Progress Title (required)",
  "description": "Detailed description",
  "hoursWorked": 2.5,
  "statusUpdate": "Status change",
  "isMilestone": false,
  "isVisibleToRequestor": true
}
```

#### 3. Update Progress Entry
```http
PUT /api/progress/:progressId
```
**Purpose**: Update existing progress entry
**Authentication**: Required (getAuthenticatedUserCompany)
**Authorization**: Creator, assigned user, requestor, or admin

#### 4. Delete Progress Entry
```http
DELETE /api/progress/:progressId
```
**Purpose**: Delete progress entry
**Authentication**: Required (getAuthenticatedUserCompany)
**Authorization**: Creator or admin only
**Validation**: Prevents deletion if attachments are referenced

#### 5. Get Progress Summary
```http
GET /api/progress/:progressId/summary
```
**Purpose**: Get statistical summary of progress for a request
**Authentication**: Required (getAuthenticatedUserCompany)
**Returns**: 
- Total entries
- Milestone count
- Total hours worked
- Contributors count
- Attachments count
- Progress type breakdown

### Attachment Management

#### 1. Upload Attachment
```http
POST /api/requests/:id/attachments
```
**Purpose**: Upload file attachment to request
**Authentication**: Required (getAuthenticatedUserCompany)
**File Upload**: Required (file field)
**File Types**: Images, PDF, Word, Excel, text files
**Size Limit**: 10MB

#### 2. Get Request Attachments
```http
GET /api/requests/:id/attachments
```
**Purpose**: List all attachments for a request
**Authentication**: Required (getAuthenticatedUserCompany)
**Company Filtering**: Yes
**Response**: Array of attachment metadata with uploader information

#### 3. Download Attachment
```http
GET /api/attachments/:id/download
```
**Purpose**: Download specific attachment file
**Authentication**: Required (getAuthenticatedUserCompany)
**Response**: File download with proper headers

#### 4. Delete Attachment
```http
DELETE /api/attachments/:id
```
**Purpose**: Delete attachment file
**Authentication**: Required (getAuthenticatedUserCompany)
**Authorization**: Uploader, assigned user, requestor, or admin
**Validation**: Prevents deletion if referenced by progress entries

## Security Implementation

### Company-Based Data Isolation

All endpoints implement strict company-based data isolation:

```javascript
// Standard company filtering pattern
const progressEntries = await prisma.$queryRaw`
    SELECT * FROM GUARDIAN.WORK_PROGRESS 
    WHERE REQUEST_ID = ${requestId} 
    AND COMPANY_ID = ${req.companyId}
`;
```

### Role-Based Authorization

**Admin Roles** (IDs: 1, 3, 4, 6):
- Can view all progress within their company
- Can update/delete any progress entry
- Can manage all attachments

**Assigned Users**:
- Can add progress to assigned requests
- Can update their own progress entries
- Can manage attachments on assigned requests

**Requestors**:
- Can add progress to their own requests
- Can view progress (based on visibility settings)
- Can manage attachments on their requests

### File Upload Security

```javascript
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'image/jpeg', 'image/png', 'image/gif',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain',
            'text/csv'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'), false);
        }
    }
});
```

## Notification Integration

The system creates automatic notifications for:

### Milestone Notifications
- Triggered when `isMilestone: true`
- Notifies requestor and assigned user (if different from creator)
- Title: "Milestone Reached"

### Status Update Notifications
- Triggered when `statusUpdate` is provided
- Notifies relevant stakeholders
- Title: "Status Update"

### Notification Format
```sql
INSERT INTO GUARDIAN.NOTIFICATIONS (
    USER_ID, 
    TYPE, 
    TITLE, 
    MESSAGE, 
    RELATED_ID, 
    COMPANY_ID, 
    CREATED_DATE, 
    IS_READ
) VALUES (
    ${userId},
    'progress_update',
    ${notificationTitle},
    ${notificationMessage},
    ${requestId},
    ${companyId},
    GETDATE(),
    0
)
```

## Server File Synchronization

All endpoints have been implemented across all three server files:

1. **server.cjs** - Development server with full features
2. **server-production.js** - Production source file
3. **server.js** - Production deployment file

### Critical Deployment Note

The Azure pipeline copies `server-production.js` to `server.js` during deployment:
```yaml
cp server-production.js deployment/server.js
```

**Always update `server-production.js` for production changes!**

## Prisma Schema Updates

### Added Models

```prisma
model WORK_PROGRESS {
  WORK_PROGRESS_ID        Int      @id(map: "PK_WORK_PROGRESS") @default(autoincrement())
  REQUEST_ID              Int
  USER_ID                 Int
  COMPANY_ID              Int
  PROGRESS_TYPE           String   @default("note") @db.VarChar(50)
  TITLE                   String   @db.VarChar(255)
  DESCRIPTION             String?  @db.VarChar(2000)
  HOURS_WORKED            Decimal? @db.Decimal(5,2)
  STATUS_UPDATE           String?  @db.VarChar(100)
  RELATED_ATTACHMENT_ID   Int?
  IS_MILESTONE            Boolean  @default(false)
  IS_VISIBLE_TO_REQUESTOR Boolean  @default(true)
  CREATE_DATE             DateTime @default(now()) @db.DateTime
  UPDATE_DATE             DateTime @default(now()) @db.DateTime
  CREATE_USER_ID          Int?
  UPDATE_USER_ID          Int?
  
  // Relationships
  REQUEST                 REQUESTS     @relation(fields: [REQUEST_ID], references: [REQUEST_ID])
  USER                    USERS        @relation("WorkProgressUser", fields: [USER_ID], references: [USER_ID])
  RELATED_ATTACHMENT      ATTACHMENTS? @relation(fields: [RELATED_ATTACHMENT_ID], references: [ATTACHMENT_ID])

  @@schema("GUARDIAN")
}
```

### Enhanced ATTACHMENTS Model

```prisma
model ATTACHMENTS {
  ATTACHMENT_ID  Int      @id(map: "PK_ATTACHMENTS") @default(autoincrement())
  REQUEST_ID     Int
  FILE_NAME      String   @db.VarChar(100)
  ATTACHMENT     Bytes?
  COMPANY_ID     Int?     // Added for company isolation
  CREATE_USER_ID Int?
  UPDATE_USER_ID Int?
  CREATE_DATE    DateTime @default(now()) @db.DateTime
  UPDATE_DATE    DateTime @default(now()) @db.DateTime
  
  WORK_PROGRESS  WORK_PROGRESS[]

  @@schema("GUARDIAN")
}
```

## Error Handling

Comprehensive error handling implemented for all endpoints:

```javascript
try {
    // Endpoint logic
} catch (error) {
    console.error(`❌ Error: ${error.message}`);
    res.status(500).json({
        error: 'Internal server error',
        message: error.message,
        timestamp: new Date().toISOString()
    });
}
```

## Response Formats

### Success Response
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { /* endpoint-specific data */ }
}
```

### Error Response
```json
{
  "error": "Error description",
  "message": "Detailed error message",
  "timestamp": "2025-08-02T02:00:00.000Z"
}
```

## Testing & Deployment

### Prerequisites

1. **Database Migration**: Run `migrations/add_work_progress_table.sql`
2. **Prisma Generation**: Run `bun prisma generate`
3. **Dependencies**: multer is already installed

### Testing Commands

```bash
# Test development server
bun server.cjs

# Test production locally
bun server.js

# Sync production deployment file
cp server.js server-production.js
```

### Validation Checklist

- ✅ All three server files synchronized
- ✅ Company-based data isolation implemented
- ✅ Proper error handling included
- ✅ JWT authentication required for protected routes
- ✅ Database queries include company filtering
- ✅ Response formats are consistent
- ✅ File upload validation implemented
- ✅ Role-based authorization enforced
- ✅ Notification system integrated
- ✅ Production deployment file updated

## Usage Examples

### Adding Progress with File

```javascript
const formData = new FormData();
formData.append('title', 'Document Review Complete');
formData.append('description', 'All required documents reviewed and approved');
formData.append('progressType', 'milestone');
formData.append('isMilestone', 'true');
formData.append('hoursWorked', '3.5');
formData.append('attachment', fileInput.files[0]);

fetch('/api/requests/123/progress', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${token}`
    },
    body: formData
});
```

### Getting Progress Summary

```javascript
fetch('/api/progress/456/summary', {
    headers: {
        'Authorization': `Bearer ${token}`
    }
})
.then(response => response.json())
.then(data => {
    console.log('Total Hours:', data.summary.totalHours);
    console.log('Milestones:', data.summary.milestoneCount);
});
```

## Future Enhancements

### Potential Features

1. **Progress Templates**: Pre-defined progress entry templates
2. **Time Tracking**: Enhanced time tracking with start/stop functionality
3. **Progress Analytics**: Charts and visualizations for progress data
4. **Bulk Operations**: Bulk progress entry creation/updates
5. **Progress Approval**: Workflow for progress entry approval
6. **External Integrations**: Integration with external project management tools

### Performance Optimizations

1. **Pagination**: Implement pagination for large progress lists
2. **Caching**: Cache frequently accessed progress summaries
3. **File Storage**: Move file storage to cloud storage (Azure Blob)
4. **Indexing**: Add database indexes for common query patterns

## Conclusion

The work progress tracking system provides a comprehensive solution for tracking detailed work progress on requests with:

- **Comprehensive Progress Tracking**: Multiple progress types, milestones, time tracking
- **File Management**: Complete attachment lifecycle with security
- **Real-time Notifications**: Automatic notifications for important events
- **Company Isolation**: Strict security with company-based data filtering
- **Role-based Access**: Granular permissions based on user roles
- **Production Ready**: Synchronized across all deployment environments

The system follows all Guardian MVP patterns and maintains the high security standards required for government-grade applications.

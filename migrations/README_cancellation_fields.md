# Request Cancellation Fields Migration

## Overview
This migration enhances the Guardian MVP system by adding proper database schema support for request cancellation tracking. Instead of relying on work progress entries, cancellation data is now stored directly in the REQUESTS table for better data integrity and easier querying.

## Database Changes

### New Fields Added to GUARDIAN.REQUESTS
- **CANCELLATION_REASON** (NVARCHAR(500), NULL) - User-provided cancellation reason
- **CANCELLED_DATE** (DATETIME, NULL) - Timestamp when request was cancelled  
- **CANCELLED_BY** (INT, NULL) - User ID who cancelled the request

### Constraints and Indexes
- **Foreign Key**: `FK_REQUESTS_CANCELLED_BY` references `GUARDIAN.USERS(USER_ID)`
- **Check Constraint**: `CHK_REQUESTS_CANCELLATION_FIELDS` ensures proper field management:
  - When STATUS = 'X': CANCELLED_DATE and CANCELLED_BY must be NOT NULL
  - When STATUS ` 'X': All cancellation fields must be NULL
- **Indexes**:
  - `IX_REQUESTS_STATUS_CANCELLED_DATE` for cancellation reports
  - `IX_REQUESTS_CANCELLED_BY` for user-based cancellation queries

## Migration Steps

### 1. Run Database Migration
```sql
-- Execute the migration script
-- File: migrations/add_request_cancellation_fields.sql
```

### 2. Update Prisma Schema
The Prisma schema has been updated to include:
- New cancellation fields in REQUESTS model
- New relationship `CANCELLED_BY_REQUESTS` in USERS model

### 3. Regenerate Prisma Client
```bash
bun prisma generate
```

### 4. Server Updates
All three server files have been updated:
- `server.cjs` (development)
- `server.js` (production)
- `server-production.js` (production source)

## API Changes

### Enhanced Cancellation Endpoint
`POST /api/requests/:id/cancel`

**Before**: Created work progress entries for cancellation reasons
**After**: Stores cancellation data directly in REQUESTS table

**Request Body**:
```json
{
  "cancellationReason": "User requested cancellation due to changed requirements"
}
```

**Database Updates**:
- Sets `STATUS = 'X'`
- Sets `CANCELLATION_REASON = provided reason`
- Sets `CANCELLED_DATE = GETDATE()`
- Sets `CANCELLED_BY = current user ID`
- Updates `UPDATE_DATE` and `UPDATE_USER_ID`

## Benefits

### Data Integrity
- Cancellation data is stored in proper relational structure
- Foreign key constraints ensure data consistency
- Check constraints prevent invalid states

### Query Performance  
- Optimized indexes for cancellation reporting
- Direct field access instead of JOIN operations with work progress

### Data Architecture
- Cleaner separation of concerns
- Work progress table focuses on actual progress tracking
- Cancellation data has dedicated, properly typed fields

## Backward Compatibility

### Existing Data
- Current work progress entries remain intact
- No data migration needed for existing cancelled requests
- New cancellations use the enhanced schema

### Frontend
- No changes required to frontend components
- API contract remains the same
- Enhanced data available for future reporting features

## Rollback Instructions

If needed, the migration can be rolled back using the commented SQL statements in the migration file:

```sql
-- Drop constraints and indexes
ALTER TABLE [GUARDIAN].[REQUESTS] DROP CONSTRAINT [CHK_REQUESTS_CANCELLATION_FIELDS];
DROP INDEX [IX_REQUESTS_STATUS_CANCELLED_DATE] ON [GUARDIAN].[REQUESTS];
DROP INDEX [IX_REQUESTS_CANCELLED_BY] ON [GUARDIAN].[REQUESTS];
ALTER TABLE [GUARDIAN].[REQUESTS] DROP CONSTRAINT [FK_REQUESTS_CANCELLED_BY];

-- Remove columns
ALTER TABLE [GUARDIAN].[REQUESTS] DROP COLUMN [CANCELLATION_REASON];
ALTER TABLE [GUARDIAN].[REQUESTS] DROP COLUMN [CANCELLED_DATE]; 
ALTER TABLE [GUARDIAN].[REQUESTS] DROP COLUMN [CANCELLED_BY];
```

## Validation

### Test Cancellation Flow
1. Create a test request
2. Cancel the request with a reason
3. Verify database contains:
   - `STATUS = 'X'`
   - `CANCELLATION_REASON = provided reason`
   - `CANCELLED_DATE = timestamp`
   - `CANCELLED_BY = user ID`

### Query Examples
```sql
-- Get all cancelled requests with details
SELECT 
    r.REQUEST_ID,
    r.REQUEST_NAME,
    r.CANCELLATION_REASON,
    r.CANCELLED_DATE,
    u.FIRST_NAME + ' ' + u.LAST_NAME as CANCELLED_BY_NAME
FROM GUARDIAN.REQUESTS r
LEFT JOIN GUARDIAN.USERS u ON r.CANCELLED_BY = u.USER_ID
WHERE r.STATUS = 'X'
ORDER BY r.CANCELLED_DATE DESC;

-- Get cancellation statistics by user
SELECT 
    u.FIRST_NAME + ' ' + u.LAST_NAME as USER_NAME,
    COUNT(*) as CANCELLATIONS_COUNT
FROM GUARDIAN.REQUESTS r
JOIN GUARDIAN.USERS u ON r.CANCELLED_BY = u.USER_ID
WHERE r.STATUS = 'X'
GROUP BY u.USER_ID, u.FIRST_NAME, u.LAST_NAME
ORDER BY CANCELLATIONS_COUNT DESC;
```
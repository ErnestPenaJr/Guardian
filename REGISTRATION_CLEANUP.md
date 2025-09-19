# Guardian MVP Registration Cleanup System

## Overview

The Guardian MVP system now includes a comprehensive cleanup mechanism for incomplete registration data. This system automatically handles stale unverified registrations to prevent conflicts and maintain database health.

## Problem Solved

**Issue**: When users start registration but don't complete it, their partial data remains in the database (GUARDIAN.USERS table with EMAIL_VALIDATED = 0). When they try to register again, they may get errors or conflicts.

**Solution**: Automatic cleanup of stale unverified registrations with comprehensive data removal and re-registration support.

## Architecture

### Core Components

1. **Cleanup Functions** (`cleanupIncompleteRegistrations`, `performPeriodicCleanup`)
2. **Enhanced Registration Flow** (in POST /api/register)
3. **Cleanup API Endpoints** (manual and periodic cleanup)
4. **Statistics & Monitoring** (cleanup metrics and health checks)

### Flow Diagram

```
Registration Request
        “
Check for verified users (block if found)
        “
Check for recent unverified (reuse if <30 min)
        “
Cleanup stale unverified (>30 min old)
        “
Create new registration
```

## Implementation Details

### 1. Automatic Cleanup in Registration Flow

The POST /api/register endpoint now includes:

- **Step 1**: Check for existing verified users (blocks registration)
- **Step 2**: Check for recent unverified registrations (<30 minutes)
  - If found: Resend verification email with new code
- **Step 3**: Cleanup stale unverified registrations (>30 minutes old)
  - Remove user records, role assignments, orphaned companies
- **Step 4**: Create new registration if no conflicts

### 2. Comprehensive Data Cleanup

The `cleanupIncompleteRegistrations` function removes:

- **Stale unverified users** (older than timeout threshold)
- **Expired verification tokens** (older than 15 minutes)
- **Orphaned role assignments** (USER_ROLES table)
- **Orphaned companies** (if no other active users)
- **Comprehensive error tracking** and logging

### 3. Batch Processing for Maintenance

The `performPeriodicCleanup` function:

- Processes old registrations in batches (10 users at a time)
- Removes registrations older than specified days (default: 7 days)
- Includes delay between batches to avoid database overload
- Provides detailed statistics and error reporting

## API Endpoints

### 1. Manual Cleanup

```http
POST /api/cleanup/incomplete-registrations
Content-Type: application/json

{
  "email": "user@example.com",
  "timeoutMinutes": 30
}
```

**Response:**
```json
{
  "success": true,
  "message": "Cleanup completed for user@example.com",
  "results": {
    "email": "user@example.com",
    "timeoutMinutes": 30,
    "totalCleaned": 1,
    "details": {
      "staleUnverifiedUsers": 1,
      "expiredTokens": 0,
      "orphanedCompanies": 0,
      "orphanedRoles": 0,
      "errors": []
    }
  }
}
```

### 2. Periodic Cleanup

```http
POST /api/cleanup/periodic
Content-Type: application/json

{
  "daysOld": 7
}
```

**Response:**
```json
{
  "success": true,
  "message": "Periodic cleanup completed - removed 5 old registrations",
  "summary": {
    "totalUsersRemoved": 5,
    "totalCompaniesRemoved": 2,
    "totalRolesRemoved": 3,
    "errors": []
  }
}
```

### 3. Cleanup Statistics

```http
GET /api/cleanup/stats?daysOld=7
```

**Response:**
```json
{
  "success": true,
  "message": "Cleanup statistics for registrations older than 7 days",
  "statistics": {
    "totalUnverifiedUsers": 15,
    "oldUnverifiedUsers": 8,
    "staleUnverifiedUsers": 12,
    "expiredTokens": 6,
    "daysOldThreshold": 7
  }
}
```

## Configuration

### Timeouts and Thresholds

- **Recent registration threshold**: 30 minutes
- **Verification token expiry**: 15 minutes
- **Periodic cleanup default**: 7 days
- **Batch processing size**: 10 users per batch

### Database Tables Affected

- `GUARDIAN.USERS` (primary cleanup target)
- `GUARDIAN.USER_ROLES` (orphaned role assignments)
- `GUARDIAN.COMPANY` (orphaned companies)

## Server Synchronization

The cleanup mechanism is implemented across all three server files:

- `server.cjs` (development)
- `server.js` (production testing)
- `server-production.js` (Azure deployment source)

All cleanup functions and endpoints are identical across environments.

## Usage Examples

### Automated Usage (Built-in)

The cleanup mechanism works automatically during normal registration:

```javascript
// User attempts registration
POST /api/register { "email": "user@example.com" }

// System automatically:
// 1. Checks for existing verified users
// 2. Handles recent unverified registrations
// 3. Cleans up stale data
// 4. Creates new registration if clear
```

### Manual Cleanup

```bash
# Clean up specific email
curl -X POST http://localhost:3001/api/cleanup/incomplete-registrations \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "timeoutMinutes": 30}'

# Periodic maintenance cleanup
curl -X POST http://localhost:3001/api/cleanup/periodic \
  -H "Content-Type: application/json" \
  -d '{"daysOld": 7}'

# Check cleanup statistics
curl http://localhost:3001/api/cleanup/stats?daysOld=7
```

### Monitoring and Health Checks

```bash
# Get current unverified user statistics
curl http://localhost:3001/api/cleanup/stats

# Check server health
curl http://localhost:3001/api/health
```

## Testing

A comprehensive test suite is provided:

```bash
# Run cleanup mechanism tests
node test-registration-cleanup.js
```

**Test Coverage:**
- Creating incomplete registrations
- Getting cleanup statistics
- Manual cleanup for specific emails
- Periodic cleanup functionality
- Registration flow with automatic cleanup

## Production Considerations

### Automated Periodic Cleanup

Consider setting up automated periodic cleanup via cron job or scheduled task:

```bash
# Example: Daily cleanup of registrations older than 7 days
# Add to crontab: 0 2 * * * /path/to/cleanup-script.sh

#!/bin/bash
curl -X POST http://localhost:3001/api/cleanup/periodic \
  -H "Content-Type: application/json" \
  -d '{"daysOld": 7}' \
  >> /var/log/guardian-cleanup.log 2>&1
```

### Monitoring

Monitor cleanup operations through:

- Server logs (comprehensive cleanup logging)
- Cleanup endpoint responses (detailed statistics)
- Database metrics (unverified user counts)

### Security

- Cleanup functions include comprehensive error handling
- All database operations use parameterized queries
- Company-based data isolation is maintained
- No sensitive data is exposed in cleanup responses

## Error Handling

The cleanup system includes robust error handling:

- **Non-blocking errors**: Cleanup failures don't prevent new registrations
- **Detailed logging**: All operations are logged with timestamps
- **Graceful degradation**: Individual cleanup failures are tracked but don't stop the process
- **Validation**: Email format validation before database operations

## Benefits

1. **Prevents registration conflicts** - Users can re-register cleanly
2. **Maintains database health** - Removes orphaned data automatically
3. **Improves user experience** - Seamless re-registration process
4. **Reduces support tickets** - Eliminates "email already exists" errors for incomplete registrations
5. **Comprehensive monitoring** - Detailed statistics and logging
6. **Thread-safe operations** - Batch processing prevents database overload

## Deployment

The cleanup mechanism is automatically deployed with the Guardian MVP system. No additional configuration is required - it works out of the box with default settings that are suitable for most use cases.

For custom configurations, adjust the timeout values in the cleanup functions or API endpoint calls as needed.
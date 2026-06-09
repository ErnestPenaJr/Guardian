# Guardian MVP Notice Module - Database Migration Guide

## Overview
The Notice Module requires 3 new database tables to be created. Follow these steps to set up the database schema.

## Migration Files
1. **Main Migration**: `migrations/add_notice_module.sql` - Creates the core tables
2. **Sample Data**: `migrations/add_sample_notices.sql` - Adds test data (optional)

## Database Connection Details
The app now runs on PostgreSQL. Use the `DATABASE_URL` for the target environment:
- **Local dev**: Docker Postgres at `localhost:5433` (database `postgres`, `GUARDIAN` schema)
- **Production**: Neon (Netlify DB, database `netlifydb`, `GUARDIAN` schema)

`DATABASE_URL` format (placeholders — never commit real credentials):
```
postgresql://USER:PASSWORD@HOST/DB?schema=GUARDIAN&connection_limit=30&pool_timeout=20
```

## Steps to Run Migration

### 1. Connect to Database
Using `psql`, a Postgres GUI (e.g. DBeaver / TablePlus), or the Neon console:
```
psql "postgresql://USER:PASSWORD@HOST/DB?schema=GUARDIAN"
```

### 2. Execute Main Migration
Copy and paste the entire contents of `migrations/add_notice_module.sql` and execute it.

This will create:
- `GUARDIAN.NOTICES` table (core notices)
- `GUARDIAN.NOTICE_RECIPIENTS` table (who receives notices)  
- `GUARDIAN.NOTICE_READ_STATUS` table (read tracking)
- All necessary indexes and constraints
- Update trigger for audit trails

### 3. Verify Tables Created
Run this query to confirm tables exist:
```sql
SELECT TABLE_NAME 
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = 'GUARDIAN' 
AND TABLE_NAME LIKE 'NOTICE%'
ORDER BY TABLE_NAME;
```

Expected results:
- NOTICE_READ_STATUS
- NOTICE_RECIPIENTS  
- NOTICES

### 4. Optional: Add Sample Data
To test the Notice Module with sample data, execute `migrations/add_sample_notices.sql`.

This adds:
- 2 sample notices for current user (ID: 1111, Company: 26)
- Notice recipients entries
- Test data for both read and unread notices

### 5. Test API Endpoints
After migration, test the Notice Module:

1. **Navigate to**: `http://localhost:5173/notices` (or your frontend URL)
2. **Expected behavior**: 
   - No more "Invalid object name 'GUARDIAN.NOTICES'" errors
   - API calls should return JSON responses
   - Notice landing page should load successfully

## Troubleshooting

### Common Issues:
1. **Connection refused**: Ensure database server is accessible
2. **Permission denied**: Verify GUARDIAN user has CREATE TABLE permissions
3. **Foreign key errors**: Ensure USERS and FORMS tables exist

### Validation Queries:
```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'GUARDIAN' AND table_name LIKE 'NOTICE%';

-- Count sample records
SELECT COUNT(*) as NoticeCount FROM GUARDIAN.NOTICES;
SELECT COUNT(*) as RecipientCount FROM GUARDIAN.NOTICE_RECIPIENTS;

-- View sample data
SELECT * FROM GUARDIAN.NOTICES ORDER BY CREATE_DATE DESC LIMIT 5;
```

## Next Steps
After successful migration:
1. Restart the development server if needed
2. Test the Notice Module frontend components
3. Verify API endpoints return proper JSON responses
4. Create additional notices through the UI to test full functionality
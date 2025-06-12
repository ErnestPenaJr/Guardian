# Guardian MVP Changelog

## [Unreleased]

### Added
- Created EnhancedFormBuilder component with improved UI and functionality
- Added drag-and-drop field reordering in EnhancedFormBuilder
- Added field editing modal with improved styling
- Added API Explorer route and link to the application
- Created dedicated CSS styles for EnhancedFormBuilder
- Added field lookups functionality with dedicated admin pages
- Added form groups functionality with admin management
- Added new admin pages for field management

### Changed
- Simplified form builder UI by removing subject management functionality
- Improved field type organization and presentation
- Enhanced drag-and-drop interactions for better usability
- Reverted RequestDashboard to use SimpleFormBuilder as originally implemented
- Using SimpleFormBuilder.css for styling the form builder interface

### Fixed
- Fixed TypeScript error in `server/index.ts` by adding an explicit type (`{ id: number; name: string } | null`) to the `company` variable declaration within the `/api/me` route handler, resolving an issue where an object was assigned to a variable inferred as `null`.
- Refactored `/api/debug/requests` in `server/routes/requests.ts` to correctly insert into `GUARDIAN.REQUESTS` and `GUARDIAN.FORMS_INSTANCE`, use the `GUARDIAN.` schema, and handle `TRACKINGID` by mapping input `description` to `REQUEST_DESCRIPTION`.
- Modified `/api/sql-request` in `server/routes/requests.ts` to not insert into `TRACKINGID` (as it's a computed column) and correctly map input `description` to `REQUEST_DESCRIPTION`.
- Fixed SQL queries in `server/routes/requests.ts` by changing schema prefix to `GUARDIAN.` (from `dbo.`) for `REQUESTS` and `FORMS_INSTANCE` tables to resolve 'Invalid object name' error.
- Fixed syntax errors in FormBuilder component
- Removed unused imports and variables to resolve lint warnings
- Converted requests routes to use Express Router pattern to fix 'app.post is not a function' error
- Resolved merge conflicts in server/index.ts, prisma/schema.prisma, dist-server/index.js, and dist/index.html
- Fixed route registration for requestsRoutes in server/index.ts
- Fixed SQL syntax error in requests.ts GET endpoints by hardcoding schema name instead of using string interpolation
- Fixed Prisma model usage in `server/routes/forms-groups.ts` by replacing non-existent model references with raw SQL queries
- Added proper TypeScript interfaces and type assertions for raw SQL query results in forms-groups routes
- Updated all CRUD operations in forms-groups routes to use Prisma's $queryRaw for consistent database access

## [0.1.0] - 2025-05-23

### Added
- Initial project setup
- Basic form builder functionality
- Request dashboard implementation
- Form field management
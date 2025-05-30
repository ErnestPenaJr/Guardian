# Guardian MVP Changelog

## [Unreleased]

### Added
- Created EnhancedFormBuilder component with improved UI and functionality
- Added drag-and-drop field reordering in EnhancedFormBuilder
- Added field editing modal with improved styling
- Added API Explorer route and link to the application
- Created dedicated CSS styles for EnhancedFormBuilder

### Changed
- Simplified form builder UI by removing subject management functionality
- Improved field type organization and presentation
- Enhanced drag-and-drop interactions for better usability
- Reverted RequestDashboard to use SimpleFormBuilder as originally implemented
- Using SimpleFormBuilder.css for styling the form builder interface

### Fixed
- Refactored `/api/debug/requests` in `server/routes/requests.ts` to correctly insert into `GUARDIAN.REQUESTS` and `GUARDIAN.FORMS_INSTANCE`, use the `GUARDIAN.` schema, and handle `TRACKINGID` by mapping input `description` to `REQUEST_DESCRIPTION`.
- Modified `/api/sql-request` in `server/routes/requests.ts` to not insert into `TRACKINGID` (as it's a computed column) and correctly map input `description` to `REQUEST_DESCRIPTION`.
- Fixed SQL queries in `server/routes/requests.ts` by changing schema prefix to `GUARDIAN.` (from `dbo.`) for `REQUESTS` and `FORMS_INSTANCE` tables to resolve 'Invalid object name' error.
- Fixed syntax errors in FormBuilder component
- Removed unused imports and variables to resolve lint warnings

## [0.1.0] - 2025-05-23

### Added
- Initial project setup
- Basic form builder functionality
- Request dashboard implementation
- Form field management
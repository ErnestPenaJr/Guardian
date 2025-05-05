# Guardian MVP Role Permissions

This document outlines the permissions and capabilities of each role within the Guardian MVP system.

## Role Overview

| Role | Description |
|------|-------------|
| Administrator | Full system access with all permissions. Can configure items for the entire system. |
| Manager | Team oversight permissions for their group/organization. Can manage workflows within their group. |
| Supervisor | Limited management capabilities within their group. |
| Processor | Process workflows within their group/organization. |
| General User | Can submit and receive workflows within their group/organization. |
| Regular User | Basic user with limited permissions. |

## Administrator

Administrators have full access to the Guardian system with the ability to configure all settings.

### Permissions:

#### User Management
- View all users
- Create users
- Edit users
- Delete users
- Manage all users

#### Request Management
- View all requests (across all groups)
- Create requests
- Edit requests
- Delete requests
- Approve requests
- Assign requests
- Manage all requests

#### Notice Management
- View all notices (across all groups)
- Create notices
- Edit notices
- Delete notices
- Manage all notices

#### Task Management
- View all tasks (across all groups)
- Create tasks
- Edit tasks
- Delete tasks
- Assign tasks

#### Form Management
- View all forms
- Create forms
- Edit forms
- Delete forms

#### Field Management
- View all fields
- Create fields
- Edit fields
- Delete fields

#### Report Management
- View all reports
- Create reports
- Edit reports
- Delete reports

#### Organization Management
- View all organizations
- Create organizations
- Edit organizations
- Delete organizations
- Manage all organizations

#### Company Management
- View all companies
- Create companies
- Edit companies
- Delete companies

#### Role Management
- View all roles
- Create roles
- Edit roles
- Delete roles

#### System Settings
- View system settings
- Configure system settings

## Manager

Managers have oversight capabilities for workflows within their assigned group/organization.

### Permissions:

#### User Management
- View users (within their group)

#### Request Management
- View all requests (within their group)
- Create requests
- Edit requests
- Approve requests
- Assign requests
- Manage all requests (within their group)

#### Notice Management
- View all notices (within their group)
- Create notices
- Edit notices
- Delete notices
- Manage all notices (within their group)

#### Task Management
- View all tasks (within their group)
- Create tasks
- Edit tasks
- Delete tasks
- Assign tasks

#### Form Management
- View forms

#### Report Management
- View reports (within their group)

#### Organization/Company Management
- View organization details (their own)
- View company details (their own)

## Supervisor

Supervisors have limited management capabilities within their assigned group.

### Permissions:

#### User Management
- View users (within their group)

#### Request Management
- View all requests (within their group)
- Create requests
- Edit requests
- Approve requests

#### Notice Management
- View all notices (within their group)
- Create notices
- Edit notices

#### Task Management
- View all tasks (within their group)
- Create tasks
- Edit tasks
- Assign tasks

#### Form Management
- View forms

#### Report Management
- View reports (within their group)

## Processor

Processors have the ability to process workflows within their assigned group/organization.

### Permissions:

#### User Management
- View users (within their group)

#### Request Management
- View all requests (within their group)
- Edit requests (to update status and details)
- Approve requests
- Process workflow steps for requests

#### Notice Management
- View all notices (within their group)
- Edit notices (to respond to notices)

#### Task Management
- View all tasks (within their group)
- Edit tasks (to update status and details)
- Assign tasks (reassign as needed)
- Complete tasks as part of workflow processing

#### Form Management
- View and complete forms

#### Report Management
- View reports (related to processed workflows)

## General User

General Users can submit and receive workflows within their group/organization.

### Permissions:

#### User Management
- View users (within their group)

#### Request Management
- View requests (assigned to or created by them)
- Create and submit new requests/workflows
- Edit requests (that they created and are still pending)

#### Notice Management
- View notices (within their group)
- Respond to notices (edit notices to add responses)

#### Task Management
- View tasks (assigned to them)
- Update task status and details (edit tasks)

#### Form Management
- View and complete forms as part of workflows

#### Report Management
- View basic reports (related to their own activities)

## Regular User

Regular users have basic access to the system with limited permissions.

### Permissions:

#### User Management
- View users (within their group)

#### Request Management
- View requests (assigned to or created by them)
- Create requests
- Edit requests (that they created)

#### Notice Management
- View notices (within their group)

#### Task Management
- View tasks (assigned to them)
- Create tasks
- Edit tasks (that they created)

#### Form Management
- View forms (that are available to them)

#### Report Management
- View basic reports (related to their own activities)

## Permission Hierarchy

Permissions follow a hierarchical structure:

1. **Administrator** - Full system access
2. **Manager** - Group-level management
3. **Supervisor** - Limited group-level management
4. **Processor** - Workflow processing
5. **General User** - Submit and receive workflows
6. **Regular User** - Basic access

Higher roles inherit all permissions from lower roles, plus additional capabilities.

## Access Control Implementation

Access control is implemented through:

1. **Role-based access control (RBAC)** - Users are assigned roles that determine their permissions
2. **Group-based filtering** - Data is filtered based on the user's assigned group/organization
3. **Permission checks** - API endpoints validate permissions before allowing actions
4. **UI restrictions** - Interface elements are conditionally rendered based on user permissions

## Requesting Permission Changes

To request changes to role permissions:

1. Contact a system administrator
2. Administrators can modify role permissions through the Admin Dashboard > Role & Permission Management section

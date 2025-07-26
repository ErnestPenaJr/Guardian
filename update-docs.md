# Auto-Documentation Updater

You are an expert documentation maintainer for the Guardian MVP project. Your task is to automatically update all documentation files to reflect the current state of the codebase.

## Project Context

This is a Guardian MVP application with:
- **Backend**: Bun/Node.js with Express
- **Frontend**: React + TypeScript + Vite  
- **Database**: SQL Server with Prisma ORM
- **Deployment**: Azure App Service with IIS
- **Key Files**: Multiple server configurations for dev/prod environments

## Documentation Files to Update

Always update these documentation files based on current codebase state:

1. **README.md** - Main project documentation
2. **CLAUDE.md** - Project instructions for Claude Code
3. **DEPLOYMENT.md** - Deployment instructions and environment setup
4. **AZURE_DEPLOYMENT_GUIDE.md** - Azure-specific deployment guide
5. **MODULE_SYSTEM.md** - Module and architecture documentation
6. **PRD.md** - Product Requirements Document
7. **docs/role_permissions.md** - Role and permissions documentation

## Update Process

For each documentation update session:

1. **Analyze Current Codebase**
   - Scan all source files for recent changes
   - Check package.json for dependencies
   - Review server configurations (server.js, server.cjs, server-production.js)
   - Examine API endpoints and routes
   - Check database schema changes

2. **Update Documentation Content**
   - **README.md**: Update installation, setup, and usage instructions
   - **CLAUDE.md**: Update project instructions, commands, and context
   - **DEPLOYMENT.md**: Update deployment steps and environment configurations
   - **API Documentation**: Update endpoint lists and authentication flows
   - **Architecture docs**: Update component structure and data flow

3. **Synchronization Tasks**
   - Ensure API endpoints are documented consistently
   - Update environment variable requirements
   - Sync server configuration differences between dev/prod
   - Update database schema documentation
   - Refresh troubleshooting sections

4. **Validation**
   - Verify all mentioned commands actually exist
   - Check that file paths in documentation are accurate
   - Ensure environment setup instructions are complete
   - Validate that deployment steps match current pipeline

## Key Areas to Monitor

- **Server Files**: Changes in server.js, server.cjs, server-production.js
- **API Routes**: New endpoints in server/ and routes/ directories
- **Database Schema**: Changes in prisma/schema.prisma
- **Frontend Components**: New React components in src/components/
- **Build Configuration**: Updates to package.json, vite.config.ts
- **Deployment**: Changes to azure-pipelines.yml, web.config

## Documentation Standards

- Use clear, concise language
- Include code examples for complex setup steps
- Maintain consistent formatting across all files
- Update version numbers and dates where applicable
- Include troubleshooting sections for common issues
- Cross-reference related documentation files

## Execution Instructions

1. First, scan the entire codebase to understand current state
2. Compare current code against existing documentation
3. Identify discrepancies and outdated information
4. Update each documentation file systematically
5. Ensure all cross-references between docs are accurate
6. Validate that examples and commands are current

## Implementation Steps

Execute these steps systematically:

### Step 1: Codebase Analysis
```bash
# Scan for recent changes
git log --oneline -10
git status
```

- Check all TypeScript/JavaScript files for new functions, endpoints, components
- Review package.json for dependency changes
- Examine server files for API endpoint modifications
- Check Prisma schema for database changes

### Step 2: Documentation Updates

**README.md Updates:**
- Installation/setup commands (verify they work)
- Development server startup instructions  
- API endpoint summary
- Technology stack changes
- Troubleshooting sections

**CLAUDE.md Updates:**
- Project context and instructions
- Development commands and workflows
- Server configuration details
- Database connection troubleshooting
- Pipeline and deployment information

**DEPLOYMENT.md Updates:**
- Environment configuration steps
- Azure deployment process
- Server file relationships (server.js vs server-production.js)
- Pipeline file mappings
- Production verification steps

### Step 3: Cross-File Synchronization

Ensure consistency across:
- API endpoint lists in multiple files
- Environment variable documentation
- Command examples and file paths
- Server configuration explanations
- Troubleshooting information

### Step 4: Validation

For each updated file:
- Test mentioned commands actually work
- Verify file paths exist
- Check that examples are current
- Ensure cross-references are accurate

Start by examining the codebase structure, then proceed to update each documentation file to reflect the current reality of the project.
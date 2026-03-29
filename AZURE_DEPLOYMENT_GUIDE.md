# Guardian MVP - Azure Deployment Guide - UPDATED 2025-08-21

## CRITICAL SUCCESS CONFIGURATION - PRODUCTION SERVER RESTORED

### Prerequisites - UPDATED 2025-08-21

1. **Azure Web App** created with:
   - **Runtime**: Node.js 20 LTS (v20.18.3 verified working)
   - **Module System**: CommonJS (enforced by package.production.json)
   - Operating System: Linux
   - App Service Plan: Basic B1 or higher

2. **Production Server Foundation (CRITICAL)**:
   - **Server File**: Must be exact copy of working `server.cjs` with minimal additions
   - **Static Serving**: Express middleware handles asset serving (`express.static('.')`)
   - **SPA Support**: Express fallback route for React Router (`app.get('*', ...)`)
   - **API Logic**: Identical authentication, JWT handling, and endpoints as development

3. **Azure SQL Database**:
   - Configure connection string in App Settings
   - Set `DATABASE_URL` environment variable

4. **Pipeline Configuration**:
   - Use `azure-pipelines.yml` for deployment (copies `server-production.js` → `server.js`)
   - Ensure Azure DevOps has permissions to deploy to your Web App

## Required Environment Variables

Set these in your Azure Web App Configuration:

```bash
NODE_ENV=production
PORT=8080
JWT_SECRET=your-super-secure-jwt-secret-key-here
DATABASE_URL=your-azure-sql-connection-string (optional)
```

## Common Deployment Issues & Solutions - CRITICAL UPDATES 2025-08-21

### 1. **CRITICAL: Production Server Startup Failures - RESOLVED**
**Error:** Server fails to start or returns 500 errors on `/api/health`, `/api/login`, `/api/test`
**Root Causes:** 
- ES Module vs CommonJS incompatibility in Node.js v20.18.3
- Over-engineered production configurations 
- Bun-specific features incompatible with Node.js production

**PROVEN SUCCESSFUL SOLUTION:**
1. **Foundation Approach**: Copy exact working `server.cjs` as production server foundation
2. **Minimal Additions**: Add ONLY essential production requirements:
   - Static serving: `app.use(express.static('.'))`
   - SPA routing: `app.get('*', (req, res) => res.sendFile(...))`
3. **Preserve API Logic**: Keep identical authentication, JWT, and endpoint logic unchanged
4. **Test Locally**: MUST verify with `node server.js` before Azure deployment

### 2. **Missing Dependencies Error**
**Error:** `Cannot find module '@prisma/client'` or similar
**Solution:** Use the provided `azure-deployment-package.json` which includes all required dependencies

### 3. **Static Files Not Found**
**Error:** `Application files not found` or 404 on frontend routes  
**Solution:** 
- Ensure Express static middleware is configured: `app.use(express.static('.'))`
- Verify `dist/` folder is properly copied in deployment pipeline
- Use Express SPA fallback route for React Router

### 4. **Database Connection Issues**
**Error:** `Database connection failed`
**Solution:** 
- Verify `DATABASE_URL` is set correctly
- Ensure Azure SQL allows connections from your Web App
- Run `npx prisma generate` in deployment

### 5. **App Won't Start (Legacy Issues)**
**Error:** Application fails to start
**Solution:**
- Check startup command is set to `npm start`
- Verify Node.js version is 20.x
- Ensure CommonJS module system (package.production.json)
- Check logs in Azure Portal

## Deployment Steps

1. **Use the new pipeline:** Replace your current `azure-pipelines.yml` with `azure-pipelines-mvp.yml`

2. **Environment Variables:** Set all required environment variables in Azure Portal

3. **Deploy:** Push to main branch to trigger deployment

4. **CRITICAL VERIFICATION (UPDATED 2025-08-21):** Check these endpoints after deployment:
   - ✅ `https://Guardian-ep-dev.azurewebsites.net/api/health` (Should show Node.js v20.18.3 status)
   - ✅ `https://Guardian-ep-dev.azurewebsites.net/api/login` (JWT authentication must work)  
   - ✅ `https://Guardian-ep-dev.azurewebsites.net/api/test` (Basic API functionality)
   - ✅ `https://Guardian-ep-dev.azurewebsites.net/` (Frontend loads without asset 404s)
   - ✅ React Router navigation works (SPA fallback route functional)

## Troubleshooting

1. **Check Application Logs:**
   - Go to Azure Portal → Your Web App → Log stream
   - Or use: `az webapp log tail --name YOUR-APP-NAME --resource-group YOUR-RG`

2. **Test Endpoints:**
   - `/api/health` - Shows server status
   - `/api/debug-env` - Shows environment configuration
   - `/api/test-db` - Tests database connection (if configured)

3. **Manual Deployment Test:**
   - Download the deployment zip from pipeline artifacts
   - Check if it contains: `azure-server.js`, `dist/`, `package.json`, `node_modules/`

## Production Considerations

1. **Security:**
   - Use strong JWT secret
   - Configure CORS properly
   - Enable HTTPS redirect in Azure

2. **Performance:**
   - Consider using Azure CDN for static files
   - Enable Application Insights for monitoring
   - Use appropriate App Service Plan size

3. **Database:**
   - Use Azure SQL Database with connection pooling
   - Configure backup and scaling policies
   - Consider using managed identities for authentication

## EMERGENCY RECOVERY PROTOCOL - ADDED 2025-08-21

If production server fails after deployment, use this proven recovery process:

### Immediate Recovery Steps:
1. **Copy Foundation**: Copy working `server.cjs` to `server-production.js`
2. **Add Production Essentials**: Add only these lines to `server-production.js`:
   ```javascript
   // Static file serving
   app.use(express.static('.'));
   
   // SPA fallback route (must be last route)
   app.get('*', (req, res) => {
     res.sendFile(path.join(__dirname, 'index.html'));
   });
   ```
3. **Test Locally**: Run `node server.js` (must work before deployment)
4. **Deploy**: Push to main branch to trigger pipeline
5. **Verify**: Check all critical endpoints are functional

### Prevention Rules:
- ❌ **NEVER over-engineer** production server configurations
- ❌ **NEVER modify** working API logic during production deployment  
- ❌ **NEVER skip** local Node.js testing before deployment
- ✅ **ALWAYS use** working `server.cjs` as production foundation
- ✅ **ALWAYS keep** production modifications minimal and targeted

## Files Modified for Deployment:

- ✅ `azure-deployment-package.json` - Production package.json with correct dependencies
- ✅ `package.production.json` - CommonJS module system enforcement (Critical 2025-08-21)
- ✅ `server-production.js` - Production server source based on working `server.cjs` foundation (Updated 2025-08-21)
- ✅ `azure-pipelines-mvp.yml` - Improved deployment pipeline
- ✅ `azure-server.js` - Fixed static file handling conflicts
- ✅ `AZURE_DEPLOYMENT_GUIDE.md` - This deployment guide
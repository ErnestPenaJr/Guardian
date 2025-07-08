# Guardian MVP - Azure Deployment Guide

## Prerequisites

1. **Azure Web App** created with:
   - Runtime: Node.js 20 LTS
   - Operating System: Linux
   - App Service Plan: Basic B1 or higher

2. **Azure SQL Database** (if using database features):
   - Configure connection string in App Settings
   - Set `DATABASE_URL` environment variable

3. **Pipeline Configuration**:
   - Use `azure-pipelines-mvp.yml` for deployment
   - Ensure Azure DevOps has permissions to deploy to your Web App

## Required Environment Variables

Set these in your Azure Web App Configuration:

```bash
NODE_ENV=production
PORT=8080
JWT_SECRET=your-super-secure-jwt-secret-key-here
DATABASE_URL=your-azure-sql-connection-string (optional)
```

## Common Deployment Issues & Solutions

### 1. **Missing Dependencies Error**
**Error:** `Cannot find module '@prisma/client'` or similar
**Solution:** Use the provided `azure-deployment-package.json` which includes all required dependencies

### 2. **Static Files Not Found**
**Error:** `Application files not found` or 404 on frontend routes
**Solution:** Ensure `dist/` folder is properly copied in deployment pipeline

### 3. **Database Connection Issues**
**Error:** `Database connection failed`
**Solution:** 
- Verify `DATABASE_URL` is set correctly
- Ensure Azure SQL allows connections from your Web App
- Run `npx prisma generate` in deployment

### 4. **App Won't Start**
**Error:** Application fails to start
**Solution:**
- Check startup command is set to `npm start`
- Verify Node.js version is 20.x
- Check logs in Azure Portal

## Deployment Steps

1. **Use the new pipeline:** Replace your current `azure-pipelines.yml` with `azure-pipelines-mvp.yml`

2. **Environment Variables:** Set all required environment variables in Azure Portal

3. **Deploy:** Push to main branch to trigger deployment

4. **Verify:** Check these endpoints after deployment:
   - `https://your-app.azurewebsites.net/api/health`
   - `https://your-app.azurewebsites.net/api/test`
   - `https://your-app.azurewebsites.net/` (should show login page)

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

## Files Modified for Deployment:

- ✅ `azure-deployment-package.json` - Production package.json with correct dependencies
- ✅ `azure-pipelines-mvp.yml` - Improved deployment pipeline
- ✅ `azure-server.js` - Fixed static file handling conflicts
- ✅ `AZURE_DEPLOYMENT_GUIDE.md` - This deployment guide
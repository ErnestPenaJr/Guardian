# Guardian MVP Module System Configuration

This project uses a **dual module system** to support both modern ES modules for local development and CommonJS for Azure/IIS deployment compatibility.

## File Structure

- `package.json` - **ES modules** for local development (`"type": "module"`)
- `package.production.json` - **CommonJS** for production deployment (`"type": "commonjs"`)
- `server.js` - **ES modules** server for local development
- `server.cjs` - **CommonJS** server for production deployment

## Local Development

- Uses ES modules (`import`/`export`)
- Run: `npm start` or `node server.js`
- Package.json has `"type": "module"`

## Production Deployment

- Uses CommonJS (`require`/`module.exports`)
- Azure pipeline automatically:
  1. Copies `server.cjs` → `server.js` in deployment
  2. Copies `package.production.json` → `package.json` in deployment
- Compatible with IIS/iisnode which requires CommonJS

## Why This Setup?

**Problem**: IIS/iisnode cannot load ES modules using `require()`, causing deployment failures.

**Solution**: 
- Keep modern ES modules for development
- Automatically convert to CommonJS for production
- No manual switching required

## Deployment Process

The Azure pipeline (`azure-pipelines.yml`) handles the conversion:

```yaml
# Copy production server (CommonJS)
cp server.cjs deployment/server.js

# Copy production package.json (CommonJS)  
cp package.production.json deployment/package.json
```

## Maintenance

When updating server logic:
1. ✅ Edit `server.js` (ES modules)
2. ✅ Copy changes to `server.cjs` (CommonJS)
3. ✅ Test both versions work

Both files should have identical functionality, just different import/export syntax.
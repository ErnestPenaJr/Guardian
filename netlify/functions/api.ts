// Single catch-all Function: wraps the whole Express API with serverless-http.
// netlify.toml rewrites /api/* and /logout to /.netlify/functions/api.
import serverless from 'serverless-http';
import app from '../../server/app.js';

export const handler = serverless(app);

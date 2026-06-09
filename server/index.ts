import 'dotenv/config';
import * as path from 'path';
import express from 'express';
import app from './app.js';

// Local / standalone entry point. On Netlify the static frontend is served by
// the CDN and only /api/* reaches the Function (netlify/functions/api.ts);
// this file is used for `node dist-server/index.js` and local dev.
const PORT = process.env.PORT || 3001;
const frontendDistPath = path.resolve(process.cwd(), 'dist');

// Serve the built frontend, then SPA fallback for client-side routes.
app.use(express.static(frontendDistPath));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not Found' });
  }
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Server environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Access the application at: http://localhost:${PORT}`);
});

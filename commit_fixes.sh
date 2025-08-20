#!/bin/bash

echo "🚀 Committing MIME type fixes and Assign Task Modal improvements..."

# Add all relevant files
git add -A

# Create commit with detailed message
git commit -m "fix: resolve MIME type errors and improve task assignment

- Fix production MIME type errors with intelligent environment detection
- Add proper Assign Task Modal replacing prompt-based interface  
- Synchronize all server files (server.cjs, server.js, server-production.js)
- Fix API interceptor warnings for public endpoints
- Improve development/production environment handling

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

echo "✅ Changes committed. Ready to push to trigger production deployment."
echo "Run: git push origin main"
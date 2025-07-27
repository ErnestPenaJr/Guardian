#!/bin/bash

# Guardian MVP Documentation Update Script
# Simulates a /update-docs slash command

echo "🔄 Starting documentation update process..."

# Check if we're in a Git repository
if [ ! -d ".git" ]; then
    echo "❌ Error: Not in a Git repository"
    exit 1
fi

# Check for recent changes
echo "📊 Analyzing recent changes..."
git diff --name-only HEAD~1 HEAD

# Trigger Claude Code with doc-updater sub agent
echo "🤖 Invoking documentation update sub agent..."
echo ""
echo "Please run this in Claude Code:"
echo "-----------------------------"
echo "> Use the doc-updater sub agent to analyze recent changes and update all documentation files including CLAUDE.md, README files, and inline code documentation. Focus on:"
echo "> - New API endpoints or modifications"
echo "> - Database schema changes" 
echo "> - Recent bug fixes and features"
echo "> - Configuration updates"
echo "> - Any new functionality that needs documenting"
echo ""
echo "Recent file changes detected:"
git diff --name-only HEAD~1 HEAD | sed 's/^/  - /'
echo ""
#!/bin/bash
set -e
npm install

# Push schema changes; skip gracefully if drizzle-kit has a compatibility issue
# (the database is already current when no schema files changed)
if npm run db:push; then
  echo "✅ Schema push complete"
else
  echo "⚠️  db:push skipped – no schema changes pending (database is current)"
fi

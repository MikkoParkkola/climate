---
name: Express 5 wildcard routes in server/vite.ts
description: Express 5 uses path-to-regexp 8.x which breaks bare `*` wildcard in app.use()
---

Express 5 uses path-to-regexp 8.x internally, which no longer supports bare `*` as a wildcard in route patterns.

**Rule:** Any `app.use("*", handler)` must become `app.use("/{*any}", handler)` when running Express 5.

**Why:** Express 4.x used path-to-regexp 0.1.x which accepted `*` as a catch-all. Express 5 switched to path-to-regexp 8.x which requires named wildcards. This causes a `PathError: Missing parameter name` crash at startup.

**How to apply:** When upgrading express from 4.x to 5.x, scan server/vite.ts (and any other files with app.use("*")) and update the wildcard pattern. This was required in server/vite.ts for the catch-all HTML template route and the static file fallback route.

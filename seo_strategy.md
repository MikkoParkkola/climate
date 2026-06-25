# SEO Strategy

## In scope
- Public marketing and tool pages served at `/`
- Public comparison page served at `/comparison`
- Search, social, and AI crawler visibility for the public web app shell

## Out of scope
- Authenticated dashboards and admin pages if introduced later
- API endpoints except where they affect crawlability of public routes
- Mockup and artifact sandboxes under `artifacts/`

## Target audience
- Users researching future climate conditions, climate risk, and location habitability

## Primary keywords
- climate projections
- climate projections by location
- future climate explorer
- climate comparison
- habitability forecast

## Architecture notes
- Current public experience is a Vite + React SPA served through a shared `client/index.html` shell
- Public routes found in scope: `/` and `/comparison`
- If more public routes are added, they should be prerendered or server-rendered so crawlers receive route-specific HTML

## Dismissed categories
- (None yet)

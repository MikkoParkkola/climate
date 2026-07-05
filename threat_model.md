# Threat Model

## Project Overview

This project is a public-facing climate projection web application deployed on Replit autoscale. The production stack is a React/Vite frontend served by an Express backend, with a Python climate-model runner (`grounded_model.py`) invoked from the Node server for compute-heavy forecasts and rankings. The backend can also use environment-backed API keys and a PostgreSQL database, but the currently mounted production routes are in `server/routes.ts`.

Assumptions for this scan:
- Only production-reachable code matters.
- `NODE_ENV` is `production` in deployment.
- TLS is provided by the platform.
- `artifacts/mockup-sandbox/` is a mockup sandbox and is not production.

## Assets

- **Application availability and compute budget** — public endpoints can trigger Python processes and outbound API calls. Abuse can exhaust CPU, memory, worker capacity, or third-party API quotas.
- **Environment secrets** — deployment secrets such as `NVIDIA_API_KEY` and database credentials must not be exposed to unauthenticated users or logs.
- **User-supplied secrets** — any API key submitted by a user for climate model access must be treated as sensitive and must not be logged or disclosed.
- **Database contents** — user records, saved comparisons, cached climate projections, and any stored API keys in PostgreSQL must remain protected from unauthorized access.
- **Server host integrity** — the Node process and Python runner must not execute attacker-controlled commands.

## Trust Boundaries

- **Browser to Express API** — all request bodies, query strings, and headers are attacker-controlled and must be validated server-side.
- **Express to Python runner** — data passed from TypeScript routes into `grounded_model.py` crosses into OS process execution and is high risk for injection or resource exhaustion.
- **Express to external APIs** — outbound requests to geocoding and climate providers consume secrets and quotas; user input must not turn these integrations into abuse primitives.
- **Express to PostgreSQL** — any future live database-backed routes must protect stored user data and secrets.
- **Public to internal/dead code boundary** — `server/routes.ts`, database-backed auth scaffolding, and `artifacts/mockup-sandbox/` should be ignored unless they are re-wired into production entry points.

## Scan Anchors

- **Production entry points**: `server/index.ts`, `server/routes.ts`, `server/vite.ts`, `client/src/App.tsx`, `client/src/pages/climate-app.tsx`, `client/src/pages/climate-comparison.tsx`.
- **Highest-risk code areas**: subprocess execution in `server/routes.ts`, Python CLI parsing in `grounded_model.py`, any secret handling in `/api/config`, and any future live DB-backed user-key routes.
- **Public surfaces**: `/api/config`, `/api/locations/search`, `/api/climate-projection`, `/api/climate/global-rankings`, `/`, `/comparison`.
- **Dev-only or currently non-live areas**: `artifacts/mockup-sandbox/`, Vite dev middleware behavior, and any mockup or legacy scaffolding not wired into `server/index.ts`.

## Threat Categories

### Spoofing

This application currently exposes public endpoints without user authentication. That is acceptable only for non-account operations, but any endpoint that reads or mutates user-specific data or consumes privileged third-party access must enforce server-side identity and entitlement checks. Secrets exposed through public config endpoints or accepted from clients must not be treated as proof of authorization.

### Tampering

The browser is untrusted. All fields sent to the API, especially coordinates, years, and any API-key-like parameters, must be strongly typed and constrained before they are used in outbound requests or process execution. Data passed into OS command strings must never be concatenated into shell commands.

### Information Disclosure

Deployment secrets, database credentials, and user-supplied API keys must not be returned to the browser, embedded into client code, or written to logs. Error responses must not include Python tracebacks, shell command strings, or other internal diagnostics that help attackers understand the host environment.

### Denial of Service

The most important risk in this project is abuse of expensive public endpoints. Any route that spawns Python, performs large computations, or calls external climate services must bound request rates, concurrency, runtime, and response size. Public endpoints must not allow arbitrary users to create unbounded compute load or burn third-party API quota.

### Elevation of Privilege

The server must preserve host integrity even when processing malicious input. Attacker-controlled request data must not be able to execute shell commands, influence process arguments in unsafe ways, or pivot into database or secret access. Any future admin or user-data features must enforce authorization on the server rather than relying on client behavior.

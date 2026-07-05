# Security Policy

fupit is an educational and research-focused climate projection app. Reports are
welcome when they help protect users, source data integrity, or the public
deployment.

## Reporting

If GitHub private vulnerability reporting is available for this repository, use
that channel first. Otherwise, open a GitHub issue with a concise description
and make the sensitive nature clear in the title. Keep reports limited to
information that is safe to publish.

Please include:

- Affected route, page, script, or dataset.
- Steps to reproduce in a local or non-production environment.
- Expected impact.
- Suggested fix, if known.

## Scope

In scope:

- API issues that could expose cache data, deployment metadata, or user
  requests.
- Server-side command execution, path traversal, injection, or denial-of-service
  issues.
- Source-registry, artifact-hash, or cache-version bypasses that could cause
  ungrounded climate values to be served.

Out of scope:

- Reports requiring private deployment access.
- Automated scanner noise without a concrete exploit path.
- Issues in upstream services that should be reported to those providers.

## Scientific Integrity

Data integrity issues are treated seriously even when they are not traditional
security bugs. If a report shows that the app can serve unregistered,
untraceable, stale, or fabricated climate output, file it as a science or data
question and include the exact endpoint, input, and observed response.

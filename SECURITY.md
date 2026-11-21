# Security policy

## Reporting a vulnerability

If GitHub private vulnerability reporting is enabled, use **Security → Advisories → Report a vulnerability** in the [FeedbackHub repository](https://github.com/princewill86/feedbackhub). If that option is unavailable, open a GitHub issue asking for a private security contact. Keep vulnerability details, credentials, and personal information out of the public issue. [GitHub's private reporting guide](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/report-privately)

In the private report, include the affected commit or version, the component involved, the impact, and enough information to reproduce the behavior in an authorized test environment. Remove secrets and real customer data from any attachments. Coordinate public disclosure with the maintainer after a fix is available.

The current `main` branch is the target for security fixes. Operators of older revisions or forks should review fixes and apply the relevant updates to their deployment.

## Deployment

- Use the canonical HTTPS origin for `ORIGIN` and `BETTER_AUTH_URL`. Configure the reverse proxy to provide a trusted client address for rate limiting.
- Set a unique `BETTER_AUTH_SECRET` and keep mail, billing, and signing credentials in server-side configuration. Keep database credentials restricted to the application and release tooling.
- Apply database migrations and install security updates before exposing an instance publicly. Back up PostgreSQL and verify that you can restore it.
- Reserve demo accounts and payment test credentials for disposable development environments. Review the public board, widget origin, and webhook destination settings before publishing.

# Contributing to FeedbackHub

## Getting started

Follow the [local development setup](README.md#local-development) with Node.js 22 and a disposable PostgreSQL database. Use a separate branch for each change. For a substantial feature or architectural change, open an issue first to agree on scope.

## Making changes

- Keep workspace authorization checks on the server and scope workspace queries to the authorized workspace.
- When you change the database schema, run `npm run db:generate` and commit the generated migration and metadata. Test against a fresh database and, where practical, one with existing data.
- Update documentation when behavior, setup, or environment variables change. Use synthetic examples for data and configuration.
- Handle security findings through the [security policy](SECURITY.md).

## Verifying a pull request

Run `npm run check` and `npm run build`. With the app running against a disposable database, run `node --test tests/auth.integration.mjs`. Set `TEST_ORIGIN` if the app is listening at an address other than `http://localhost:5173`.

Describe the behavior change, how you tested it, and any migration or rollout steps in the pull request. Add screenshots for visible UI changes and include mobile layouts where relevant. Keep unrelated changes in separate pull requests.

By submitting a contribution, you agree to license it under the project's [MIT License](LICENSE).

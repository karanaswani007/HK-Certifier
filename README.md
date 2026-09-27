# HK Certifier

Create. Deliver. Verify.

A multi-tenant certificate platform for internships, workshops, colleges and training programs. Developed by [HK SoftTech](https://hksofttech.vercel.app).

Organizations register, get approved, import students, design templates, generate unique certificates with QR verification, email them, and track everything.

## Product surfaces

- Marketing site and public verification (`/`, `/verify/:id`) — no account required
- Organization app (`/app`) — programs, students, CSV import, canvas editor, bulk generation, email outbox, analytics, billing
- HK SoftTech admin (`/`) — approvals, plans, payments, flags, audit, support

## Architecture

TanStack Start (React 19) with server functions, Neon Postgres (PGLite in preview), Better Auth (email/password + Google + X), and a service layer under `src/lib/server`.

Background jobs are **resumable batches** (`processGenerationJob` handles 25 certificates per call) so generation stays compatible with serverless runtimes.

Provider abstractions:

- **Email** — log/outbox today; swap in Resend / SendGrid / SMTP without changing job logic
- **Storage** — certificate layouts and QR SVGs stored as text; object storage can replace `file_assets`
- **Payments** — QR + UTR workflow behind `payment_requests`; a gateway can replace the QR step
- **AI** — xAI `grok-4.5` template JSON, always opened in the editor before publish

## Roles

| Role | Access |
|---|---|
| Platform admin | `/admin` — first signed-in user is bootstrapped |
| Organization owner / admin / editor / viewer | `/app` scoped to their org |
| Public | `/verify/:certificateId` |

Multi-tenancy is enforced in server functions (membership + `organization_id` filters). The UI is not the security boundary.

## Local / preview

The preview database is embedded Postgres. Sign in with Google, X, or email/password. The first account becomes platform admin and owner of **Demo Tech Institute** (programs, students, templates, and sample certificates).

Try public verification with `HKC-2026-IOT-A8F93KD2`.

## Environment (injected on deploy — do not commit secrets)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres |
| `VITE_AUTH_ENABLED` | Set by the platform when auth is provisioned |
| `ADMIN_EMAIL` | Optional default platform admin email |
| `ADMIN_PASSWORD` | Optional default platform admin password |
| `ADMIN_NAME` | Optional platform admin display name |
| `XAI_API_KEY` | Optional AI templates |
| Better Auth / Grok broker vars | Injected for production sign-in |

If `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set, the first platform admin is created automatically on startup. After login, the admin can change their own password from **Admin → Settings → Change admin password**.

Payment UPI ID, email from-name and similar knobs live in **Admin → Settings**.

## Tests

Unit tests cover variable replacement, certificate IDs, CSV validation and plan limits.

## Deploy

The app is a standard Vite / TanStack Start Vercel project. `npm run build` applies `migrations/*.sql` to Neon.

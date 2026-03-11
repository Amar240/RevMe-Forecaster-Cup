# Staging Env Sheet

Use this sheet for the first AWS staging deployment. If you operate RevME solo, you are the owner for every row.

| Variable | Required | Example shape | Real value comes from | Owner |
| --- | --- | --- | --- | --- |
| `NODE_ENV` | Yes | `production` | Docker/runtime config | Platform |
| `NEXT_PUBLIC_APP_URL` | Yes | `https://staging.revme.example.com` | ALB DNS or mapped staging domain | Platform |
| `DATABASE_URL` | Yes | `postgresql://user:pass@revme-staging.xxxx.us-east-2.rds.amazonaws.com:5432/revme?schema=public&sslmode=require` | RDS endpoint + app DB credentials | Platform / Database |
| `SMTP_HOST` | Yes for email flows | `email-smtp.us-east-2.amazonaws.com` | SES SMTP settings or chosen provider | Email / Ops |
| `SMTP_PORT` | Yes for email flows | `587` | SES SMTP settings or chosen provider | Email / Ops |
| `SMTP_USER` | Yes for email flows | `AKIAXXXXXXXX` | SES SMTP credentials or chosen provider | Email / Ops |
| `SMTP_PASS` | Yes for email flows | `long-generated-secret` | SES SMTP credentials or chosen provider | Email / Ops |
| `SMTP_FROM` | Recommended | `no-reply@staging.revme.example.com` | Verified sender/domain policy | Email / Ops |
| `DEMO_REQUEST_NOTIFY_EMAIL` | Optional | `ops@revme.example.com` | Product/ops mailbox | Product / Ops |
| `NEXT_TELEMETRY_DISABLED` | Recommended | `1` | Docker/runtime config | Platform |

## Deployment Notes
- `NEXT_PUBLIC_APP_URL` must match the exact external `https` origin used by the ALB.
- Use `npx prisma migrate status` before deploy and `npx prisma migrate deploy` during release.
- Staging and production must never use `npx prisma db push`.
- Health checks should target `GET /api/health`.

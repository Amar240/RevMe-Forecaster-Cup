# AWS Staging Deployment Path

This document defines the immediate AWS baseline for RevME staging.

## Target Baseline
- Region: `us-east-2`
- Entry point: public `ALB`
- App host: private `EC2` instance running Docker
- Database: private `RDS PostgreSQL 16`
- Access: `SSM Session Manager` only, no direct SSH
- App readiness endpoint: `GET /api/health`

This is the single staging deployment path for now. Do not add alternate staging flows until this one is proven.

## Migration Rules
- Local development uses `npx prisma migrate dev`.
- Staging and production use `npx prisma migrate deploy` only.
- Staging and production must never use `npx prisma db push`.
- Pre-deploy verification command: `npx prisma migrate status`.
- Release migration command: `npx prisma migrate deploy`.

## Staging Deployment Sequence
1. Build the application image from the current production `Dockerfile`.
2. Load the staging environment values from the staging env sheet and secrets store.
3. Run `npx prisma migrate status` against the staging RDS database before replacing the running container.
4. Start or replace the app container; the production startup path runs `npx prisma migrate deploy` before `npm start`.
5. Verify `GET /api/health` directly on the container and through the ALB target group.
6. Run the must-pass staging checks in `docs/STAGING_GO_NO_GO.md`.

## AWS Notes
- Configure the ALB to redirect `HTTP -> HTTPS`.
- Set `NEXT_PUBLIC_APP_URL` to the exact staging hostname, including `https://`.
- Production sessions use an `httpOnly`, `secure`, `sameSite=lax` cookie with a `__Secure-` prefix.
- Keep the database private to the app security group.
- Store application secrets in AWS Systems Manager Parameter Store or Secrets Manager.
- Send operational access through Session Manager, not SSH keys.

## Operational Baseline
- Enable automated RDS backups and snapshots.
- Forward container logs to CloudWatch.
- Keep rollback steps documented before each deployment.
- Do not promote a build until the staging go/no-go checklist passes.

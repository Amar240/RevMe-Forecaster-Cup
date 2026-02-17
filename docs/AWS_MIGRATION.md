# AWS Migration Path (RevME Forecaster Cup)

This guide outlines a clean path from local development to AWS using MySQL.

## Recommended Architecture
- App: Next.js 14 (App Router)
- Database: Amazon RDS for MySQL 8.0
- Secrets: AWS Secrets Manager or SSM Parameter Store
- Files/exports: Amazon S3
- Logs/metrics: CloudWatch

## Local Development (Best Practice)
1. Use `.env.local` for secrets (never commit real credentials).
2. Use Prisma migrations to manage schema.
   - Local: `npx prisma migrate dev`
3. Keep app and database credentials separate from code.

## Staging/Production Environments
1. Create separate RDS instances or databases for staging and production.
2. Use different `DATABASE_URL` values per environment.
3. Apply migrations using `npx prisma migrate deploy` during CI/CD.

## Deployment Options
### Option A: Vercel + RDS (Fastest)
- Host Next.js on Vercel.
- Use RDS MySQL for the database.
- Set `DATABASE_URL` and SMTP secrets in Vercel env vars.
- Run `prisma migrate deploy` in build step.

### Option B: AWS ECS Fargate + RDS (Full AWS)
- Containerize app (Dockerfile) and deploy on ECS Fargate.
- Use RDS MySQL for database.
- Store secrets in Secrets Manager.
- Use a CI/CD pipeline (GitHub Actions or CodePipeline).

### Option C: Elastic Beanstalk + RDS (Simpler AWS)
- Deploy Next.js to Elastic Beanstalk.
- Use RDS MySQL.
- Configure environment variables in EB console.

## Database Migration Steps (Local -> RDS)
1. Create RDS MySQL (8.0).
2. Create DB and user (least privilege).
3. Set `DATABASE_URL` to the RDS endpoint.
4. Run `npx prisma migrate deploy`.
5. (Optional) Seed: `npx prisma db seed`.

## Security Best Practices
- Do not use root for application access.
- Rotate passwords if shared.
- Restrict RDS access to app subnets/security groups.
- Use TLS connections to RDS.

## Operational Checklist
- [ ] Backups enabled on RDS
- [ ] Automated snapshots
- [ ] CloudWatch alarms for CPU/storage
- [ ] Prisma migrations run in CI/CD

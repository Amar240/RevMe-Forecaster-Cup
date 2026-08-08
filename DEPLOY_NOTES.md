# Deploy Notes

Use this file to track all deployment decisions and runtime values for each environment.

## Environment
- Region:
- Domain:
- Environment name: `staging` / `production`
- Release tag/commit:

## Networking
- VPC ID:
- ALB DNS:
- ALB Security Group:
- App Security Group:
- DB Security Group:

## Database
- Engine/version:
- Endpoint:
- Database name:
- Migration command used:
- Last snapshot ID:

## App Runtime
- Host type (EC2/ECS):
- App URL:
- Health endpoint:
- Environment variables source (SSM/Secrets Manager):
- When `BEDROCK_IMPORT_ASSIST=true`, grant the instance role `bedrock:InvokeModel`
  only for the configured inference-profile ARN and its permitted destination-model ARNs.
  The default is `us.anthropic.claude-haiku-4-5-20251001-v1:0`, which may route
  roster data among US regions. Deployments requiring one-region processing must
  override `BEDROCK_IMPORT_MODEL` with an approved regional model or profile.
- After deploying new import-assist schemas, run `npm run prewarm:import-assist`
  once with the production Bedrock role. The task sends synthetic data only.

### Local Bedrock testing with an AWS profile

Do not place AWS access keys in `.env` or `.env.docker`. Authenticate the AWS CLI,
then add the optional read-only profile mount when starting the development stack:

```bash
aws sso login --profile <profile>
AWS_PROFILE=<profile> docker compose -f docker-compose.dev.yml -f docker-compose.aws.yml up -d --build
```

The override mounts `~/.aws` read-only inside the app container and enables the
AWS SDK shared-config loader. Production continues to use the EC2 instance role.

## Monitoring
- CloudWatch dashboard:
- Alarm names:
- Notification channel:

## Rollback
- Previous release tag:
- Rollback command:
- DB rollback/snapshot restore procedure:

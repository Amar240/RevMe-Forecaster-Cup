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
  only for the ARN of `BEDROCK_IMPORT_MODEL` (default: `anthropic.claude-3-haiku-20240307-v1:0`).

## Monitoring
- CloudWatch dashboard:
- Alarm names:
- Notification channel:

## Rollback
- Previous release tag:
- Rollback command:
- DB rollback/snapshot restore procedure:

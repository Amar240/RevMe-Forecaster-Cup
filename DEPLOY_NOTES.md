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

## Exact round-transition scheduling

RevME does not poll the database every minute. When automatic mode is enabled,
the app creates one-time EventBridge Scheduler events at the known round open and
close boundaries. Scheduler invokes a small Lambda, and Lambda asks RevME to
reconcile the season. RevME—not the event payload—decides the authoritative state.

1. Store the same long random `CRON_SECRET` used by the app in Secrets Manager.
2. Deploy the included stack:

```bash
aws cloudformation deploy \
  --region us-east-2 \
  --stack-name revme-round-transitions \
  --template-file aws/round-transition-scheduler/template.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    AppBaseUrl=https://rev-me.org \
    CronSecretArn=<secret-arn> \
    AppInstanceRoleName=revme-staging-ec2-role \
    AlarmTopicArn=<optional-sns-topic-arn>
```

3. Copy the stack outputs into `/root/revme-prod.env` as:
   `ROUND_AUTOMATION_LAMBDA_ARN`, `ROUND_AUTOMATION_SCHEDULER_ROLE_ARN`,
   `ROUND_AUTOMATION_DLQ_ARN`, and `ROUND_AUTOMATION_SCHEDULE_GROUP`.
4. The stack attaches a least-privilege inline policy to the named EC2 instance
   role: schedule management is limited to `revme-*` schedules in this group,
   and `iam:PassRole` is limited to the emitted Scheduler target role. The target
   role itself can invoke only the emitted Lambda and write only to the emitted
   DLQ.
5. Restart the app container, open Admin → Season, switch to **Automatic**, and
   verify that the UI reports a synchronized next boundary.

One-time schedules use `FlexibleTimeWindow=OFF`, retry up to five times for one
hour, delete themselves after completion, and send exhausted events to the DLQ.
Changing to manual mode increments the season generation, so already-created
events are harmlessly recorded as stale and skipped. Submission deadlines remain
server-enforced even if AWS delivery is delayed.

## Rollback
- Previous release tag:
- Rollback command:
- DB rollback/snapshot restore procedure:

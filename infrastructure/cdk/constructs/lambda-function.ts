import path from 'node:path'
import { Duration, RemovalPolicy, aws_iam as iam, aws_lambda as lambda, aws_lambda_nodejs as nodejs, aws_logs as logs } from 'aws-cdk-lib'
import type { Construct } from 'constructs'

export interface ServiceFunctionProps {
  entry: string
  serviceName: string
  stage: string
  environment?: Record<string, string>
  timeoutSeconds?: number
  memorySize?: number
  existingRoleArn?: string
  logRetentionDays?: number
  retainLogs?: boolean
}

function retention(days: number): logs.RetentionDays {
  const values: Record<number, logs.RetentionDays> = {
    7: logs.RetentionDays.ONE_WEEK,
    30: logs.RetentionDays.ONE_MONTH,
    90: logs.RetentionDays.THREE_MONTHS
  }
  const value = values[days]
  if (!value) throw new Error(`Unsupported log retention: ${days} days`)
  return value
}

export class ServiceFunction extends nodejs.NodejsFunction {
  constructor(scope: Construct, id: string, props: ServiceFunctionProps) {
    const functionName = `cloud-learning-${props.stage}-${props.serviceName}-${id.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}`.slice(0, 64)
    const role = props.existingRoleArn
      ? iam.Role.fromRoleArn(scope, `${id}ExistingRole`, props.existingRoleArn, { mutable: false })
      : new iam.Role(scope, `${id}Role`, { assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com') })
    const logGroup = new logs.LogGroup(scope, `${id}Logs`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: retention(props.logRetentionDays ?? 7),
      removalPolicy: props.retainLogs ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY
    })
    if (!props.existingRoleArn) logGroup.grantWrite(role)
    super(scope, id, {
      functionName,
      entry: path.resolve(process.cwd(), props.entry),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      tracing: lambda.Tracing.ACTIVE,
      timeout: Duration.seconds(props.timeoutSeconds ?? 15),
      memorySize: props.memorySize ?? 256,
      role,
      logGroup,
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        APP_STAGE: props.stage,
        SERVICE_NAME: props.serviceName,
        ...props.environment
      },
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node24',
        externalModules: []
      }
    })
  }
}

import { CfnOutput, Duration, RemovalPolicy, Stack, aws_apigateway as apigateway, aws_iam as iam, aws_s3 as s3 } from 'aws-cdk-lib'
import type { StackProps } from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import type { StageConfig } from './config.js'

export interface FoundationStackProps extends StackProps { config: StageConfig }

export class FoundationStack extends Stack {
  readonly dataBucket: s3.Bucket
  readonly apiGatewayLoggingEnabled: boolean

  constructor(scope: Construct, id: string, props: FoundationStackProps) {
    super(scope, id, props)
    const destroy = props.config.removalPolicy === 'destroy'
    const constrainedLab = Boolean(props.config.existingLambdaRoleArn)
    this.apiGatewayLoggingEnabled = !constrainedLab
    this.dataBucket = new s3.Bucket(this, 'DataBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      autoDeleteObjects: destroy && !constrainedLab,
      removalPolicy: destroy && !constrainedLab ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
      lifecycleRules: [{ id: 'ArchiveLifecycle', transitions: [{ storageClass: s3.StorageClass.INFREQUENT_ACCESS, transitionAfter: Duration.days(30) }] }]
    })
    if (this.apiGatewayLoggingEnabled) {
      const cloudWatchRole = new iam.Role(this, 'ApiGatewayCloudWatchRole', {
        assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
        managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonAPIGatewayPushToCloudWatchLogs')]
      })
      new apigateway.CfnAccount(this, 'ApiGatewayAccount', { cloudWatchRoleArn: cloudWatchRole.roleArn })
    }
    new CfnOutput(this, 'DataBucketName', { value: this.dataBucket.bucketName })
    new CfnOutput(this, 'ApiGatewayLoggingEnabled', { value: String(this.apiGatewayLoggingEnabled) })
  }
}

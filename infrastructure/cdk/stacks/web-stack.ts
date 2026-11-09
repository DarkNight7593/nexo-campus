import path from 'node:path'
import { CfnOutput, Duration, RemovalPolicy, Stack, aws_cloudfront as cloudfront, aws_cloudfront_origins as origins, aws_iam as iam, aws_s3 as s3, aws_s3_deployment as deployment } from 'aws-cdk-lib'
import type { StackProps } from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import type { StageConfig } from './config.js'

export interface WebStackProps extends StackProps { config: StageConfig }

export class WebStack extends Stack {
  readonly bucket: s3.Bucket
  readonly distribution: cloudfront.Distribution
  readonly webUrl: string

  constructor(scope: Construct, id: string, props: WebStackProps) {
    super(scope, id, props)
    const destroy = props.config.removalPolicy === 'destroy'
    const constrainedLab = Boolean(props.config.existingLambdaRoleArn)
    const deploymentRole = props.config.existingLambdaRoleArn
      ? iam.Role.fromRoleArn(this, 'ExistingWebDeploymentRole', props.config.existingLambdaRoleArn, { mutable: false })
      : undefined
    this.bucket = new s3.Bucket(this, 'WebBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      autoDeleteObjects: destroy && !constrainedLab,
      removalPolicy: destroy && !constrainedLab ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN
    })
    const responseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeaders', {
      responseHeadersPolicyName: `cloud-learning-${props.config.stage}-security-headers`,
      securityHeadersBehavior: {
        contentSecurityPolicy: {
          contentSecurityPolicy: `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://*.execute-api.${props.config.region}.amazonaws.com https://*.auth.${props.config.region}.amazoncognito.com`,
          override: true
        },
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
        referrerPolicy: { referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN, override: true },
        strictTransportSecurity: { accessControlMaxAge: Duration.days(365), includeSubdomains: false, preload: false, override: true }
      }
    })
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        compress: true,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy
      },
      errorResponses: [403, 404].map((httpStatus) => ({
        httpStatus,
        responseHttpStatus: 200,
        responsePagePath: '/index.html',
        ttl: Duration.seconds(0)
      }))
    })
    new deployment.BucketDeployment(this, 'DeployWeb', {
      sources: [deployment.Source.asset(path.resolve(process.cwd(), '../../apps/web/dist'))],
      destinationBucket: this.bucket,
      distribution: this.distribution,
      distributionPaths: ['/*'],
      prune: true,
      role: deploymentRole
    })
    this.webUrl = `https://${this.distribution.distributionDomainName}`
    new CfnOutput(this, 'WebUrl', { value: this.webUrl })
    new CfnOutput(this, 'FrontendBucketName', { value: this.bucket.bucketName })
    new CfnOutput(this, 'DistributionId', { value: this.distribution.distributionId })
  }
}

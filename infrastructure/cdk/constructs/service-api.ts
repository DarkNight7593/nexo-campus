import {
  RemovalPolicy,
  aws_apigateway as apigateway,
  aws_cognito as cognito,
  aws_lambda as lambda,
  aws_logs as logs
} from 'aws-cdk-lib'
import { Construct } from 'constructs'

export interface ServiceApiProps {
  serviceName: string
  stage: string
  userPool: cognito.IUserPool
  allowedOrigins: string[]
  enableExecutionLogging: boolean
  logRetentionDays: number
  retainLogs: boolean
  throttlingRateLimit: number
  throttlingBurstLimit: number
}

function retention(days: number): logs.RetentionDays {
  const values: Record<number, logs.RetentionDays> = {
    7: logs.RetentionDays.ONE_WEEK,
    30: logs.RetentionDays.ONE_MONTH,
    90: logs.RetentionDays.THREE_MONTHS
  }
  const value = values[days]
  if (!value) throw new Error(`Unsupported API log retention: ${days} days`)
  return value
}

export class ServiceApi extends Construct {
  readonly api: apigateway.RestApi
  readonly authorizer: apigateway.CognitoUserPoolsAuthorizer

  constructor(scope: Construct, id: string, props: ServiceApiProps) {
    super(scope, id)
    const accessLogs = props.enableExecutionLogging
      ? new logs.LogGroup(this, 'AccessLogs', {
          logGroupName: `/aws/apigateway/cloud-learning-${props.stage}-${props.serviceName}`,
          retention: retention(props.logRetentionDays),
          removalPolicy: props.retainLogs ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY
        })
      : undefined
    this.api = new apigateway.RestApi(this, 'Api', {
      restApiName: `${props.stage}-${props.serviceName}-api`,
      description: `${props.serviceName} service for ${props.stage}`,
      deployOptions: {
        stageName: props.stage,
        tracingEnabled: true,
        metricsEnabled: true,
        loggingLevel: props.enableExecutionLogging ? apigateway.MethodLoggingLevel.INFO : apigateway.MethodLoggingLevel.OFF,
        dataTraceEnabled: false,
        throttlingRateLimit: props.throttlingRateLimit,
        throttlingBurstLimit: props.throttlingBurstLimit,
        ...(accessLogs ? {
          accessLogDestination: new apigateway.LogGroupLogDestination(accessLogs),
          accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
            caller: false,
            httpMethod: true,
            ip: true,
            protocol: true,
            requestTime: true,
            resourcePath: true,
            responseLength: true,
            status: true,
            user: false
          })
        } : {})
      },
      defaultCorsPreflightOptions: {
        allowOrigins: props.allowedOrigins,
        allowHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key'],
        allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS']
      },
      // API Gateway's CloudWatch role is regional and is managed once by FoundationStack.
      cloudWatchRole: false,
      endpointConfiguration: { types: [apigateway.EndpointType.REGIONAL] }
    })
    this.authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [props.userPool],
      authorizerName: `${props.stage}-${props.serviceName}-authorizer`
    })
    for (const [id, type] of [['Default4xx', apigateway.ResponseType.DEFAULT_4XX], ['Default5xx', apigateway.ResponseType.DEFAULT_5XX]] as const) {
      this.api.addGatewayResponse(id, {
        type,
        responseHeaders: {
          'Access-Control-Allow-Origin': `'${props.allowedOrigins[0]}'`,
          'Access-Control-Allow-Headers': "'Authorization,Content-Type,Idempotency-Key'"
        }
      })
    }
  }

  addRoute(path: string, method: string, handler: lambda.IFunction, authenticated = true): void {
    const resource = this.api.root.resourceForPath(path)
    resource.addMethod(method, new apigateway.LambdaIntegration(handler, { proxy: true }), authenticated ? {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    } : undefined)
  }
}

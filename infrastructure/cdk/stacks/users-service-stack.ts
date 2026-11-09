import { CfnOutput, Stack } from 'aws-cdk-lib'
import type { StackProps } from 'aws-cdk-lib'
import type { IFunction } from 'aws-cdk-lib/aws-lambda'
import type { IUserPool } from 'aws-cdk-lib/aws-cognito'
import type { Construct } from 'constructs'
import { createServiceTable } from '../constructs/dynamodb-table.js'
import { ServiceFunction } from '../constructs/lambda-function.js'
import { ServiceApi } from '../constructs/service-api.js'
import type { StageConfig } from './config.js'

export interface UsersServiceStackProps extends StackProps { config: StageConfig; userPool: IUserPool }

export class UsersServiceStack extends Stack {
  readonly functions: IFunction[] = []
  readonly apiUrl: string

  constructor(scope: Construct, id: string, props: UsersServiceStackProps) {
    super(scope, id, props)
    const table = createServiceTable(this, 'ProfilesTable', {
      tableName: `cloud-learning-${props.config.stage}-profiles`, partitionKey: 'tenantId', sortKey: 'userId', retain: props.config.removalPolicy === 'retain'
    })
    const api = new ServiceApi(this, 'UsersApi', {
      serviceName: 'users', stage: props.config.stage, userPool: props.userPool, allowedOrigins: props.config.allowedOrigins,
      enableExecutionLogging: !props.config.existingLambdaRoleArn, logRetentionDays: props.config.logRetentionDays, retainLogs: props.config.removalPolicy === 'retain',
      throttlingRateLimit: props.config.apiThrottling.rateLimit, throttlingBurstLimit: props.config.apiThrottling.burstLimit
    })
    const make = (name: string, folder: string, actions: string[]) => {
      const fn = new ServiceFunction(this, name, {
        entry: `../../services/users-service/src/functions/${folder}/handler.ts`, serviceName: 'users', stage: props.config.stage,
        existingRoleArn: props.config.existingLambdaRoleArn, logRetentionDays: props.config.logRetentionDays, retainLogs: props.config.removalPolicy === 'retain',
        environment: { PROFILES_TABLE: table.tableName, CORS_ALLOWED_ORIGIN: props.config.allowedOrigins[0]! }
      })
      table.grant(fn, ...actions)
      this.functions.push(fn); return fn
    }
    api.addRoute('/profiles', 'POST', make('CreateProfile', 'create-profile', ['dynamodb:PutItem']))
    api.addRoute('/profiles/me', 'GET', make('GetProfile', 'get-profile', ['dynamodb:GetItem']))
    api.addRoute('/profiles', 'GET', make('ListUsers', 'list-users', ['dynamodb:Query']))
    api.addRoute('/profiles/me', 'PATCH', make('UpdateProfile', 'update-profile', ['dynamodb:GetItem', 'dynamodb:PutItem']))
    this.apiUrl = api.api.url
    new CfnOutput(this, 'UsersApiUrl', { value: this.apiUrl })
    new CfnOutput(this, 'ProfilesTableName', { value: table.tableName })
  }
}

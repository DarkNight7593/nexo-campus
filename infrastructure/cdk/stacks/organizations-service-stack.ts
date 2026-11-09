import { CfnOutput, Stack } from 'aws-cdk-lib'
import type { StackProps } from 'aws-cdk-lib'
import type { IFunction } from 'aws-cdk-lib/aws-lambda'
import type { IUserPool } from 'aws-cdk-lib/aws-cognito'
import type { Construct } from 'constructs'
import { createServiceTable } from '../constructs/dynamodb-table.js'
import { ServiceFunction } from '../constructs/lambda-function.js'
import { ServiceApi } from '../constructs/service-api.js'
import type { StageConfig } from './config.js'

export interface OrganizationsServiceStackProps extends StackProps { config: StageConfig; userPool: IUserPool }

export class OrganizationsServiceStack extends Stack {
  readonly functions: IFunction[] = []
  readonly apiUrl: string

  constructor(scope: Construct, id: string, props: OrganizationsServiceStackProps) {
    super(scope, id, props)
    const table = createServiceTable(this, 'OrganizationsTable', {
      tableName: `cloud-learning-${props.config.stage}-organizations`, partitionKey: 'organizationId', retain: props.config.removalPolicy === 'retain'
    })
    const api = new ServiceApi(this, 'OrganizationsApi', {
      serviceName: 'organizations', stage: props.config.stage, userPool: props.userPool, allowedOrigins: props.config.allowedOrigins,
      enableExecutionLogging: !props.config.existingLambdaRoleArn, logRetentionDays: props.config.logRetentionDays, retainLogs: props.config.removalPolicy === 'retain',
      throttlingRateLimit: props.config.apiThrottling.rateLimit, throttlingBurstLimit: props.config.apiThrottling.burstLimit
    })
    const make = (name: string, folder: string, actions: string[]) => {
      const fn = new ServiceFunction(this, name, {
        entry: `../../services/organizations-service/src/functions/${folder}/handler.ts`, serviceName: 'organizations', stage: props.config.stage,
        existingRoleArn: props.config.existingLambdaRoleArn, logRetentionDays: props.config.logRetentionDays, retainLogs: props.config.removalPolicy === 'retain',
        environment: { ORGANIZATIONS_TABLE: table.tableName, CORS_ALLOWED_ORIGIN: props.config.allowedOrigins[0]! }
      })
      table.grant(fn, ...actions)
      this.functions.push(fn); return fn
    }
    api.addRoute('/organizations', 'POST', make('CreateOrganization', 'create-organization', ['dynamodb:PutItem']))
    api.addRoute('/organizations/{organizationId}', 'GET', make('GetOrganization', 'get-organization', ['dynamodb:GetItem']))
    api.addRoute('/organizations', 'GET', make('ListOrganizations', 'list-organizations', ['dynamodb:GetItem']))
    api.addRoute('/organizations/{organizationId}', 'PATCH', make('UpdateOrganization', 'update-organization', ['dynamodb:GetItem', 'dynamodb:PutItem']))
    this.apiUrl = api.api.url
    new CfnOutput(this, 'OrganizationsApiUrl', { value: this.apiUrl })
    new CfnOutput(this, 'OrganizationsTableName', { value: table.tableName })
  }
}

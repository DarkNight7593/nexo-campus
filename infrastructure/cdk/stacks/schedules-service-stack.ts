import { CfnOutput, Stack, aws_dynamodb as dynamodb, aws_iam as iam, aws_opensearchserverless as aoss } from 'aws-cdk-lib'
import type { StackProps } from 'aws-cdk-lib'
import type { IFunction } from 'aws-cdk-lib/aws-lambda'
import type { IUserPool } from 'aws-cdk-lib/aws-cognito'
import type { ITable } from 'aws-cdk-lib/aws-dynamodb'
import type { Construct } from 'constructs'
import { createServiceTable } from '../constructs/dynamodb-table.js'
import { ServiceFunction } from '../constructs/lambda-function.js'
import { ServiceApi } from '../constructs/service-api.js'
import { createDeadLetterQueue } from '../constructs/dead-letter-queue.js'
import { connectStreamWorker } from '../constructs/stream-worker.js'
import type { StageConfig } from './config.js'

export interface SchedulesServiceStackProps extends StackProps { config: StageConfig; userPool: IUserPool; coursesTable: ITable; openSearchEndpoint: string; openSearchArn: string; openSearchCollectionName: string }

export class SchedulesServiceStack extends Stack {
  readonly functions: IFunction[] = []
  readonly apiUrl: string
  readonly table: dynamodb.Table

  constructor(scope: Construct, id: string, props: SchedulesServiceStackProps) {
    super(scope, id, props)
    const table = this.table = createServiceTable(this, 'SchedulesTable', {
      tableName: `cloud-learning-${props.config.stage}-schedules`, partitionKey: 'tenantCourseId', sortKey: 'scheduleId', stream: true, retain: props.config.removalPolicy === 'retain'
    })
    const api = new ServiceApi(this, 'SchedulesApi', {
      serviceName: 'schedules', stage: props.config.stage, userPool: props.userPool, allowedOrigins: props.config.allowedOrigins,
      enableExecutionLogging: !props.config.existingLambdaRoleArn, logRetentionDays: props.config.logRetentionDays, retainLogs: props.config.removalPolicy === 'retain',
      throttlingRateLimit: props.config.apiThrottling.rateLimit, throttlingBurstLimit: props.config.apiThrottling.burstLimit
    })
    const make = (name: string, folder: string, actions: string[], needsCourse = false) => {
      const fn = new ServiceFunction(this, name, {
        entry: `../../services/schedules-service/src/functions/${folder}/handler.ts`, serviceName: 'schedules', stage: props.config.stage,
        existingRoleArn: props.config.existingLambdaRoleArn, logRetentionDays: props.config.logRetentionDays, retainLogs: props.config.removalPolicy === 'retain',
        environment: {
          SCHEDULES_TABLE: table.tableName,
          CORS_ALLOWED_ORIGIN: props.config.allowedOrigins[0]!,
          ...(needsCourse ? { COURSES_TABLE: props.coursesTable.tableName } : {})
        }
      })
      table.grant(fn, ...actions)
      if (needsCourse) props.coursesTable.grant(fn, 'dynamodb:GetItem')
      this.functions.push(fn); return fn
    }
    api.addRoute('/schedules', 'POST', make('CreateSchedule', 'create-schedule', ['dynamodb:PutItem'], true))
    api.addRoute('/schedules', 'GET', make('ListSchedules', 'list-schedules', ['dynamodb:Query']))
    api.addRoute('/schedules/{scheduleId}', 'PATCH', make('UpdateSchedule', 'update-schedule', ['dynamodb:GetItem', 'dynamodb:PutItem'], true))
    api.addRoute('/schedules/{scheduleId}', 'DELETE', make('DeleteSchedule', 'delete-schedule', ['dynamodb:DeleteItem'], true))
    const indexer = new ServiceFunction(this, 'ScheduleIndexer', {
      entry: '../../services/schedules-service/src/workers/schedule-indexer/handler.ts', serviceName: 'schedule-indexer', stage: props.config.stage,
      existingRoleArn: props.config.existingLambdaRoleArn, timeoutSeconds: 30, logRetentionDays: props.config.logRetentionDays, retainLogs: props.config.removalPolicy === 'retain',
      environment: { SCHEDULES_TABLE: table.tableName, OPENSEARCH_ENDPOINT: props.openSearchEndpoint }
    })
    table.grant(indexer, 'dynamodb:Query')
    indexer.addToRolePolicy(new iam.PolicyStatement({ actions: ['aoss:APIAccessAll'], resources: [props.openSearchArn] }))
    new aoss.CfnAccessPolicy(this, 'ScheduleSearchDataAccess', {
      name: `cl-${props.config.stage}-schedules-data`, type: 'data',
      policy: JSON.stringify([{
        Description: 'Only the schedule indexer may update course schedules', Principal: [indexer.role!.roleArn],
        Rules: [
          { ResourceType: 'collection', Resource: [`collection/${props.openSearchCollectionName}`], Permission: ['aoss:DescribeCollectionItems'] },
          { ResourceType: 'index', Resource: [`index/${props.openSearchCollectionName}/*`], Permission: ['aoss:CreateIndex', 'aoss:DescribeIndex', 'aoss:ReadDocument', 'aoss:WriteDocument'] }
        ]
      }])
    })
    connectStreamWorker(table, indexer, createDeadLetterQueue(this, 'ScheduleIndexerDlq', `${props.config.stage}-schedule-indexer-dlq`, props.config.removalPolicy === 'retain'))
    this.functions.push(indexer)
    this.apiUrl = api.api.url
    new CfnOutput(this, 'SchedulesApiUrl', { value: this.apiUrl })
    new CfnOutput(this, 'SchedulesTableName', { value: table.tableName })
  }
}

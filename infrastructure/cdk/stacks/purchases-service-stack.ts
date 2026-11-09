import { CfnOutput, Stack, aws_dynamodb as dynamodb } from 'aws-cdk-lib'
import type { StackProps } from 'aws-cdk-lib'
import type { IFunction } from 'aws-cdk-lib/aws-lambda'
import type { IUserPool } from 'aws-cdk-lib/aws-cognito'
import type { ITable } from 'aws-cdk-lib/aws-dynamodb'
import type { IBucket } from 'aws-cdk-lib/aws-s3'
import type { Construct } from 'constructs'
import { createServiceTable } from '../constructs/dynamodb-table.js'
import { ServiceFunction } from '../constructs/lambda-function.js'
import { ServiceApi } from '../constructs/service-api.js'
import { createDeadLetterQueue } from '../constructs/dead-letter-queue.js'
import { connectStreamWorker } from '../constructs/stream-worker.js'
import type { StageConfig } from './config.js'

export interface PurchasesServiceStackProps extends StackProps {
  config: StageConfig
  userPool: IUserPool
  dataBucket: IBucket
  coursesTable: ITable
  schedulesTable: ITable
}

export class PurchasesServiceStack extends Stack {
  readonly functions: IFunction[] = []
  readonly apiUrl: string

  constructor(scope: Construct, id: string, props: PurchasesServiceStackProps) {
    super(scope, id, props)
    const table = createServiceTable(this, 'PurchasesTable', {
      tableName: `cloud-learning-${props.config.stage}-purchases`, partitionKey: 'tenantUserId', sortKey: 'purchaseId', stream: true, retain: props.config.removalPolicy === 'retain'
    })
    table.addGlobalSecondaryIndex({
      indexName: 'tenantId-index', partitionKey: { name: 'tenantId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING }, projectionType: dynamodb.ProjectionType.ALL
    })
    const api = new ServiceApi(this, 'PurchasesApi', {
      serviceName: 'purchases', stage: props.config.stage, userPool: props.userPool, allowedOrigins: props.config.allowedOrigins,
      enableExecutionLogging: !props.config.existingLambdaRoleArn, logRetentionDays: props.config.logRetentionDays, retainLogs: props.config.removalPolicy === 'retain',
      throttlingRateLimit: props.config.apiThrottling.rateLimit, throttlingBurstLimit: props.config.apiThrottling.burstLimit
    })
    const make = (name: string, folder: string, actions: string[], usesSchedule = false, readsCatalog = false) => {
      const fn = new ServiceFunction(this, name, {
        entry: `../../services/purchases-service/src/functions/${folder}/handler.ts`, serviceName: 'purchases', stage: props.config.stage,
        existingRoleArn: props.config.existingLambdaRoleArn, logRetentionDays: props.config.logRetentionDays, retainLogs: props.config.removalPolicy === 'retain',
        environment: {
          PURCHASES_TABLE: table.tableName,
          CORS_ALLOWED_ORIGIN: props.config.allowedOrigins[0]!,
          ...(usesSchedule ? { SCHEDULES_TABLE: props.schedulesTable.tableName } : {}),
          ...(readsCatalog ? { COURSES_TABLE: props.coursesTable.tableName } : {})
        }
      })
      table.grant(fn, ...actions)
      if (usesSchedule) props.schedulesTable.grant(fn, 'dynamodb:UpdateItem', ...(readsCatalog ? ['dynamodb:GetItem'] : []))
      if (readsCatalog) props.coursesTable.grant(fn, 'dynamodb:GetItem')
      this.functions.push(fn); return fn
    }
    api.addRoute('/purchases', 'POST', make('CreatePurchase', 'create-purchase', ['dynamodb:GetItem', 'dynamodb:PutItem'], true, true))
    api.addRoute('/purchases', 'GET', make('ListPurchases', 'list-purchases', ['dynamodb:Query']))
    api.addRoute('/purchases/{purchaseId}', 'PATCH', make('UpdatePurchase', 'update-purchase', ['dynamodb:GetItem', 'dynamodb:UpdateItem'], true))
    api.addRoute('/purchases/{purchaseId}', 'DELETE', make('CancelPurchase', 'cancel-purchase', ['dynamodb:GetItem', 'dynamodb:UpdateItem'], true))
    const archiver = new ServiceFunction(this, 'PurchaseArchiver', {
      entry: '../../services/purchases-service/src/workers/purchase-archiver/handler.ts', serviceName: 'purchase-archiver', stage: props.config.stage,
      existingRoleArn: props.config.existingLambdaRoleArn, logRetentionDays: props.config.logRetentionDays, retainLogs: props.config.removalPolicy === 'retain',
      environment: { DATA_BUCKET: props.dataBucket.bucketName }
    })
    props.dataBucket.grantWrite(archiver)
    connectStreamWorker(table, archiver, createDeadLetterQueue(this, 'PurchaseArchiverDlq', `${props.config.stage}-purchase-archiver-dlq`, props.config.removalPolicy === 'retain'))
    this.functions.push(archiver)
    this.apiUrl = api.api.url
    new CfnOutput(this, 'PurchasesApiUrl', { value: this.apiUrl })
    new CfnOutput(this, 'PurchasesTableName', { value: table.tableName })
  }
}

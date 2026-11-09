import { CfnOutput, Stack, aws_dynamodb as dynamodb, aws_iam as iam, aws_opensearchserverless as aoss } from 'aws-cdk-lib'
import type { StackProps } from 'aws-cdk-lib'
import type { IFunction } from 'aws-cdk-lib/aws-lambda'
import type { IUserPool } from 'aws-cdk-lib/aws-cognito'
import type { Construct } from 'constructs'
import { createServiceTable } from '../constructs/dynamodb-table.js'
import { ServiceFunction } from '../constructs/lambda-function.js'
import { ServiceApi } from '../constructs/service-api.js'
import { createDeadLetterQueue } from '../constructs/dead-letter-queue.js'
import { connectStreamWorker } from '../constructs/stream-worker.js'
import type { StageConfig } from './config.js'

export interface CoursesServiceStackProps extends StackProps { config: StageConfig; userPool: IUserPool; openSearchEndpoint: string; openSearchArn: string; openSearchCollectionName: string }

export class CoursesServiceStack extends Stack {
  readonly functions: IFunction[] = []
  readonly apiUrl: string
  readonly table: dynamodb.Table

  constructor(scope: Construct, id: string, props: CoursesServiceStackProps) {
    super(scope, id, props)
    const table = this.table = createServiceTable(this, 'CoursesTable', {
      tableName: `cloud-learning-${props.config.stage}-courses`, partitionKey: 'tenantId', sortKey: 'courseId', stream: true, retain: props.config.removalPolicy === 'retain'
    })
    const api = new ServiceApi(this, 'CoursesApi', {
      serviceName: 'courses', stage: props.config.stage, userPool: props.userPool, allowedOrigins: props.config.allowedOrigins,
      enableExecutionLogging: !props.config.existingLambdaRoleArn, logRetentionDays: props.config.logRetentionDays, retainLogs: props.config.removalPolicy === 'retain',
      throttlingRateLimit: props.config.apiThrottling.rateLimit, throttlingBurstLimit: props.config.apiThrottling.burstLimit
    })
    const make = (name: string, folder: string, actions: string[], search = false) => {
      const fn = new ServiceFunction(this, name, {
        entry: `../../services/courses-service/src/functions/${folder}/handler.ts`, serviceName: 'courses', stage: props.config.stage,
        existingRoleArn: props.config.existingLambdaRoleArn, logRetentionDays: props.config.logRetentionDays, retainLogs: props.config.removalPolicy === 'retain',
        environment: {
          CORS_ALLOWED_ORIGIN: props.config.allowedOrigins[0]!,
          ...(actions.length === 0 ? {} : { COURSES_TABLE: table.tableName }),
          ...(search ? { OPENSEARCH_ENDPOINT: props.openSearchEndpoint } : {})
        }
      })
      if (actions.length > 0) table.grant(fn, ...actions)
      if (search) fn.addToRolePolicy(new iam.PolicyStatement({ actions: ['aoss:APIAccessAll'], resources: [props.openSearchArn] }))
      this.functions.push(fn); return fn
    }
    api.addRoute('/courses', 'POST', make('CreateCourse', 'create-course', ['dynamodb:PutItem']))
    api.addRoute('/courses/{courseId}', 'GET', make('GetCourse', 'get-course', ['dynamodb:GetItem']))
    api.addRoute('/courses', 'GET', make('ListCourses', 'list-courses', ['dynamodb:Query']))
    api.addRoute('/courses/{courseId}', 'PATCH', make('UpdateCourse', 'update-course', ['dynamodb:GetItem', 'dynamodb:PutItem']))
    api.addRoute('/courses/{courseId}', 'DELETE', make('DeleteCourse', 'delete-course', ['dynamodb:GetItem', 'dynamodb:DeleteItem']))
    const searchCourses = make('SearchCourses', 'search-courses', [], true)
    api.addRoute('/search', 'GET', searchCourses)
    const indexer = new ServiceFunction(this, 'CourseIndexer', {
      entry: '../../services/courses-service/src/workers/course-indexer/handler.ts', serviceName: 'course-indexer', stage: props.config.stage,
      existingRoleArn: props.config.existingLambdaRoleArn, timeoutSeconds: 30, logRetentionDays: props.config.logRetentionDays, retainLogs: props.config.removalPolicy === 'retain',
      environment: { OPENSEARCH_ENDPOINT: props.openSearchEndpoint }
    })
    indexer.addToRolePolicy(new iam.PolicyStatement({ actions: ['aoss:APIAccessAll'], resources: [props.openSearchArn] }))
    new aoss.CfnAccessPolicy(this, 'CourseSearchDataAccess', {
      name: `cl-${props.config.stage}-courses-data`, type: 'data',
      policy: JSON.stringify([{
        Description: 'Course search is read-only',
        Principal: [searchCourses.role!.roleArn],
        Rules: [
          { ResourceType: 'collection', Resource: [`collection/${props.openSearchCollectionName}`], Permission: ['aoss:DescribeCollectionItems'] },
          { ResourceType: 'index', Resource: [`index/${props.openSearchCollectionName}/*`], Permission: ['aoss:DescribeIndex', 'aoss:ReadDocument'] }
        ]
      }, {
        Description: 'Course indexer maintains course documents',
        Principal: [indexer.role!.roleArn],
        Rules: [
          { ResourceType: 'collection', Resource: [`collection/${props.openSearchCollectionName}`], Permission: ['aoss:DescribeCollectionItems'] },
          { ResourceType: 'index', Resource: [`index/${props.openSearchCollectionName}/*`], Permission: ['aoss:CreateIndex', 'aoss:DescribeIndex', 'aoss:ReadDocument', 'aoss:WriteDocument', 'aoss:UpdateIndex', 'aoss:DeleteIndex'] }
        ]
      }])
    })
    const dlq = createDeadLetterQueue(this, 'CourseIndexerDlq', `${props.config.stage}-course-indexer-dlq`, props.config.removalPolicy === 'retain')
    connectStreamWorker(table, indexer, dlq)
    this.functions.push(indexer)
    this.apiUrl = api.api.url
    new CfnOutput(this, 'CoursesApiUrl', { value: this.apiUrl })
    new CfnOutput(this, 'CoursesTableName', { value: table.tableName })
  }
}

import { Duration, aws_dynamodb as dynamodb, aws_lambda as lambda, aws_lambda_event_sources as sources, aws_sqs as sqs } from 'aws-cdk-lib'
import type { IFunction } from 'aws-cdk-lib/aws-lambda'

export function connectStreamWorker(table: dynamodb.Table, worker: IFunction, deadLetterQueue: sqs.IQueue): void {
  worker.addEventSource(new sources.DynamoEventSource(table, {
    startingPosition: lambda.StartingPosition.TRIM_HORIZON,
    batchSize: 25,
    bisectBatchOnError: true,
    retryAttempts: 5,
    maxRecordAge: Duration.hours(24),
    onFailure: new sources.SqsDlq(deadLetterQueue)
  }))
}

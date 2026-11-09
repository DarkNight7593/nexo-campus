import { Duration, RemovalPolicy, aws_sqs as sqs } from 'aws-cdk-lib'
import type { Construct } from 'constructs'

export function createDeadLetterQueue(scope: Construct, id: string, queueName: string, retain: boolean): sqs.Queue {
  return new sqs.Queue(scope, id, {
    queueName,
    encryption: sqs.QueueEncryption.SQS_MANAGED,
    retentionPeriod: Duration.days(14),
    removalPolicy: retain ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY
  })
}

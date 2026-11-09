import { RemovalPolicy, aws_dynamodb as dynamodb } from 'aws-cdk-lib'
import type { Construct } from 'constructs'

export interface ServiceTableProps {
  tableName: string
  partitionKey: string
  sortKey?: string
  stream?: boolean
  retain: boolean
}

export function createServiceTable(scope: Construct, id: string, props: ServiceTableProps): dynamodb.Table {
  const table = new dynamodb.Table(scope, id, {
    tableName: props.tableName,
    partitionKey: { name: props.partitionKey, type: dynamodb.AttributeType.STRING },
    sortKey: props.sortKey ? { name: props.sortKey, type: dynamodb.AttributeType.STRING } : undefined,
    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    encryption: dynamodb.TableEncryption.AWS_MANAGED,
    pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    stream: props.stream ? dynamodb.StreamViewType.NEW_AND_OLD_IMAGES : undefined,
    removalPolicy: props.retain ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY
  })
  return table
}

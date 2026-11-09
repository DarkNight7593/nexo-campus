import type { DynamoDBStreamHandler } from 'aws-lambda'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { s3 } from '@cloud-learning/aws-clients'
import type { Purchase } from '@cloud-learning/contracts'

const bucketName = process.env.DATA_BUCKET
if (!bucketName) throw new Error('DATA_BUCKET is not configured')

export const handler: DynamoDBStreamHandler = async (event) => {
  for (const record of event.Records) {
    const image = record.eventName === 'REMOVE' ? record.dynamodb?.OldImage : record.dynamodb?.NewImage
    if (!image) continue
    const purchase = unmarshall(image as any) as Purchase
    const occurredAt = typeof record.dynamodb?.ApproximateCreationDateTime === 'number'
      ? new Date(record.dynamodb.ApproximateCreationDateTime * 1000).toISOString()
      : purchase.updatedAt
    const day = occurredAt.slice(0, 10).replaceAll('-', '/')
    const eventId = record.eventID ?? record.dynamodb?.SequenceNumber
    if (!eventId) throw new Error('DynamoDB Stream record is missing its stable event identifier')
    await s3.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: `purchases/${purchase.tenantId}/${day}/${purchase.purchaseId}/${eventId}.json`,
      ContentType: 'application/json',
      ServerSideEncryption: 'AES256',
      Body: JSON.stringify({ eventName: record.eventName, occurredAt, purchase })
    }))
  }
}

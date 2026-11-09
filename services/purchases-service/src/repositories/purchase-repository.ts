import { GetCommand, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb'
import type { TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb'
import { dynamodb, HttpError } from '@cloud-learning/aws-clients'
import type { Purchase } from '@cloud-learning/contracts'

const tableName = process.env.PURCHASES_TABLE
const schedulesTable = process.env.SCHEDULES_TABLE
if (!tableName) throw new Error('PURCHASES_TABLE is not configured')
if (!schedulesTable) throw new Error('SCHEDULES_TABLE is not configured')

const tenantUserId = (tenantId: string, userId: string) => `${tenantId}#${userId}`

export async function reserveSeatAndCreatePurchase(purchase: Purchase): Promise<Purchase> {
  try {
    await dynamodb.send(new TransactWriteCommand({
      TransactItems: [{
        Update: {
          TableName: schedulesTable,
          Key: { tenantCourseId: `${purchase.tenantId}#${purchase.courseId}`, scheduleId: purchase.scheduleId },
          UpdateExpression: 'SET occupiedCount = occupiedCount + :one, updatedAt = :updatedAt',
          ConditionExpression: 'attribute_exists(scheduleId) AND #status = :open AND occupiedCount < capacity',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: { ':one': 1, ':open': 'open', ':updatedAt': purchase.updatedAt }
        }
      }, {
        Put: {
          TableName: tableName,
          Item: { ...purchase, tenantUserId: tenantUserId(purchase.tenantId, purchase.userId) },
          ConditionExpression: 'attribute_not_exists(tenantUserId) AND attribute_not_exists(purchaseId)'
        }
      }]
    }))
    return purchase
  } catch (error: any) {
    if (error?.name === 'TransactionCanceledException') {
      const existing = await getPurchase(purchase.tenantId, purchase.userId, purchase.purchaseId)
      if (existing) return existing
      throw new HttpError(409, 'Schedule is closed or has no available seats')
    }
    throw error
  }
}

export async function transitionPurchase(current: Purchase, status: Purchase['status']): Promise<Purchase> {
  const updated: Purchase = { ...current, status, updatedAt: new Date().toISOString() }
  const transactItems: NonNullable<TransactWriteCommandInput['TransactItems']> = [{
    Update: {
      TableName: tableName,
      Key: { tenantUserId: tenantUserId(current.tenantId, current.userId), purchaseId: current.purchaseId },
      UpdateExpression: 'SET #status = :nextStatus, updatedAt = :updatedAt',
      ConditionExpression: '#status = :currentStatus',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':nextStatus': status, ':currentStatus': current.status, ':updatedAt': updated.updatedAt }
    }
  }]
  if (status === 'cancelled') {
    transactItems.push({
      Update: {
        TableName: schedulesTable,
        Key: { tenantCourseId: `${current.tenantId}#${current.courseId}`, scheduleId: current.scheduleId },
        UpdateExpression: 'SET occupiedCount = occupiedCount - :one, updatedAt = :updatedAt',
        ConditionExpression: 'attribute_exists(scheduleId) AND occupiedCount > :zero',
        ExpressionAttributeValues: { ':one': 1, ':zero': 0, ':updatedAt': updated.updatedAt }
      }
    })
  }
  try {
    await dynamodb.send(new TransactWriteCommand({ TransactItems: transactItems }))
    return updated
  } catch (error: any) {
    if (error?.name === 'TransactionCanceledException') {
      const latest = await getPurchase(current.tenantId, current.userId, current.purchaseId)
      if (latest?.status === status) return latest
      throw new HttpError(409, 'Purchase changed concurrently; reload and try again')
    }
    throw error
  }
}

export async function getPurchase(tenantId: string, userId: string, purchaseId: string): Promise<Purchase | undefined> {
  const result = await dynamodb.send(new GetCommand({
    TableName: tableName,
    Key: { tenantUserId: tenantUserId(tenantId, userId), purchaseId }
  }))
  return result.Item as Purchase | undefined
}

export async function listPurchasesForUser(tenantId: string, userId: string): Promise<Purchase[]> {
  const result = await dynamodb.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: 'tenantUserId = :key',
    ExpressionAttributeValues: { ':key': tenantUserId(tenantId, userId) }
  }))
  return (result.Items ?? []) as Purchase[]
}

export async function listPurchasesForTenant(tenantId: string): Promise<Purchase[]> {
  const result = await dynamodb.send(new QueryCommand({
    TableName: tableName,
    IndexName: 'tenantId-index',
    KeyConditionExpression: 'tenantId = :tenantId',
    ExpressionAttributeValues: { ':tenantId': tenantId }
  }))
  return (result.Items ?? []) as Purchase[]
}

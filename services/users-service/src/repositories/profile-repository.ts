import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { dynamodb, HttpError } from '@cloud-learning/aws-clients'
import type { Profile } from '@cloud-learning/contracts'

const tableName = process.env.PROFILES_TABLE
if (!tableName) throw new Error('PROFILES_TABLE is not configured')

export async function saveProfile(profile: Profile, onlyIfNew = false): Promise<void> {
  try {
    await dynamodb.send(new PutCommand({
      TableName: tableName,
      Item: profile,
      ConditionExpression: onlyIfNew ? 'attribute_not_exists(tenantId) AND attribute_not_exists(userId)' : undefined
    }))
  } catch (error: any) {
    if (error?.name === 'ConditionalCheckFailedException') throw new HttpError(409, 'Profile already exists')
    throw error
  }
}

export async function getProfile(tenantId: string, userId: string): Promise<Profile | undefined> {
  const result = await dynamodb.send(new GetCommand({
    TableName: tableName,
    Key: { tenantId, userId }
  }))
  return result.Item as Profile | undefined
}

export async function listProfiles(tenantId: string): Promise<Profile[]> {
  const result = await dynamodb.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: 'tenantId = :tenantId',
    ExpressionAttributeValues: { ':tenantId': tenantId }
  }))
  return (result.Items ?? []) as Profile[]
}

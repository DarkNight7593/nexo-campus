import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { dynamodb, HttpError } from '@cloud-learning/aws-clients'
import type { Organization } from '@cloud-learning/contracts'

const tableName = process.env.ORGANIZATIONS_TABLE
if (!tableName) throw new Error('ORGANIZATIONS_TABLE is not configured')

export async function saveOrganization(organization: Organization, onlyIfNew = false): Promise<void> {
  try {
    await dynamodb.send(new PutCommand({
      TableName: tableName,
      Item: organization,
      ConditionExpression: onlyIfNew ? 'attribute_not_exists(organizationId)' : undefined
    }))
  } catch (error: any) {
    if (error?.name === 'ConditionalCheckFailedException') throw new HttpError(409, 'Organization already exists')
    throw error
  }
}

export async function getOrganization(organizationId: string): Promise<Organization | undefined> {
  const result = await dynamodb.send(new GetCommand({ TableName: tableName, Key: { organizationId } }))
  return result.Item as Organization | undefined
}

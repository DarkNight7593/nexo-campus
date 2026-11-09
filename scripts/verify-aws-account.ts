import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts'
import { assertAwsTarget, loadLocalEnvironment } from './lib/project.js'

loadLocalEnvironment()
const stage = process.argv[2] ?? process.env.STAGE ?? 'dev'
const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'us-east-1'
const identity = await new STSClient({ region }).send(new GetCallerIdentityCommand({}))
assertAwsTarget(stage, identity.Account)
console.log(JSON.stringify({ stage, region, account: identity.Account, principal: identity.Arn }, null, 2))

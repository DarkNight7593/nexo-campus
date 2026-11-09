import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts'
import type { RuntimeConfig } from '@cloud-learning/contracts'
import { assertAwsTarget, loadLocalEnvironment, npmExecutable, readOutputs, root, stackOutput } from '../lib/project.js'

loadLocalEnvironment()
const stage = process.argv[2] ?? 'dev'
const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'us-east-1'
const identity = await new STSClient({ region }).send(new GetCallerIdentityCommand({}))
assertAwsTarget(stage, identity.Account)
console.log(`Desplegando ${stage} en AWS account ${identity.Account}, región ${region}`)

function run(args: string[]): void {
  const result = spawnSync(npmExecutable(), args, { cwd: root, stdio: 'inherit', env: { ...process.env, STAGE: stage, AWS_REGION: region } })
  if (result.status !== 0) throw new Error(`Falló: npm ${args.join(' ')}`)
}

run(['--workspace', '@cloud-learning/web', 'run', 'build'])
fs.mkdirSync(path.join(root, 'outputs'), { recursive: true })
run(['--workspace', '@cloud-learning/infrastructure', 'exec', 'cdk', '--', 'deploy', '--all', '--context', `stage=${stage}`, '--require-approval', 'never', '--outputs-file', path.join(root, 'outputs', `${stage}.json`)])

const outputs = readOutputs(stage)
const webUrl = stackOutput(outputs, '-Web', 'WebUrl')
const runtimeConfig: RuntimeConfig = {
  stage, region,
  apiUrls: {
    users: stackOutput(outputs, '-Users', 'UsersApiUrl'),
    organizations: stackOutput(outputs, '-Organizations', 'OrganizationsApiUrl'),
    courses: stackOutput(outputs, '-Courses', 'CoursesApiUrl'),
    schedules: stackOutput(outputs, '-Schedules', 'SchedulesApiUrl'),
    purchases: stackOutput(outputs, '-Purchases', 'PurchasesApiUrl')
  },
  auth: {
    mode: 'cognito',
    domain: stackOutput(outputs, '-Auth', 'CognitoDomain'),
    clientId: stackOutput(outputs, '-Auth', 'UserPoolClientId'),
    redirectUri: `${webUrl}/auth/callback`, logoutUri: webUrl
  }
}
const runtimeBody = JSON.stringify(runtimeConfig, null, 2)
fs.writeFileSync(path.join(root, 'outputs', `runtime-config-${stage}.json`), runtimeBody)
await new S3Client({ region }).send(new PutObjectCommand({
  Bucket: stackOutput(outputs, '-Web', 'FrontendBucketName'), Key: 'runtime-config.json', Body: runtimeBody,
  ContentType: 'application/json', CacheControl: 'no-store', ServerSideEncryption: 'AES256'
}))
await new CloudFrontClient({ region }).send(new CreateInvalidationCommand({
  DistributionId: stackOutput(outputs, '-Web', 'DistributionId'),
  InvalidationBatch: { CallerReference: `${Date.now()}`, Paths: { Quantity: 1, Items: ['/runtime-config.json'] } }
}))
console.log(`Despliegue terminado: ${webUrl}`)

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts'
import { assertAwsTarget, loadLocalEnvironment, npmExecutable, readOutputs, root, stackOutput } from '../lib/project.js'

loadLocalEnvironment()
const stage = process.argv[2] ?? 'dev'
const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'us-east-1'
const identity = await new STSClient({ region }).send(new GetCallerIdentityCommand({}))
assertAwsTarget(stage, identity.Account)
const build = spawnSync(npmExecutable(), ['--workspace', '@cloud-learning/web', 'run', 'build'], { cwd: root, stdio: 'inherit' })
if (build.status !== 0) process.exit(build.status ?? 1)
const deploy = spawnSync(npmExecutable(), ['--workspace', '@cloud-learning/infrastructure', 'exec', 'cdk', '--', 'deploy', `CloudLearning-${stage}-Web`, '--context', `stage=${stage}`, '--require-approval', 'never'], { cwd: root, stdio: 'inherit', env: { ...process.env, STAGE: stage } })
if (deploy.status !== 0) process.exit(deploy.status ?? 1)
const outputs = readOutputs(stage)
const body = fs.readFileSync(path.join(root, 'outputs', `runtime-config-${stage}.json`))
const bucket = stackOutput(outputs, '-Web', 'FrontendBucketName')
await new S3Client({ region }).send(new PutObjectCommand({ Bucket: bucket, Key: 'runtime-config.json', Body: body, ContentType: 'application/json', CacheControl: 'no-store' }))
await new CloudFrontClient({ region }).send(new CreateInvalidationCommand({ DistributionId: stackOutput(outputs, '-Web', 'DistributionId'), InvalidationBatch: { CallerReference: `${Date.now()}`, Paths: { Quantity: 1, Items: ['/*'] } } }))

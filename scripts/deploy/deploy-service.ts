import { spawnSync } from 'node:child_process'
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts'
import { assertAwsTarget, loadLocalEnvironment, npmExecutable, root } from '../lib/project.js'

loadLocalEnvironment()
const [stage = 'dev', service] = process.argv.slice(2)
const allowed = ['Users', 'Organizations', 'Courses', 'Schedules', 'Purchases']
if (!service || !allowed.includes(service)) throw new Error(`Servicio requerido: ${allowed.join(', ')}`)
const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'us-east-1'
const identity = await new STSClient({ region }).send(new GetCallerIdentityCommand({}))
assertAwsTarget(stage, identity.Account)
const stack = `CloudLearning-${stage}-${service}`
const result = spawnSync(npmExecutable(), ['--workspace', '@cloud-learning/infrastructure', 'exec', 'cdk', '--', 'deploy', stack, '--context', `stage=${stage}`, '--require-approval', 'never'], { cwd: root, stdio: 'inherit', env: { ...process.env, STAGE: stage, AWS_REGION: region } })
if (result.status !== 0) process.exit(result.status ?? 1)
console.log('Servicio actualizado. Ejecuta deploy-all si cambiaste endpoints o el frontend.')

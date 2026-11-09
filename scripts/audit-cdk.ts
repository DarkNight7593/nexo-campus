import fs from 'node:fs'
import path from 'node:path'
import { root } from './lib/project.js'

type Resource = { Type?: string; Properties?: Record<string, unknown> }
type Template = { Resources?: Record<string, Resource> }

const stage = process.argv[2] ?? 'dev'
const outputDirectory = path.join(root, 'infrastructure', 'cdk', 'cdk.out')
const stageConfig = JSON.parse(fs.readFileSync(path.join(root, 'config', `${stage}.json`), 'utf8')) as {
  removalPolicy: 'destroy' | 'retain'
  apiThrottling: { rateLimit: number; burstLimit: number }
}
const expectedStacks = [
  'Foundation', 'Web', 'Auth', 'Search', 'Users', 'Organizations',
  'Courses', 'Schedules', 'Purchases', 'Monitoring'
]

function fail(message: string): never { throw new Error(`Auditoría CDK: ${message}`) }
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message)
}

const templates = new Map<string, Template>()
for (const suffix of expectedStacks) {
  const file = path.join(outputDirectory, `CloudLearning-${stage}-${suffix}.template.json`)
  assert(fs.existsSync(file), `falta ${path.basename(file)}; ejecuta primero cdk synth`)
  templates.set(suffix, JSON.parse(fs.readFileSync(file, 'utf8')) as Template)
}

function resources(type: string, stack?: string): Resource[] {
  const selected = stack ? [[stack, templates.get(stack)!] as const] : [...templates.entries()]
  return selected.flatMap(([, template]) => Object.values(template.Resources ?? {}).filter((resource) => resource.Type === type))
}

function exact(type: string, expected: number, stack?: string): void {
  const actual = resources(type, stack).length
  assert(actual === expected, `${stack ? `${stack}: ` : ''}${type}; se esperaban ${expected}, se encontraron ${actual}`)
}

function namedFunction(stack: string, suffix: string): Resource {
  const fn = resources('AWS::Lambda::Function', stack).find((resource) =>
    typeof resource.Properties?.FunctionName === 'string' && String(resource.Properties.FunctionName).endsWith(suffix)
  )
  assert(fn, `${stack}: no se encontró la Lambda ${suffix}`)
  return fn
}

function policyActions(stack: string, logicalIdPrefix: string, servicePrefix: string): string[] {
  const entries = Object.entries(templates.get(stack)?.Resources ?? {})
  const policy = entries.find(([logicalId, resource]) =>
    logicalId.startsWith(logicalIdPrefix) && resource.Type === 'AWS::IAM::Policy'
  )?.[1]
  assert(policy, `${stack}: no se encontró la política IAM de ${logicalIdPrefix}`)
  const found = new Set<string>()
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) return value.forEach(visit)
    if (!value || typeof value !== 'object') return
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (key === 'Action') {
        for (const action of Array.isArray(nested) ? nested : [nested]) {
          if (typeof action === 'string' && action.startsWith(servicePrefix)) found.add(action)
        }
      } else visit(nested)
    }
  }
  visit(policy.Properties?.PolicyDocument)
  return [...found].sort()
}

function assertActions(stack: string, logicalIdPrefix: string, expected: string[]): void {
  const actual = policyActions(stack, logicalIdPrefix, 'dynamodb:')
  const wanted = [...expected].sort()
  assert(JSON.stringify(actual) === JSON.stringify(wanted),
    `${stack}/${logicalIdPrefix}: acciones DynamoDB ${actual.join(', ')}; se esperaban ${wanted.join(', ')}`)
}

exact('AWS::ApiGateway::RestApi', 5)
exact('AWS::ApiGateway::Account', 1)
exact('AWS::ApiGateway::Account', 1, 'Foundation')
for (const stack of ['Users', 'Organizations', 'Courses', 'Schedules', 'Purchases']) {
  exact('AWS::ApiGateway::Account', 0, stack)
  exact('AWS::ApiGateway::RestApi', 1, stack)
}

exact('AWS::ApiGateway::Stage', 5)
for (const apiStage of resources('AWS::ApiGateway::Stage')) {
  const method = (apiStage.Properties?.MethodSettings as Array<Record<string, unknown>> | undefined)?.[0]
  assert(method?.ThrottlingRateLimit === stageConfig.apiThrottling.rateLimit,
    'un stage de API Gateway no aplica el rate limit configurado')
  assert(method?.ThrottlingBurstLimit === stageConfig.apiThrottling.burstLimit,
    'un stage de API Gateway no aplica el burst limit configurado')
  assert(method?.MetricsEnabled === true && method?.DataTraceEnabled === false,
    'un stage debe habilitar métricas sin registrar cuerpos de peticiones')
}

exact('AWS::DynamoDB::Table', 5)
for (const table of resources('AWS::DynamoDB::Table')) {
  const properties = table.Properties ?? {}
  assert(properties.BillingMode === 'PAY_PER_REQUEST', 'todas las tablas deben usar capacidad bajo demanda')
  assert((properties.PointInTimeRecoverySpecification as { PointInTimeRecoveryEnabled?: boolean } | undefined)?.PointInTimeRecoveryEnabled === true,
    'todas las tablas deben habilitar recuperación point-in-time')
  assert((properties.SSESpecification as { SSEEnabled?: boolean } | undefined)?.SSEEnabled === true,
    'todas las tablas deben habilitar cifrado')
}

const expectedFunctions: Record<string, number> = { Users: 4, Organizations: 4, Courses: 7, Schedules: 5, Purchases: 5 }
for (const [stack, amount] of Object.entries(expectedFunctions)) {
  const functions = resources('AWS::Lambda::Function', stack).filter((resource) =>
    typeof resource.Properties?.FunctionName === 'string' && String(resource.Properties.FunctionName).startsWith(`cloud-learning-${stage}-`)
  )
  assert(functions.length === amount, `${stack}: se esperaban ${amount} Lambdas de negocio, se encontraron ${functions.length}`)
  for (const fn of functions) {
    assert(fn.Properties?.Runtime === 'nodejs24.x', `${stack}: una Lambda no usa Node.js 24`)
    assert((fn.Properties?.Architectures as string[] | undefined)?.[0] === 'arm64', `${stack}: una Lambda no usa ARM64`)
    assert((fn.Properties?.TracingConfig as { Mode?: string } | undefined)?.Mode === 'Active', `${stack}: una Lambda no activa X-Ray`)
    const roleReference = (fn.Properties?.Role as { 'Fn::GetAtt'?: unknown[] } | undefined)?.['Fn::GetAtt']?.[0]
    assert(typeof roleReference === 'string', `${stack}: una Lambda no referencia un rol generado y auditable`)
    const role = templates.get(stack)?.Resources?.[roleReference]
    assert(role?.Type === 'AWS::IAM::Role', `${stack}: falta el rol IAM de una Lambda`)
    assert(!role.Properties?.ManagedPolicyArns,
      `${stack}: una Lambda usa una managed policy amplia; debe recibir logs y datos mediante políticas inline acotadas`)
  }
}

const expectedDynamoActions: Record<string, Record<string, string[]>> = {
  Users: {
    CreateProfile: ['dynamodb:PutItem'], GetProfile: ['dynamodb:GetItem'], ListUsers: ['dynamodb:Query'],
    UpdateProfile: ['dynamodb:GetItem', 'dynamodb:PutItem']
  },
  Organizations: {
    CreateOrganization: ['dynamodb:PutItem'], GetOrganization: ['dynamodb:GetItem'], ListOrganizations: ['dynamodb:GetItem'],
    UpdateOrganization: ['dynamodb:GetItem', 'dynamodb:PutItem']
  },
  Courses: {
    CreateCourse: ['dynamodb:PutItem'], GetCourse: ['dynamodb:GetItem'], ListCourses: ['dynamodb:Query'],
    UpdateCourse: ['dynamodb:GetItem', 'dynamodb:PutItem'], DeleteCourse: ['dynamodb:DeleteItem', 'dynamodb:GetItem']
  },
  Schedules: {
    CreateSchedule: ['dynamodb:GetItem', 'dynamodb:PutItem'], ListSchedules: ['dynamodb:Query'],
    UpdateSchedule: ['dynamodb:GetItem', 'dynamodb:PutItem'], DeleteSchedule: ['dynamodb:DeleteItem', 'dynamodb:GetItem']
  },
  Purchases: {
    CreatePurchase: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem'], ListPurchases: ['dynamodb:Query'],
    UpdatePurchase: ['dynamodb:GetItem', 'dynamodb:UpdateItem'], CancelPurchase: ['dynamodb:GetItem', 'dynamodb:UpdateItem']
  }
}
for (const [stack, functions] of Object.entries(expectedDynamoActions)) {
  for (const [logicalIdPrefix, actions] of Object.entries(functions)) assertActions(stack, logicalIdPrefix, actions)
}

const methods = resources('AWS::ApiGateway::Method')
const protectedMethods = methods.filter((method) => method.Properties?.HttpMethod !== 'OPTIONS')
assert(protectedMethods.length === 22, `se esperaban 22 métodos protegidos, se encontraron ${protectedMethods.length}`)
for (const method of protectedMethods) {
  assert(method.Properties?.AuthorizationType === 'COGNITO_USER_POOLS', 'una ruta de negocio no está protegida por Cognito')
  assert(Boolean(method.Properties?.AuthorizerId), 'una ruta de negocio no referencia su authorizer')
}

exact('AWS::Logs::LogGroup', 30)
exact('AWS::Lambda::EventSourceMapping', 3)
exact('AWS::SQS::Queue', 3)
exact('AWS::S3::Bucket', 2)
for (const bucket of resources('AWS::S3::Bucket')) {
  const block = bucket.Properties?.PublicAccessBlockConfiguration as Record<string, boolean> | undefined
  assert(block?.BlockPublicAcls && block.BlockPublicPolicy && block.IgnorePublicAcls && block.RestrictPublicBuckets,
    'todos los buckets deben bloquear acceso público')
  assert((bucket.Properties?.VersioningConfiguration as { Status?: string } | undefined)?.Status === 'Enabled',
    'todos los buckets deben tener versionado habilitado')
}

exact('AWS::Cognito::UserPool', 1)
exact('AWS::Cognito::UserPoolClient', 1)
exact('AWS::Cognito::UserPoolGroup', 3)
const userPool = resources('AWS::Cognito::UserPool')[0]!
assert(userPool.Properties?.MfaConfiguration === 'OPTIONAL', 'Cognito debe permitir MFA TOTP')
assert(userPool.Properties?.DeletionProtection === (stageConfig.removalPolicy === 'retain' ? 'ACTIVE' : 'INACTIVE'),
  'la protección de borrado de Cognito no coincide con la política del stage')
const userPoolClient = resources('AWS::Cognito::UserPoolClient')[0]!
assert(userPoolClient.Properties?.PreventUserExistenceErrors === 'ENABLED',
  'el cliente Cognito debe ocultar la existencia de usuarios')
const writeAttributes = userPoolClient.Properties?.WriteAttributes as string[] | undefined
assert(!writeAttributes?.includes('custom:tenant_id') && !writeAttributes?.includes('custom:role'),
  'el cliente web no debe poder modificar los claims de autorización tenant_id o role')
exact('AWS::CloudFront::Distribution', 1)
exact('AWS::CloudFront::ResponseHeadersPolicy', 1)
const distribution = resources('AWS::CloudFront::Distribution')[0]!
const distributionConfig = distribution.Properties?.DistributionConfig as Record<string, unknown> | undefined
const defaultBehavior = distributionConfig?.DefaultCacheBehavior as Record<string, unknown> | undefined
assert(defaultBehavior?.ViewerProtocolPolicy === 'redirect-to-https', 'CloudFront debe redirigir a HTTPS')
assert(Boolean(defaultBehavior?.ResponseHeadersPolicyId), 'CloudFront debe aplicar la política de cabeceras de seguridad')
assert(distributionConfig?.HttpVersion === 'http2and3', 'CloudFront debe habilitar HTTP/2 y HTTP/3')
exact('AWS::OpenSearchServerless::CollectionGroup', 1)
exact('AWS::OpenSearchServerless::Collection', 1)
exact('AWS::OpenSearchServerless::SecurityPolicy', 2)
exact('AWS::OpenSearchServerless::AccessPolicy', 2)
exact('AWS::CloudWatch::Dashboard', 1)

const courseAccessPolicy = JSON.stringify(resources('AWS::OpenSearchServerless::AccessPolicy', 'Courses')[0]?.Properties?.Policy)
const readPolicyEnd = courseAccessPolicy.indexOf('Course indexer maintains course documents')
assert(readPolicyEnd > 0, 'Courses: falta separar la política de búsqueda de la del indexador')
assert(!courseAccessPolicy.slice(0, readPolicyEnd).includes('aoss:WriteDocument'),
  'Courses: la Lambda de búsqueda no debe tener permisos de escritura en OpenSearch')
assert(courseAccessPolicy.includes('aoss:CreateIndex'), 'Courses: el indexador debe poder crear el índice')
const scheduleAccessPolicy = JSON.stringify(resources('AWS::OpenSearchServerless::AccessPolicy', 'Schedules')[0]?.Properties?.Policy)
assert(scheduleAccessPolicy.includes('aoss:CreateIndex'), 'Schedules: el indexador debe poder crear el índice')

for (const suffix of ['create-schedule', 'update-schedule', 'delete-schedule']) {
  const variables = (namedFunction('Schedules', suffix).Properties?.Environment as { Variables?: Record<string, unknown> } | undefined)?.Variables
  assert(Boolean(variables?.COURSES_TABLE), `Schedules: ${suffix} debe recibir la tabla de cursos para validar propiedad`)
}
const listVariables = (namedFunction('Schedules', 'list-schedules').Properties?.Environment as { Variables?: Record<string, unknown> } | undefined)?.Variables
assert(!listVariables?.COURSES_TABLE, 'Schedules: list-schedules no debe recibir dependencias que no utiliza')
const searchVariables = (namedFunction('Courses', 'search-courses').Properties?.Environment as { Variables?: Record<string, unknown> } | undefined)?.Variables
assert(!searchVariables?.COURSES_TABLE, 'Courses: search-courses no debe recibir acceso innecesario a DynamoDB')

console.log(`Auditoría AWS correcta: 10 stacks, 25 Lambdas, 5 APIs protegidas, 5 tablas y observabilidad centralizada (${stage}).`)

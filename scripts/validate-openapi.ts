import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const httpMethods = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head'])

interface Operation {
  operationId?: string
  summary?: string
  responses?: Record<string, unknown>
}

interface OpenApiDocument {
  openapi?: string
  security?: unknown[]
  paths?: Record<string, Record<string, Operation>>
  components?: Record<string, unknown>
}

const services = [
  ['users', 'users-service-stack.ts'],
  ['organizations', 'organizations-service-stack.ts'],
  ['courses', 'courses-service-stack.ts'],
  ['schedules', 'schedules-service-stack.ts'],
  ['purchases', 'purchases-service-stack.ts']
] as const

function fail(message: string): never {
  throw new Error(`OpenAPI inválido: ${message}`)
}

function codeRoutes(stackFile: string): string[] {
  const source = fs.readFileSync(path.join(root, 'infrastructure', 'cdk', 'stacks', stackFile), 'utf8')
  const routes: string[] = []
  const pattern = /api\.addRoute\('([^']+)',\s*'([A-Z]+)'/g
  for (const match of source.matchAll(pattern)) routes.push(`${match[2]!.toLowerCase()} ${match[1]}`)
  return routes.sort()
}

function documentedRoutes(document: OpenApiDocument, service: string): string[] {
  const routes: string[] = []
  const operationIds = new Set<string>()
  for (const [route, pathItem] of Object.entries(document.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!httpMethods.has(method)) continue
      routes.push(`${method} ${route}`)
      if (!operation.operationId) fail(`${service}: ${method.toUpperCase()} ${route} no tiene operationId`)
      if (operationIds.has(operation.operationId)) fail(`${service}: operationId duplicado ${operation.operationId}`)
      operationIds.add(operation.operationId)
      if (!operation.summary) fail(`${service}: ${operation.operationId} no tiene summary`)
      if (!operation.responses || Object.keys(operation.responses).length === 0) fail(`${service}: ${operation.operationId} no tiene responses`)
      if (!Object.keys(operation.responses).some((status) => /^2\d\d$/.test(status))) fail(`${service}: ${operation.operationId} no documenta respuesta exitosa`)
      if (!operation.responses['401']) fail(`${service}: ${operation.operationId} no documenta 401`)
      if (!operation.responses['500']) fail(`${service}: ${operation.operationId} no documenta 500`)
    }
  }
  return routes.sort()
}

function resolveLocalReference(document: OpenApiDocument, reference: string, service: string): void {
  if (!reference.startsWith('#/')) return
  let current: unknown = document
  for (const rawPart of reference.slice(2).split('/')) {
    const part = rawPart.replaceAll('~1', '/').replaceAll('~0', '~')
    if (!current || typeof current !== 'object' || !(part in current)) fail(`${service}: referencia inexistente ${reference}`)
    current = (current as Record<string, unknown>)[part]
  }
}

function validateLocalReferences(value: unknown, document: OpenApiDocument, service: string): void {
  if (Array.isArray(value)) {
    for (const item of value) validateLocalReferences(item, document, service)
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    if (key === '$ref' && typeof child === 'string') resolveLocalReference(document, child, service)
    else validateLocalReferences(child, document, service)
  }
}

function validateExternalExamples(value: unknown, directory: string, service: string): void {
  if (Array.isArray(value)) {
    for (const item of value) validateExternalExamples(item, directory, service)
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    if (key === 'externalValue' && typeof child === 'string' && child.startsWith('./')) {
      const exampleFile = path.resolve(directory, child)
      if (!exampleFile.startsWith(directory + path.sep)) fail(`${service}: ejemplo fuera del directorio docs: ${child}`)
      if (!fs.existsSync(exampleFile)) fail(`${service}: no existe el ejemplo ${child}`)
      if (path.extname(exampleFile) === '.json') JSON.parse(fs.readFileSync(exampleFile, 'utf8'))
    } else {
      validateExternalExamples(child, directory, service)
    }
  }
}

for (const [service, stackFile] of services) {
  const docsDirectory = path.join(root, 'services', `${service}-service`, 'docs')
  const specFile = path.join(docsDirectory, 'openapi.yaml')
  if (!fs.existsSync(specFile)) fail(`${service}: falta ${specFile}`)
  const document = parse(fs.readFileSync(specFile, 'utf8')) as OpenApiDocument
  if (document.openapi !== '3.0.3') fail(`${service}: se esperaba OpenAPI 3.0.3`)
  if (!document.security?.length) fail(`${service}: falta seguridad global Cognito`)
  const schemes = document.components?.securitySchemes as Record<string, unknown> | undefined
  if (!schemes?.CognitoIdToken) fail(`${service}: falta components.securitySchemes.CognitoIdToken`)
  const expected = codeRoutes(stackFile)
  const actual = documentedRoutes(document, service)
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${service}: rutas CDK ${JSON.stringify(expected)} != documentación ${JSON.stringify(actual)}`)
  }
  validateExternalExamples(document, docsDirectory, service)
  validateLocalReferences(document, document, service)
  console.log(`✓ ${service}: ${actual.length} operaciones documentadas`)
}

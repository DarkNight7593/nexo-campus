#!/usr/bin/env node
import { App, Tags } from 'aws-cdk-lib'
import { loadStageConfig, stackPrefix } from '../stacks/config.js'
import { FoundationStack } from '../stacks/foundation-stack.js'
import { WebStack } from '../stacks/web-stack.js'
import { AuthStack } from '../stacks/auth-stack.js'
import { SearchStack } from '../stacks/search-stack.js'
import { UsersServiceStack } from '../stacks/users-service-stack.js'
import { OrganizationsServiceStack } from '../stacks/organizations-service-stack.js'
import { CoursesServiceStack } from '../stacks/courses-service-stack.js'
import { SchedulesServiceStack } from '../stacks/schedules-service-stack.js'
import { PurchasesServiceStack } from '../stacks/purchases-service-stack.js'
import { MonitoringStack } from '../stacks/monitoring-stack.js'

const app = new App()
const config = loadStageConfig(app)
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION ?? config.region }
const prefix = stackPrefix(config)

const foundation = new FoundationStack(app, `${prefix}-Foundation`, { env, config })
const web = new WebStack(app, `${prefix}-Web`, { env, config })
const auth = new AuthStack(app, `${prefix}-Auth`, { env, config, webUrl: web.webUrl })
const search = new SearchStack(app, `${prefix}-Search`, { env, config })
const serviceConfig = { ...config, allowedOrigins: [web.webUrl, ...config.allowedOrigins] }
const users = new UsersServiceStack(app, `${prefix}-Users`, { env, config: serviceConfig, userPool: auth.userPool })
const organizations = new OrganizationsServiceStack(app, `${prefix}-Organizations`, { env, config: serviceConfig, userPool: auth.userPool })
const courses = new CoursesServiceStack(app, `${prefix}-Courses`, {
  env, config: serviceConfig, userPool: auth.userPool, openSearchEndpoint: search.collection.attrCollectionEndpoint, openSearchArn: search.collection.attrArn, openSearchCollectionName: search.collection.name
})
const schedules = new SchedulesServiceStack(app, `${prefix}-Schedules`, {
  env, config: serviceConfig, userPool: auth.userPool, coursesTable: courses.table, openSearchEndpoint: search.collection.attrCollectionEndpoint, openSearchArn: search.collection.attrArn, openSearchCollectionName: search.collection.name
})
const purchases = new PurchasesServiceStack(app, `${prefix}-Purchases`, {
  env, config: serviceConfig, userPool: auth.userPool, dataBucket: foundation.dataBucket,
  coursesTable: courses.table, schedulesTable: schedules.table
})
new MonitoringStack(app, `${prefix}-Monitoring`, {
  env, config, functions: [...users.functions, ...organizations.functions, ...courses.functions, ...schedules.functions, ...purchases.functions]
})

auth.addStackDependency(web)
users.addStackDependency(foundation)
organizations.addStackDependency(foundation)
courses.addStackDependency(foundation)
schedules.addStackDependency(foundation)
purchases.addStackDependency(foundation)
purchases.addStackDependency(courses)
purchases.addStackDependency(schedules)
courses.addStackDependency(search)
schedules.addStackDependency(search)

for (const stack of app.node.children) {
  Tags.of(stack).add('Application', 'cloud-learning-platform')
  Tags.of(stack).add('Stage', config.stage)
  Tags.of(stack).add('ManagedBy', 'AWS-CDK')
}

app.synth()

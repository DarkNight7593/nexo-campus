import { Duration, Stack, aws_cloudwatch as cloudwatch } from 'aws-cdk-lib'
import type { StackProps } from 'aws-cdk-lib'
import type { IFunction } from 'aws-cdk-lib/aws-lambda'
import type { Construct } from 'constructs'
import type { StageConfig } from './config.js'

export interface MonitoringStackProps extends StackProps { config: StageConfig; functions: IFunction[] }

export class MonitoringStack extends Stack {
  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props)
    const dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: `cloud-learning-${props.config.stage}`,
      periodOverride: cloudwatch.PeriodOverride.AUTO
    })
    if (props.functions.length > 0) {
      dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: 'Lambda invocations and errors', width: 24, period: Duration.minutes(5),
          left: props.functions.map((fn) => fn.metricInvocations()),
          right: props.functions.map((fn) => fn.metricErrors())
        }),
        new cloudwatch.GraphWidget({
          title: 'Lambda duration p95', width: 24, period: Duration.minutes(5),
          left: props.functions.map((fn) => fn.metricDuration({ statistic: 'p95' }))
        })
      )
    }
  }
}

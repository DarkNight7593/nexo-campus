import { Aws, CfnOutput, RemovalPolicy, Stack, aws_cognito as cognito } from 'aws-cdk-lib'
import type { StackProps } from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import type { StageConfig } from './config.js'

export interface AuthStackProps extends StackProps { config: StageConfig; webUrl: string }

export class AuthStack extends Stack {
  readonly userPool: cognito.UserPool
  readonly userPoolClient: cognito.UserPoolClient
  readonly cognitoDomain: string

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props)
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `cloud-learning-${props.config.stage}`,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      signInCaseSensitive: false,
      customAttributes: {
        tenant_id: new cognito.StringAttribute({ minLen: 1, maxLen: 64, mutable: true }),
        role: new cognito.StringAttribute({ minLen: 4, maxLen: 16, mutable: true })
      },
      passwordPolicy: { minLength: 10, requireDigits: true, requireLowercase: true, requireUppercase: true, requireSymbols: true },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: { sms: false, otp: true },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      deletionProtection: props.config.removalPolicy === 'retain',
      removalPolicy: props.config.removalPolicy === 'destroy' ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN
    })
    this.userPoolClient = this.userPool.addClient('WebClient', {
      userPoolClientName: `cloud-learning-web-${props.config.stage}`,
      generateSecret: false,
      authFlows: { userSrp: true },
      preventUserExistenceErrors: true,
      readAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({ email: true, emailVerified: true })
        .withCustomAttributes('tenant_id', 'role'),
      writeAttributes: new cognito.ClientAttributes().withStandardAttributes({ email: true }),
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: [`${props.webUrl}/auth/callback`],
        logoutUrls: [props.webUrl]
      }
    })
    const domain = this.userPool.addDomain('HostedUiDomain', {
      cognitoDomain: { domainPrefix: `cl-${props.config.stage}-${Aws.ACCOUNT_ID}` }
    })
    this.cognitoDomain = domain.baseUrl()
    const groups = [
      { name: 'admin', precedence: 0, description: 'Administración del tenant' },
      { name: 'instructor', precedence: 10, description: 'Gestión académica y de cursos' },
      { name: 'student', precedence: 20, description: 'Acceso de estudiante' }
    ]
    for (const group of groups) {
      new cognito.CfnUserPoolGroup(this, `${group.name}Group`, {
        userPoolId: this.userPool.userPoolId,
        groupName: group.name,
        description: group.description,
        precedence: group.precedence
      })
    }
    new CfnOutput(this, 'UserPoolId', { value: this.userPool.userPoolId })
    new CfnOutput(this, 'UserPoolClientId', { value: this.userPoolClient.userPoolClientId })
    new CfnOutput(this, 'CognitoDomain', { value: this.cognitoDomain })
  }
}

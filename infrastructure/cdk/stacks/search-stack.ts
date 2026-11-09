import { CfnOutput, Stack, aws_opensearchserverless as aoss } from 'aws-cdk-lib'
import type { StackProps } from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import type { StageConfig } from './config.js'

export interface SearchStackProps extends StackProps { config: StageConfig }

export class SearchStack extends Stack {
  readonly collection: aoss.CfnCollection

  constructor(scope: Construct, id: string, props: SearchStackProps) {
    super(scope, id, props)
    const collectionName = `cl-${props.config.stage}-courses`
    const group = new aoss.CfnCollectionGroup(this, 'CollectionGroup', {
      name: `cl-${props.config.stage}-search`,
      description: `Search capacity boundaries for ${props.config.stage}`,
      generation: 'NEXTGEN',
      standbyReplicas: props.config.openSearch.standbyReplicas,
      capacityLimits: {
        minIndexingCapacityInOcu: props.config.openSearch.minIndexingOcu,
        maxIndexingCapacityInOcu: props.config.openSearch.maxIndexingOcu,
        minSearchCapacityInOcu: props.config.openSearch.minSearchOcu,
        maxSearchCapacityInOcu: props.config.openSearch.maxSearchOcu
      }
    })
    const encryption = new aoss.CfnSecurityPolicy(this, 'EncryptionPolicy', {
      name: `cl-${props.config.stage}-enc`, type: 'encryption',
      policy: JSON.stringify({ Rules: [{ ResourceType: 'collection', Resource: [`collection/${collectionName}`] }], AWSOwnedKey: true })
    })
    const network = new aoss.CfnSecurityPolicy(this, 'NetworkPolicy', {
      name: `cl-${props.config.stage}-net`, type: 'network',
      policy: JSON.stringify([{ Rules: [{ ResourceType: 'collection', Resource: [`collection/${collectionName}`] }, { ResourceType: 'dashboard', Resource: [`collection/${collectionName}`] }], AllowFromPublic: true }])
    })
    this.collection = new aoss.CfnCollection(this, 'Collection', {
      name: collectionName,
      description: `Course search for ${props.config.stage}`,
      type: 'SEARCH',
      collectionGroupName: group.name
    })
    this.collection.addResourceDependency(group)
    this.collection.addResourceDependency(encryption)
    this.collection.addResourceDependency(network)
    new CfnOutput(this, 'OpenSearchEndpoint', { value: this.collection.attrCollectionEndpoint })
    new CfnOutput(this, 'OpenSearchCollectionArn', { value: this.collection.attrArn })
    new CfnOutput(this, 'OpenSearchDashboardEndpoint', { value: this.collection.attrDashboardEndpoint })
    new CfnOutput(this, 'OpenSearchCollectionName', { value: collectionName })
  }
}

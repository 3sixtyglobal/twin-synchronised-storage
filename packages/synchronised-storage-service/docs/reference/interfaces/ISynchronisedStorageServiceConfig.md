# Interface: ISynchronisedStorageServiceConfig

Configuration for the Synchronised Storage Service.

## Properties

### entityUpdateIntervalMinutes? {#entityupdateintervalminutes}

> `optional` **entityUpdateIntervalMinutes**: `number`

How often to check for entity updates in minutes.

***

### consolidationIntervalMinutes? {#consolidationintervalminutes}

> `optional` **consolidationIntervalMinutes**: `number`

Interval to perform consolidation of changesets, only used if this is a trusted node.

***

### consolidationBatchSize? {#consolidationbatchsize}

> `optional` **consolidationBatchSize**: `number`

The number of entities to process in a single consolidation batch, only used if this is a trusted node.

***

### maxConsolidations? {#maxconsolidations}

> `optional` **maxConsolidations**: `number`

The maximum number of consolidations to keep in storage, only used if this is a trusted node.

***

### blobStorageEncryptionKeyId? {#blobstorageencryptionkeyid}

> `optional` **blobStorageEncryptionKeyId**: `string`

The encryption key id from the vault to use for blob storage, only required for trusted nodes, untrusted nodes will request the key.

***

### verifiableStorageKeyId {#verifiablestoragekeyid}

> **verifiableStorageKeyId**: `string`

The verifiable storage key to use, already expected to be created.
if the key is not found in the keys.json it is considered to be a custom verifiable storage id.

***

### overrideTrustGeneratorType? {#overridetrustgeneratortype}

> `optional` **overrideTrustGeneratorType**: `string`

Override the default trust generator.

# Interface: ISynchronisedStorageServiceConstructorOptions

Options for the Synchronised Storage Service constructor.

## Properties

### loggingComponentType? {#loggingcomponenttype}

> `optional` **loggingComponentType**: `string`

The logging component.

***

### eventBusComponentType? {#eventbuscomponenttype}

> `optional` **eventBusComponentType**: `string`

The event bus component type.

***

### vaultConnectorType? {#vaultconnectortype}

> `optional` **vaultConnectorType**: `string`

The vault connector type.

***

### syncSnapshotStorageConnectorType? {#syncsnapshotstorageconnectortype}

> `optional` **syncSnapshotStorageConnectorType**: `string`

The entity storage connector type to use for sync snapshots.

***

### blobStorageConnectorType? {#blobstorageconnectortype}

> `optional` **blobStorageConnectorType**: `string`

The blob storage connector used for remote sync state.

***

### verifiableStorageConnectorType? {#verifiablestorageconnectortype}

> `optional` **verifiableStorageConnectorType**: `string`

The verifiable storage connector type to use for decentralised state.

***

### taskSchedulerComponentType? {#taskschedulercomponenttype}

> `optional` **taskSchedulerComponentType**: `string`

The task scheduler component.

***

### trustComponentType? {#trustcomponenttype}

> `optional` **trustComponentType**: `string`

The type of the trust component.

***

### trustedSynchronisedStorageComponentType? {#trustedsynchronisedstoragecomponenttype}

> `optional` **trustedSynchronisedStorageComponentType**: `string`

The synchronised entity storage component type to use if this node is not trusted.
If this is set, this node uses it as the trusted node to store changesets.

***

### config {#config}

> **config**: [`ISynchronisedStorageServiceConfig`](ISynchronisedStorageServiceConfig.md)

The configuration for the connector.

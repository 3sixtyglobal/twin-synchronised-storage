# Interface: ISynchronisedStorageServiceConstructorOptions

Options for the Synchronised Storage Service constructor.

## Properties

### loggingConnectorType?

> `optional` **loggingConnectorType**: `string`

The logging connector.

***

### eventBusComponentType?

> `optional` **eventBusComponentType**: `string`

The event bus component type.

***

### syncSnapshotStorageConnectorType?

> `optional` **syncSnapshotStorageConnectorType**: `string`

The entity storage connector type to use for sync snapshots.

#### Default

```ts
sync-snapshot-entry
```

***

### blobStorageComponentType?

> `optional` **blobStorageComponentType**: `string`

The blob storage component used for remote sync state.

#### Default

```ts
blob-storage
```

***

### verifiableStorageConnectorType?

> `optional` **verifiableStorageConnectorType**: `string`

The verifiable storage connector type to use for decentralised state.

#### Default

```ts
verifiable-storage
```

***

### identityConnectorType?

> `optional` **identityConnectorType**: `string`

The identity connector.

#### Default

```ts
identity
```

***

### trustedSynchronisedStorageComponentType?

> `optional` **trustedSynchronisedStorageComponentType**: `string`

The synchronised entity storage component type to use if this node is not trusted.

***

### config

> **config**: [`ISynchronisedStorageServiceConfig`](ISynchronisedStorageServiceConfig.md)

The configuration for the connector.

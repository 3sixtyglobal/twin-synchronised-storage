# Interface: ISyncBatchResponse\<T\>

Response for a local batch.

## Type Parameters

### T

`T` *extends* [`ISynchronisedEntity`](ISynchronisedEntity.md)

## Properties

### storageKey

> **storageKey**: `string`

The key of the storage for the entities in the batch.

***

### primaryKey

> **primaryKey**: keyof `T`

The primary key of the entity in the sync item response.

***

### entities

> **entities**: `T`[]

The entities in the batch.

***

### lastEntry

> **lastEntry**: `boolean`

Is this the last entry in the batch?

# Interface: ISyncConsolidationBatchResponse\<T\>

Response for a local consolidation batch.

## Type Parameters

### T

`T` *extends* [`ISynchronisedEntity`](ISynchronisedEntity.md)

## Properties

### schemaType

> **schemaType**: `string`

The type of the schema for the entities in the batch.

***

### entities

> **entities**: `object`[]

The entities in the consolidation batch.

#### id

> **id**: `string`

#### entity

> **entity**: `T`

***

### lastEntry

> **lastEntry**: `boolean`

Is this the last entry in the batch?

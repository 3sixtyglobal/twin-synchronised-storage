# Interface: ISyncItemResponse\<T\>

Response for a sync item request.

## Type Parameters

### T

`T` *extends* [`ISynchronisedEntity`](ISynchronisedEntity.md)

## Properties

### schemaType

> **schemaType**: `string`

The type of the schema for the entities in the batch.

***

### id

> **id**: `string`

The id of the entity in the sync item response.

***

### entity?

> `optional` **entity**: `T`

The entity in the sync item response, undefined if not found.

# Interface: ISyncItemResponse

Response for a sync item request.

## Properties

### storageKey {#storagekey}

> **storageKey**: `string`

The key of the storage for the entities in the batch.

***

### id {#id}

> **id**: `string`

The id of the entity in the sync item response.

***

### entity? {#entity}

> `optional` **entity?**: [`ISynchronisedEntity`](ISynchronisedEntity.md)

The entity in the sync item response, undefined if not found.

# Interface: ISyncItemResponse

Response for a sync item request.

## Properties

### storageKey {#storagekey}

> **storageKey**: `string`

The key of the storage containing the responding item.

***

### id {#id}

> **id**: `string`

The id of the entity in the sync item response.

***

### entity? {#entity}

> `optional` **entity?**: [`ISynchronisedEntity`](ISynchronisedEntity.md)

The entity in the sync item response, undefined if not found.

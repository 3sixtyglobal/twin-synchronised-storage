# Interface: ISyncChange\<T\>

The object definition for a sync change.

## Type Parameters

### T

`T` *extends* `ISynchronisedEntity` = `ISynchronisedEntity`

## Properties

### operation

> **operation**: `"set"` \| `"delete"`

Operation.

***

### id

> **id**: `string`

The item id.

***

### entity?

> `optional` **entity**: `T`

The entity to set.

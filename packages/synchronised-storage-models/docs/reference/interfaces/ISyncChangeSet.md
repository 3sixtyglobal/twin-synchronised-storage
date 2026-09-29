# Interface: ISyncChangeSet

The object definition for a sync change set.

## Properties

### @context {#context}

> **@context**: `"https://schema.twindev.org/synchronised-storage/"`

The LD Context for the change set.

***

### type {#type}

> **type**: `"SyncChangeSet"`

The LD Type for the change set.

***

### id {#id}

> **id**: `string`

The id of the change set.

***

### storageKey {#storagekey}

> **storageKey**: `string`

The storage key of the change set. This is used to identify the entities being synchronised.

***

### dateCreated {#datecreated}

> **dateCreated**: `string`

The date the change set was created.

***

### dateModified {#datemodified}

> **dateModified**: `string`

The date the change set was last modified.

***

### nodeIdentity {#nodeidentity}

> **nodeIdentity**: `string`

The identity of the node that created the change set.

***

### changes {#changes}

> **changes**: [`ISyncChange`](ISyncChange.md)[]

The changes to apply after a snapshot.

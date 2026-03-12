# Interface: ISyncSnapshot

The object definition for a sync snapshot.

## Properties

### version {#version}

> **version**: `string`

The version of the sync state.

***

### id {#id}

> **id**: `string`

The id of the snapshot.

***

### dateCreated {#datecreated}

> **dateCreated**: `string`

The date the snapshot was created.

***

### dateModified {#datemodified}

> **dateModified**: `string`

The date the snapshot was last modified.

***

### isConsolidated {#isconsolidated}

> **isConsolidated**: `boolean`

Is this a consolidated snapshot?

***

### epoch {#epoch}

> **epoch**: `number`

The epoch of the snapshot.

***

### changeSetStorageIds {#changesetstorageids}

> **changeSetStorageIds**: `string`[]

The ids of the storage for the change sets in the snapshot.

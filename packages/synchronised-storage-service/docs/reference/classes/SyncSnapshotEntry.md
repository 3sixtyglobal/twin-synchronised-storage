# Class: SyncSnapshotEntry

Class representing an entry for the sync snapshot.

## Constructors

### Constructor

> **new SyncSnapshotEntry**(): `SyncSnapshotEntry`

#### Returns

`SyncSnapshotEntry`

## Properties

### id {#id}

> **id**: `string`

The id for the snapshot.

***

### version {#version}

> **version**: `string`

The version for the snapshot.

***

### storageKey {#storagekey}

> **storageKey**: `string`

The storage key for the snapshot i.e. which entity is being synchronized.

***

### dateCreated {#datecreated}

> **dateCreated**: `string`

The date the snapshot was created.

***

### dateModified {#datemodified}

> **dateModified**: `string`

The date the snapshot was last modified.

***

### isLocal {#islocal}

> **isLocal**: `boolean`

The flag to determine if this is the snapshot is the local one containing changes for this node.

***

### isConsolidated {#isconsolidated}

> **isConsolidated**: `boolean`

The flag to determine if this is a consolidated snapshot.

***

### epoch {#epoch}

> **epoch**: `number`

The epoch for the changeset.

***

### changeSetStorageIds? {#changesetstorageids}

> `optional` **changeSetStorageIds?**: `string`[]

The ids of the storage for the change sets in the snapshot, if this is not a local snapshot.

***

### changes? {#changes}

> `optional` **changes?**: `ISyncChange`[]

The changes that were made in this snapshot, if this is a local snapshot.

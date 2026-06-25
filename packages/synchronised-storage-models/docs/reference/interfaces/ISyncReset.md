# Interface: ISyncReset

Request to reset the local storage.

## Properties

### storageKey {#storagekey}

> **storageKey**: `string`

The key of the storage to reset.

***

### resetMode {#resetmode}

> **resetMode**: [`SyncNodeIdMode`](../type-aliases/SyncNodeIdMode.md)

Reset mode, this will use the nodeId in the entities to determine which are local/remote.

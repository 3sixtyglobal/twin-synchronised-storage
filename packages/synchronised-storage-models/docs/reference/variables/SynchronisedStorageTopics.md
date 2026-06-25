# Variable: SynchronisedStorageTopics

> `const` **SynchronisedStorageTopics**: `object`

The topics for synchronised storage event bus notifications.

## Type Declaration

### RegisterStorageKey {#registerstoragekey}

> `readonly` **RegisterStorageKey**: `"synchronised-storage:register-storage-key"` = `"synchronised-storage:register-storage-key"`

Register a storage key for the synchronised storage.

### LocalItemChange {#localitemchange}

> `readonly` **LocalItemChange**: `"synchronised-storage:local-item-change"` = `"synchronised-storage:local-item-change"`

An item was changed in the storage by the local node.

### LocalItemRequest {#localitemrequest}

> `readonly` **LocalItemRequest**: `"synchronised-storage:local-item-request"` = `"synchronised-storage:local-item-request"`

A request has been made for a local item.

### LocalItemResponse {#localitemresponse}

> `readonly` **LocalItemResponse**: `"synchronised-storage:local-item-response"` = `"synchronised-storage:local-item-response"`

A response to a local item request.

### Reset {#reset}

> `readonly` **Reset**: `"synchronised-storage:reset"` = `"synchronised-storage:reset"`

Reset the storage.

### BatchRequest {#batchrequest}

> `readonly` **BatchRequest**: `"synchronised-storage:batch-request"` = `"synchronised-storage:batch-request"`

A request has been made for a batch.

### BatchResponse {#batchresponse}

> `readonly` **BatchResponse**: `"synchronised-storage:batch-response"` = `"synchronised-storage:batch-response"`

A response to a batch.

### RemoteItemSet {#remoteitemset}

> `readonly` **RemoteItemSet**: `"synchronised-storage:remote-item-set"` = `"synchronised-storage:remote-item-set"`

An item was set in the storage by the remote node.

### RemoteItemRemove {#remoteitemremove}

> `readonly` **RemoteItemRemove**: `"synchronised-storage:remote-item-remove"` = `"synchronised-storage:remote-item-remove"`

An item was removed from the storage by the remote node.

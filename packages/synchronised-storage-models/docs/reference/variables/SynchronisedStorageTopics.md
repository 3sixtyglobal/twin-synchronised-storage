# Variable: SynchronisedStorageTopics

> `const` **SynchronisedStorageTopics**: `object`

The topics for synchronised storage event bus notifications.

## Type declaration

### RegisterSchemaType

> `readonly` **RegisterSchemaType**: `"synchronised-storage:register-schema-type"` = `"synchronised-storage:register-schema-type"`

Register a schema type for the synchronised storage.

### LocalItemChange

> `readonly` **LocalItemChange**: `"synchronised-storage:local-item-change"` = `"synchronised-storage:local-item-change"`

An item was changed in the storage by the local node.

### LocalItemRequest

> `readonly` **LocalItemRequest**: `"synchronised-storage:local-item-request"` = `"synchronised-storage:local-item-request"`

A request has been made for a local item.

### LocalItemResponse

> `readonly` **LocalItemResponse**: `"synchronised-storage:local-item-response"` = `"synchronised-storage:local-item-response"`

A response to a local item request.

### BatchRequest

> `readonly` **BatchRequest**: `"synchronised-storage:batch-request"` = `"synchronised-storage:batch-request"`

A request has been made for a batch.

### BatchResponse

> `readonly` **BatchResponse**: `"synchronised-storage:batch-response"` = `"synchronised-storage:batch-response"`

A response to a batch.

### RemoteItemSet

> `readonly` **RemoteItemSet**: `"synchronised-storage:remote-item-set"` = `"synchronised-storage:remote-item-set"`

An item was set in the storage by the remote node.

### RemoteItemRemove

> `readonly` **RemoteItemRemove**: `"synchronised-storage:remote-item-remove"` = `"synchronised-storage:remote-item-remove"`

An item was removed from the storage by the remote node.

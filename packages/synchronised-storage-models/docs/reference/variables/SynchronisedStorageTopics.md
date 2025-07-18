# Variable: SynchronisedStorageTopics

> `const` **SynchronisedStorageTopics**: `object`

The topics for synchronised storage event bus notifications.

## Type declaration

### RegisterSchemaType

> `readonly` **RegisterSchemaType**: `"synchronised-storage:register-schema-type"` = `"synchronised-storage:register-schema-type"`

Register a schema type for the synchronised storage.

### LocalItemSet

> `readonly` **LocalItemSet**: `"synchronised-storage:local-item-set"` = `"synchronised-storage:local-item-set"`

An item was set in the storage by the local node.

### LocalItemRemove

> `readonly` **LocalItemRemove**: `"synchronised-storage:local-item-remove"` = `"synchronised-storage:local-item-remove"`

An item was removed from the storage by the local node.

### ConsolidationBatchRequest

> `readonly` **ConsolidationBatchRequest**: `"synchronised-storage:consolidation-batch-request"` = `"synchronised-storage:consolidation-batch-request"`

A request has been made for a consolidation batch.

### ConsolidationBatchResponse

> `readonly` **ConsolidationBatchResponse**: `"synchronised-storage:consolidation-batch-response"` = `"synchronised-storage:consolidation-batch-response"`

A response to a consolidation batch.

### RemoteItemSet

> `readonly` **RemoteItemSet**: `"synchronised-storage:remote-item-set"` = `"synchronised-storage:remote-item-set"`

An item was set in the storage by the remote node.

### RemoteItemRemove

> `readonly` **RemoteItemRemove**: `"synchronised-storage:remote-item-remove"` = `"synchronised-storage:remote-item-remove"`

An item was removed from the storage by the remote node.

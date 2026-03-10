# Synchronised Storage Models Examples

Use these model-focused snippets to define strongly typed payloads for synchronisation requests, changes, and event bus workflows.

## Model Contracts

```typescript
import {
  SynchronisedStorageContexts,
  SynchronisedStorageTypes,
  SyncChangeOperation,
  type ISyncChangeSet
} from '@twin.org/synchronised-storage-models';

const syncChangeSet: ISyncChangeSet = {
  '@context': SynchronisedStorageContexts.Context,
  type: SynchronisedStorageTypes.ChangeSet,
  id: 'changeset-001',
  storageKey: 'profile',
  dateCreated: '2026-03-10T11:00:00.000Z',
  dateModified: '2026-03-10T11:00:00.000Z',
  nodeIdentity: 'did:iota:node-1',
  changes: [
    {
      operation: SyncChangeOperation.Set,
      id: 'profile-42',
      entity: {
        dateModified: '2026-03-10T11:00:00.000Z'
      }
    }
  ]
};

console.log(syncChangeSet.changes[0].operation); // set
```

```typescript
import {
  SyncNodeIdMode,
  SynchronisedStorageTopics,
  type ISynchronisedEntity
} from '@twin.org/synchronised-storage-models';

interface IProfileEntity extends ISynchronisedEntity {
  displayName: string;
}

const entity: IProfileEntity = {
  id: 'profile-42',
  nodeIdentity: 'did:iota:node-1',
  dateModified: '2026-03-10T11:05:00.000Z',
  displayName: 'Rowan'
};

const topic = SynchronisedStorageTopics.LocalItemChange;
const mode = SyncNodeIdMode.Remote;

console.log(entity.id); // profile-42
console.log(topic); // synchronised-storage:local-item-change
console.log(mode); // remote
```

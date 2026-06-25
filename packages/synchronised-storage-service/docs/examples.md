# Synchronised Storage Service Examples

These examples show common node-side synchronisation flows, from startup and scheduling to trusted key exchange and inbound change application.

## SynchronisedStorageService

```typescript
import { SynchronisedStorageService } from '@twin.org/synchronised-storage-service';

const service = new SynchronisedStorageService({
  loggingComponentType: 'logging',
  eventBusComponentType: 'event-bus',
  taskSchedulerComponentType: 'task-scheduler',
  config: {
    verifiableStorageKeyId: 'devnet',
    entityUpdateIntervalMinutes: 2,
    consolidationIntervalMinutes: 30,
    consolidationBatchSize: 200,
    maxConsolidations: 8,
    blobStorageEncryptionKeyId: 'sync-blob-key'
  }
});

console.log(service.className()); // SynchronisedStorageService

await service.start('logging');
await service.stop('logging');
```

```typescript
import { SynchronisedStorageService } from '@twin.org/synchronised-storage-service';

const trustedService = new SynchronisedStorageService({
  config: {
    verifiableStorageKeyId: 'mainnet',
    blobStorageEncryptionKeyId: 'sync-blob-key'
  }
});

const trustPayload = 'eyJhbGciOiJFZERTQSJ9.trusted-node.signature';
const decryptionKey = await trustedService.getDecryptionKey(trustPayload);

console.log(decryptionKey.length); // 44
```

```typescript
import {
  SynchronisedStorageContexts,
  SynchronisedStorageTypes,
  SyncChangeOperation,
  type ISyncChangeSet
} from '@twin.org/synchronised-storage-models';
import { SynchronisedStorageService } from '@twin.org/synchronised-storage-service';

const trustedService = new SynchronisedStorageService({
  config: {
    verifiableStorageKeyId: 'testnet',
    blobStorageEncryptionKeyId: 'sync-blob-key'
  }
});

const changeSet: ISyncChangeSet = {
  '@context': SynchronisedStorageContexts.Context,
  type: SynchronisedStorageTypes.ChangeSet,
  id: 'changeset-remote-7',
  storageKey: 'profile',
  dateCreated: '2026-03-10T12:00:00.000Z',
  dateModified: '2026-03-10T12:00:00.000Z',
  nodeIdentity: 'did:iota:node-9',
  changes: [
    {
      operation: SyncChangeOperation.Delete,
      id: 'profile-7'
    }
  ]
};

const trustPayload = 'eyJhbGciOiJFZERTQSJ9.remote-node.signature';
await trustedService.syncChangeSet(changeSet, trustPayload);
```

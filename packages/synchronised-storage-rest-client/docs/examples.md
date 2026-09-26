# Synchronised Storage REST Client Examples

These snippets show how to call trusted synchronisation endpoints from a node or backend process using strongly typed request data.

## SynchronisedStorageRestClient

```typescript
import { SynchronisedStorageRestClient } from '@twin.org/synchronised-storage-rest-client';

const client = new SynchronisedStorageRestClient({
  endpoint: 'https://api.example.net'
});

const className = client.className();

console.log(className); // SynchronisedStorageRestClient
```

```typescript
import {
  SynchronisedStorageContexts,
  SynchronisedStorageTypes,
  type ISyncChangeSet
} from '@twin.org/synchronised-storage-models';
import { SynchronisedStorageRestClient } from '@twin.org/synchronised-storage-rest-client';

const client = new SynchronisedStorageRestClient({
  endpoint: 'https://api.example.net'
});

const trustPayload = 'eyJhbGciOiJFZERTQSJ9.sample-payload.signature';
const decryptionKey = await client.getDecryptionKey(trustPayload);

console.log(decryptionKey.length); // 44

const changeSet: ISyncChangeSet = {
  '@context': SynchronisedStorageContexts.Context,
  type: SynchronisedStorageTypes.SyncChangeSet,
  id: 'changeset-20260310-01',
  storageKey: 'profile',
  dateCreated: '2026-03-10T10:00:00.000Z',
  dateModified: '2026-03-10T10:00:00.000Z',
  nodeIdentity: 'did:iota:node-2',
  changes: [
    {
      operation: 'set',
      id: 'profile-4',
      entity: {
        dateModified: '2026-03-10T10:00:00.000Z'
      }
    }
  ]
};

await client.syncChangeSet(changeSet, trustPayload);
```

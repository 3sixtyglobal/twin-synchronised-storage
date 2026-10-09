# Entity Storage Connector Synchronised Examples

Use these scenarios to wire synchronised entity persistence into a node, query records, and react to remote updates through the event bus.

## SynchronisedEntityStorageConnector

```typescript
import type { IEntitySchema } from '@3sixty/entity';
import { SynchronisedEntityStorageConnector } from '@3sixty/entity-storage-connector-synchronised';
import type { ISynchronisedEntity } from '@3sixty/synchronised-storage-models';

interface IProfileEntity extends ISynchronisedEntity {
  displayName: string;
  status: 'active' | 'paused';
}

const connector = new SynchronisedEntityStorageConnector<IProfileEntity>({
  entitySchema: 'Profile',
  entityStorageConnectorType: 'entity-storage-memory',
  eventBusComponentType: 'event-bus',
  config: {
    storageKey: 'profile'
  }
});

const className = connector.className();
const schema = connector.getSchema() as IEntitySchema<IProfileEntity>;

console.log(className); // SynchronisedEntityStorageConnector
console.log(schema.id); // Profile
```

```typescript
import { SynchronisedEntityStorageConnector } from '@3sixty/entity-storage-connector-synchronised';
import { ComparisonOperator, SortDirection, type EntityCondition } from '@3sixty/entity';
import type { ISynchronisedEntity } from '@3sixty/synchronised-storage-models';

interface IProfileEntity extends ISynchronisedEntity {
  displayName: string;
  status: 'active' | 'paused';
}

const connector = new SynchronisedEntityStorageConnector<IProfileEntity>({
  entitySchema: 'Profile',
  entityStorageConnectorType: 'entity-storage-memory'
});

await connector.start('logging');

await connector.set({
  id: 'profile-1',
  nodeIdentity: 'did:iota:node-1',
  dateModified: '2026-03-10T09:00:00.000Z',
  displayName: 'Alex',
  status: 'active'
});

const condition: EntityCondition<IProfileEntity> = {
  property: 'status',
  comparison: ComparisonOperator.Equals,
  value: 'active'
};

const result = await connector.query(
  condition,
  [{ property: 'dateModified', sortDirection: SortDirection.Descending }],
  ['id', 'displayName', 'status'],
  '',
  20
);

console.log(result.entities.length); // 1
```

```typescript
import { SynchronisedEntityStorageConnector } from '@3sixty/entity-storage-connector-synchronised';
import type { ISynchronisedEntity } from '@3sixty/synchronised-storage-models';

interface IProfileEntity extends ISynchronisedEntity {
  displayName: string;
  status: 'active' | 'paused';
}

const connector = new SynchronisedEntityStorageConnector<IProfileEntity>({
  entitySchema: 'Profile',
  entityStorageConnectorType: 'entity-storage-memory'
});

const profile = await connector.get('profile-1', 'id', [{ property: 'status', value: 'active' }]);

console.log(profile?.displayName); // Alex

await connector.remove('profile-1', [{ property: 'status', value: 'active' }]);

const deletedProfile = await connector.get('profile-1');

console.log(deletedProfile); // undefined
```

# Class: SynchronisedStorageService

Class for performing synchronised storage operations.

## Implements

- `ISynchronisedStorageComponent`

## Constructors

### Constructor

> **new SynchronisedStorageService**(`options`): `SynchronisedStorageService`

Create a new instance of SynchronisedStorageService.

#### Parameters

##### options

[`ISynchronisedStorageServiceConstructorOptions`](../interfaces/ISynchronisedStorageServiceConstructorOptions.md)

The options for the service.

#### Returns

`SynchronisedStorageService`

## Properties

### CLASS\_NAME {#class_name}

> `readonly` `static` **CLASS\_NAME**: `string`

Runtime name for the class.

## Methods

### className() {#classname}

> **className**(): `string`

Returns the class name of the component.

#### Returns

`string`

The class name of the component.

#### Implementation of

`ISynchronisedStorageComponent.className`

***

### start() {#start}

> **start**(`nodeLoggingComponentType?`): `Promise`\<`void`\>

The component needs to be started when the node is initialized.

#### Parameters

##### nodeLoggingComponentType?

`string`

The node logging component type.

#### Returns

`Promise`\<`void`\>

A promise that resolves when the service is started and all event bus subscriptions are active.

#### Implementation of

`ISynchronisedStorageComponent.start`

***

### stop() {#stop}

> **stop**(`nodeLoggingComponentType?`): `Promise`\<`void`\>

The component needs to be stopped when the node is closed.

#### Parameters

##### nodeLoggingComponentType?

`string`

The node logging component type.

#### Returns

`Promise`\<`void`\>

A promise that resolves when all scheduled tasks are removed and storage keys are deactivated.

#### Implementation of

`ISynchronisedStorageComponent.stop`

***

### getDecryptionKey() {#getdecryptionkey}

> **getDecryptionKey**(`trustPayload`): `Promise`\<`string`\>

Get the decryption key for the synchronised storage.
This is used to decrypt the data stored in the synchronised storage.

#### Parameters

##### trustPayload

`unknown`

Trust payload to verify the requesters identity.

#### Returns

`Promise`\<`string`\>

The decryption key.

#### Implementation of

`ISynchronisedStorageComponent.getDecryptionKey`

***

### syncChangeSet() {#syncchangeset}

> **syncChangeSet**(`syncChangeSet`, `trustPayload`): `Promise`\<`void`\>

Synchronise a set of changes from an untrusted node, assumes this is a trusted node.

#### Parameters

##### syncChangeSet

`ISyncChangeSet`

The change set to synchronise.

##### trustPayload

`unknown`

Trust payload to verify the requesters identity.

#### Returns

`Promise`\<`void`\>

A promise that resolves when the change set has been applied and the sync state updated.

#### Implementation of

`ISynchronisedStorageComponent.syncChangeSet`

# Class: SynchronisedStorageService\<T\>

Class for performing synchronised storage operations.

## Type Parameters

### T

`T` *extends* `ISynchronisedEntity` = `ISynchronisedEntity`

## Implements

- `ISynchronisedStorageComponent`

## Constructors

### Constructor

> **new SynchronisedStorageService**\<`T`\>(`options`): `SynchronisedStorageService`\<`T`\>

Create a new instance of SynchronisedStorageService.

#### Parameters

##### options

[`ISynchronisedStorageServiceConstructorOptions`](../interfaces/ISynchronisedStorageServiceConstructorOptions.md)

The options for the service.

#### Returns

`SynchronisedStorageService`\<`T`\>

## Properties

### CLASS\_NAME

> `readonly` **CLASS\_NAME**: `string`

Runtime name for the class.

#### Implementation of

`ISynchronisedStorageComponent.CLASS_NAME`

## Methods

### start()

> **start**(`nodeIdentity`, `nodeLoggingConnectorType`, `componentState?`): `Promise`\<`void`\>

The component needs to be started when the node is initialized.

#### Parameters

##### nodeIdentity

`string`

The identity of the node starting the component.

##### nodeLoggingConnectorType

The node logging connector type, defaults to "node-logging".

`undefined` | `string`

##### componentState?

A persistent state which can be modified by the method.

#### Returns

`Promise`\<`void`\>

Nothing.

#### Implementation of

`ISynchronisedStorageComponent.start`

***

### stop()

> **stop**(`nodeIdentity`, `nodeLoggingConnectorType`, `componentState?`): `Promise`\<`void`\>

The component needs to be stopped when the node is closed.

#### Parameters

##### nodeIdentity

`string`

The identity of the node stopping the component.

##### nodeLoggingConnectorType

The node logging connector type, defaults to "node-logging".

`undefined` | `string`

##### componentState?

A persistent state which can be modified by the method.

#### Returns

`Promise`\<`void`\>

Nothing.

#### Implementation of

`ISynchronisedStorageComponent.stop`

***

### syncChangeSet()

> **syncChangeSet**(`changeSetStorageId`): `Promise`\<`void`\>

Synchronise a complete set of changes, assumes this is a trusted node.

#### Parameters

##### changeSetStorageId

`string`

The id of the change set to synchronise in blob storage.

#### Returns

`Promise`\<`void`\>

Nothing.

#### Implementation of

`ISynchronisedStorageComponent.syncChangeSet`

# Interface: ISynchronisedStorageComponent

Class for performing synchronised storage operations.

## Extends

- `IComponent`

## Methods

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

***

### syncChangeSet() {#syncchangeset}

> **syncChangeSet**(`syncChangeSet`, `trustPayload`): `Promise`\<`void`\>

Synchronise a set of changes from an untrusted node, assumes this is a trusted node.

#### Parameters

##### syncChangeSet

[`ISyncChangeSet`](ISyncChangeSet.md)

The change set to synchronise.

##### trustPayload

`unknown`

Trust payload to verify the requesters identity.

#### Returns

`Promise`\<`void`\>

Nothing.

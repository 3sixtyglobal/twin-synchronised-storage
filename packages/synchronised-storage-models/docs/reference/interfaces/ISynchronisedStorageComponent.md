# Interface: ISynchronisedStorageComponent

Class for performing synchronised storage operations.

## Extends

- `IComponent`

## Methods

### getDecryptionKey()

> **getDecryptionKey**(`proofToken`): `Promise`\<`string`\>

Get the decryption key for the synchronised storage.
This is used to decrypt the data stored in the synchronised storage.

#### Parameters

##### proofToken

`string`

The proof token to validate the request.

#### Returns

`Promise`\<`string`\>

The decryption key.

***

### syncChangeSet()

> **syncChangeSet**(`syncChangeSet`, `proofToken`): `Promise`\<`void`\>

Synchronise a set of changes from an untrusted node, assumes this is a trusted node.

#### Parameters

##### syncChangeSet

[`ISyncChangeSet`](ISyncChangeSet.md)

The change set to synchronise.

##### proofToken

`string`

The proof token to validate the request.

#### Returns

`Promise`\<`void`\>

Nothing.

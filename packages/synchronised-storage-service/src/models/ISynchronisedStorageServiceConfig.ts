// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Configuration for the Synchronised Storage Service.
 */
export interface ISynchronisedStorageServiceConfig {
	/**
	 * The id of the identity method to use when signing/verifying requests and changesets.
	 * @default synchronised-storage-assertion
	 */
	synchronisedStorageMethodId?: string;

	/**
	 * How often to check for entity updates in minutes.
	 * @default 5
	 */
	entityUpdateIntervalMinutes?: number;

	/**
	 * Interval to perform consolidation of changesets, only used if this is a trusted node.
	 * @default 60
	 */
	consolidationIntervalMinutes?: number;

	/**
	 * The number of entities to process in a single consolidation batch, only used if this is a trusted node.
	 * @default 1000
	 */
	consolidationBatchSize?: number;

	/**
	 * The maximum number of consolidations to keep in storage, only used if this is a trusted node.
	 * @default 5
	 */
	maxConsolidations?: number;

	/**
	 * The encryption key id from the vault to use for blob storage, only required for trusted nodes, untrusted nodes will request the key.
	 * @default synchronised-storage-blob-encryption-key
	 */
	blobStorageEncryptionKeyId?: string;

	/**
	 * The verifiable storage key to use, already expected to be created.
	 * if the key is not found in the keys.json it is considered to be a custom verifiable storage id.
	 * @default local
	 */
	verifiableStorageKeyId: "mainnet" | "testnet" | "devnet" | string;
}

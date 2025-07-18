// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { ISynchronisedStorageServiceConfig } from "./ISynchronisedStorageServiceConfig";

/**
 * Options for the Synchronised Storage Service constructor.
 */
export interface ISynchronisedStorageServiceConstructorOptions {
	/**
	 * The logging connector.
	 */
	loggingConnectorType?: string;

	/**
	 * The event bus component type.
	 */
	eventBusComponentType?: string;

	/**
	 * The entity storage connector type to use for sync snapshots.
	 * @default sync-snapshot-entry
	 */
	syncSnapshotStorageConnectorType?: string;

	/**
	 * The blob storage component used for remote sync state.
	 * @default blob-storage
	 */
	blobStorageComponentType?: string;

	/**
	 * The verifiable storage connector type to use for decentralised state.
	 * @default verifiable-storage
	 */
	verifiableStorageConnectorType?: string;

	/**
	 * The identity connector.
	 * @default identity
	 */
	identityConnectorType?: string;

	/**
	 * The synchronised entity storage component type to use if this node is not trusted.
	 */
	trustedSynchronisedStorageComponentType?: string;

	/**
	 * The configuration for the connector.
	 */
	config: ISynchronisedStorageServiceConfig;
}

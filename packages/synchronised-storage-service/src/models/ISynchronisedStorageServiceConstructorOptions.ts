// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { ISynchronisedStorageServiceConfig } from "./ISynchronisedStorageServiceConfig";

/**
 * Options for the Synchronised Storage Service constructor.
 */
export interface ISynchronisedStorageServiceConstructorOptions {
	/**
	 * The logging component.
	 */
	loggingComponentType?: string;

	/**
	 * The event bus component type.
	 */
	eventBusComponentType?: string;

	/**
	 * The vault connector type.
	 */
	vaultConnectorType?: string;

	/**
	 * The entity storage connector type to use for sync snapshots.
	 * @default sync-snapshot-entry
	 */
	syncSnapshotStorageConnectorType?: string;

	/**
	 * The blob storage connector used for remote sync state.
	 * @default blob-storage
	 */
	blobStorageConnectorType?: string;

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
	 * The task scheduler component.
	 * @default task-scheduler
	 */
	taskSchedulerComponentType?: string;

	/**
	 * The synchronised entity storage component type to use if this node is not trusted.
	 */
	trustedSynchronisedStorageComponentType?: string;

	/**
	 * The configuration for the connector.
	 */
	config: ISynchronisedStorageServiceConfig;
}

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { ISynchronisedStorageServiceConfig } from "./ISynchronisedStorageServiceConfig.js";

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
	 * The task scheduler component.
	 * @default task-scheduler
	 */
	taskSchedulerComponentType?: string;

	/**
	 * The rights management enforcement component to use for verifying untrusted node access.
	 * Only required on a trusted node to enforce access control.
	 * @default policy-enforcement-point
	 */
	policyEnforcementPointComponentType?: string;

	/**
	 * The synchronised entity storage component type to use if this node is not trusted.
	 * If this is set, this node uses it as the trusted node to store changesets.
	 */
	trustedSynchronisedStorageComponentType?: string;

	/**
	 * The configuration for the connector.
	 */
	config: ISynchronisedStorageServiceConfig;
}

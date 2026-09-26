// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * The types of Synchronised Storage data.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const SynchronisedStorageTypes = {
	/**
	 * Represents a synchronised storage request.
	 */
	SyncRequest: "SyncRequest",

	/**
	 * Represents a synchronised storage change set.
	 */
	SyncChangeSet: "SyncChangeSet",

	/**
	 * Represents a synchronised storage change.
	 */
	SyncChange: "SyncChange",

	/**
	 * Represents a synchronised storage change operation.
	 */
	SyncChangeOperation: "SyncChangeOperation",

	/**
	 * Represents a synchronised entity.
	 */
	SynchronisedEntity: "SynchronisedEntity",

	/**
	 * Represents the core properties of a synchronised entity.
	 */
	SynchronisedEntityCore: "SynchronisedEntityCore"
} as const;

/**
 * The types of Synchronised Storage data.
 */
export type SynchronisedStorageTypes =
	(typeof SynchronisedStorageTypes)[keyof typeof SynchronisedStorageTypes];

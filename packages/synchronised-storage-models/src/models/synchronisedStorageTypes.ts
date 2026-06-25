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
	ChangeSet: "ChangeSet"
} as const;

/**
 * The types of Synchronised Storage data.
 */
export type SynchronisedStorageTypes =
	(typeof SynchronisedStorageTypes)[keyof typeof SynchronisedStorageTypes];

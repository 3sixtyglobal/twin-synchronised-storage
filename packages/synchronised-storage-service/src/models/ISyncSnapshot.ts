// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * The object definition for a sync snapshot.
 */
export interface ISyncSnapshot {
	/**
	 * The version of the sync state.
	 */
	version: string;

	/**
	 * The id of the snapshot.
	 */
	id: string;

	/**
	 * The date the snapshot was created.
	 */
	dateCreated: string;

	/**
	 * The date the snapshot was last modified.
	 */
	dateModified: string;

	/**
	 * Is this a consolidated snapshot?
	 */
	isConsolidated: boolean;

	/**
	 * The ids of the storage for the change sets in the snapshot.
	 */
	changeSetStorageIds: string[];
}

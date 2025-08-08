// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * The object definition for the sync pointer store.
 */
export interface ISyncPointerStore {
	/**
	 * The version of the sync pointer store.
	 */
	version: string;

	/**
	 * The mapping from storage keys to sync pointers.
	 */
	syncPointers: { [key: string]: string };
}

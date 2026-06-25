// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * The payload for an item remove.
 */
export interface ISyncItemRemove {
	/**
	 * The key of the storage being removed.
	 */
	storageKey: string;

	/**
	 * The node identity of the entity being removed.
	 */
	nodeId: string;

	/**
	 * The entity being removed from the item set.
	 */
	id: string;
}

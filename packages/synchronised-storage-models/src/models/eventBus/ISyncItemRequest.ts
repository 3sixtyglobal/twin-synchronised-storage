// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Request for a local item.
 */
export interface ISyncItemRequest {
	/**
	 * The key of the storage containing the requested item.
	 */
	storageKey: string;

	/**
	 * The item id being requested.
	 */
	id: string;
}

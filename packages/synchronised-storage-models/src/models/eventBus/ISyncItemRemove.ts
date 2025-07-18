// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * The payload for an item remove.
 */
export interface ISyncItemRemove {
	/**
	 * The type of the schema being removed.
	 */
	schemaType: string;

	/**
	 * The entity being removed from the item set.
	 */
	id: string;
}

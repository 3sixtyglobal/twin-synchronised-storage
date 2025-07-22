// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Request for a local item.
 */
export interface ISyncItemRequest {
	/**
	 * The type of the schema for the entities in the batch.
	 */
	schemaType: string;

	/**
	 * The item id being requested.
	 */
	id: string;
}

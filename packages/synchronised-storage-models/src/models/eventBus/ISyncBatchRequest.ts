// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Request for a local batch.
 */
export interface ISyncBatchRequest {
	/**
	 * The type of the schema for the entities in the batch.
	 */
	schemaType: string;

	/**
	 * The size of the batch.
	 */
	batchSize: number;
}

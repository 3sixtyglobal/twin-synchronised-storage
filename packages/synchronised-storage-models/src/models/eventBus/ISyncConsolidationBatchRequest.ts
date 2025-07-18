// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Request for a local consolidation batch.
 */
export interface ISyncConsolidationBatchRequest {
	/**
	 * The type of the schema for the entities in the batch.
	 */
	schemaType: string;

	/**
	 * The size of the consolidation batch.
	 */
	consolidationBatchSize: number;
}

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Request for a local batch.
 */
export interface ISyncBatchRequest {
	/**
	 * The key of the storage for the entities in the batch.
	 */
	storageKey: string;

	/**
	 * The size of the batch.
	 */
	batchSize: number;
}

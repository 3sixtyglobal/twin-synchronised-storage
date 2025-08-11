// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { SyncNodeIdentityMode } from "../syncNodeIdentityMode";

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

	/**
	 * Determines which entries are required, for local it will match the nodeIdentity, for remote it will not include matching nodeIdentity, for all it will include all entries.
	 */
	requestMode: SyncNodeIdentityMode;
}

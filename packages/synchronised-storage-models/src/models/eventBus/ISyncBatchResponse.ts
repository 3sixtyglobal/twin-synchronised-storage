// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { ISynchronisedEntity } from "../ISynchronisedEntity";

/**
 * Response for a local batch.
 */
export interface ISyncBatchResponse {
	/**
	 * The key of the storage for the entities in the batch.
	 */
	storageKey: string;

	/**
	 * The entities in the batch.
	 */
	entities: ISynchronisedEntity[];

	/**
	 * Is this the last entry in the batch?
	 */
	lastEntry: boolean;
}

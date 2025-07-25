// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { ISynchronisedEntity } from "../ISynchronisedEntity";

/**
 * Response for a local batch.
 */
export interface ISyncBatchResponse<T extends ISynchronisedEntity> {
	/**
	 * The key of the storage for the entities in the batch.
	 */
	storageKey: string;

	/**
	 * The primary key of the entity in the sync item response.
	 */
	primaryKey: keyof T;

	/**
	 * The entities in the batch.
	 */
	entities: T[];

	/**
	 * Is this the last entry in the batch?
	 */
	lastEntry: boolean;
}

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { ISynchronisedEntity } from "../ISynchronisedEntity";

/**
 * Response for a local consolidation batch.
 */
export interface ISyncConsolidationBatchResponse<T extends ISynchronisedEntity> {
	/**
	 * The type of the schema for the entities in the batch.
	 */
	schemaType: string;

	/**
	 * The entities in the consolidation batch.
	 */
	entities: {
		id: string;
		entity: T;
	}[];

	/**
	 * Is this the last entry in the batch?
	 */
	lastEntry: boolean;
}

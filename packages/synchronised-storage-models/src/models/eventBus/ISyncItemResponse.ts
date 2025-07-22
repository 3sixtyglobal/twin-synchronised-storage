// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { ISynchronisedEntity } from "../ISynchronisedEntity";

/**
 * Response for a sync item request.
 */
export interface ISyncItemResponse<T extends ISynchronisedEntity> {
	/**
	 * The type of the schema for the entities in the batch.
	 */
	schemaType: string;

	/**
	 * The id of the entity in the sync item response.
	 */
	id: string;

	/**
	 * The entity in the sync item response, undefined if not found.
	 */
	entity?: T;
}

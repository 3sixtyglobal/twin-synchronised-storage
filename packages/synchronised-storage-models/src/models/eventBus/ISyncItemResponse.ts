// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { ISynchronisedEntity } from "../ISynchronisedEntity";

/**
 * Response for a sync item request.
 */
export interface ISyncItemResponse {
	/**
	 * The key of the storage for the entities in the batch.
	 */
	storageKey: string;

	/**
	 * The id of the entity in the sync item response.
	 */
	id: string;

	/**
	 * The entity in the sync item response, undefined if not found.
	 */
	entity?: ISynchronisedEntity;
}

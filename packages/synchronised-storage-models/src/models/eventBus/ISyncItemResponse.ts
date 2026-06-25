// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { ISynchronisedEntity } from "../ISynchronisedEntity.js";

/**
 * Response for a sync item request.
 */
export interface ISyncItemResponse {
	/**
	 * The key of the storage containing the responding item.
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

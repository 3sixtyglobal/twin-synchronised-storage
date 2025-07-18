// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { ISynchronisedEntity } from "../ISynchronisedEntity";

/**
 * The payload for an item set.
 */
export interface ISyncItemSet<T extends ISynchronisedEntity = ISynchronisedEntity> {
	/**
	 * The type of the schema being set.
	 */
	schemaType: string;

	/**
	 * The id of the item being set.
	 */
	id: string;

	/**
	 * The entity being set in the item set.
	 */
	entity: T;
}

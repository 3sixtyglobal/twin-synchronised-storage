// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { ISynchronisedEntity } from "../ISynchronisedEntity";

/**
 * The payload for an item set.
 */
export interface ISyncItemSet<T extends ISynchronisedEntity = ISynchronisedEntity> {
	/**
	 * The key of the storage being set.
	 */
	storageKey: string;

	/**
	 * The entity being set in the item set.
	 */
	entity: T;
}

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { SyncChangeOperation } from "./eventBus/syncChangeOperation";
import type { ISynchronisedEntity } from "./ISynchronisedEntity";

/**
 * The object definition for a sync change.
 */
export interface ISyncChange<T extends ISynchronisedEntity = ISynchronisedEntity> {
	/**
	 * Operation.
	 */
	operation: SyncChangeOperation;

	/**
	 * The item id.
	 */
	id: string;

	/**
	 * The entity to set.
	 */
	entity?: Omit<T, "id" | "nodeIdentity">;
}

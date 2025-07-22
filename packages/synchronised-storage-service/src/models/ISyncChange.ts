// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type {
	ISynchronisedEntity,
	SyncChangeOperation
} from "@twin.org/synchronised-storage-models";

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
	entity?: T;
}

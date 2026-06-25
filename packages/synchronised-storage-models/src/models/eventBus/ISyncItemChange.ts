// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { SyncChangeOperation } from "../syncChangeOperation.js";

/**
 * The payload for an item change.
 */
export interface ISyncItemChange {
	/**
	 * The key of the storage being changed.
	 */
	storageKey: string;

	/**
	 * The operation being performed on the item.
	 */
	operation: SyncChangeOperation;

	/**
	 * The node performing the operation.
	 */
	nodeId: string;

	/**
	 * The id of the item being changed.
	 */
	id: string;
}

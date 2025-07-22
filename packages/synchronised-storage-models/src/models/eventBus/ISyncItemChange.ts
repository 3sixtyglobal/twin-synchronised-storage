// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { SyncChangeOperation } from "./syncChangeOperation";

/**
 * The payload for an item change.
 */
export interface ISyncItemChange {
	/**
	 * The type of the schema being changed.
	 */
	schemaType: string;

	/**
	 * The operation being performed on the item.
	 */
	operation: SyncChangeOperation;

	/**
	 * The id of the item being changed.
	 */
	id: string;
}

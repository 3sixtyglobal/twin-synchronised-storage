// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { ISynchronisedEntityCore } from "./ISynchronisedEntityCore";
import type { SyncChangeOperation } from "./syncChangeOperation";

/**
 * The object definition for a sync change.
 */
export interface ISyncChange {
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
	entity?: ISynchronisedEntityCore;
}

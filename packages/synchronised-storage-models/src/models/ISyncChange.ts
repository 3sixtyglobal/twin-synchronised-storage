// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { ISynchronisedEntityCore } from "./ISynchronisedEntityCore.js";
import type { SyncChangeOperation } from "./syncChangeOperation.js";

/**
 * The object definition for a sync change.
 */
export interface ISyncChange {
	/**
	 * Operation.
	 * @json-ld type:schema:Text
	 */
	operation: SyncChangeOperation;

	/**
	 * The item id.
	 */
	id: string;

	/**
	 * The entity to set.
	 * @json-ld type:json
	 */
	entity?: ISynchronisedEntityCore;
}

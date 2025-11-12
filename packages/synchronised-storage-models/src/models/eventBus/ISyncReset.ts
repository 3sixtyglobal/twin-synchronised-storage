// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { SyncNodeIdMode } from "../syncNodeIdMode.js";

/**
 * Request to reset the local storage.
 */
export interface ISyncReset {
	/**
	 * The key of the storage for the entities in the batch.
	 */
	storageKey: string;

	/**
	 * Reset mode, this will use the nodeId in the entities to determine which are local/remote.
	 */
	resetMode: SyncNodeIdMode;
}

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { SyncNodeIdentityMode } from "../syncNodeIdentityMode";

/**
 * Request to reset the local storage.
 */
export interface ISyncReset {
	/**
	 * The key of the storage for the entities in the batch.
	 */
	storageKey: string;

	/**
	 * Reset mode, this will use the nodeIdentity in the entities to determine which are local/remote.
	 */
	resetMode: SyncNodeIdentityMode;
}

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { SynchronisedStorageContexts } from "./synchronisedStorageContexts";
import type { SynchronisedStorageTypes } from "./synchronisedStorageTypes";

/**
 * The object definition for a sync request.
 */
export interface ISyncRequest {
	/**
	 * The LD Context for the change set.
	 */
	"@context": typeof SynchronisedStorageContexts.ContextRoot;

	/**
	 * The LD Type for the change set.
	 */
	type: typeof SynchronisedStorageTypes.SyncRequest;

	/**
	 * The identity of the node that created the change set.
	 */
	nodeIdentity: string;
}

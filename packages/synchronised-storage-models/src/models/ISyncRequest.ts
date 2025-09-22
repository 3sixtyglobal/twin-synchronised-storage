// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { SynchronisedStorageContexts } from "./synchronisedStorageContexts";
import type { SynchronisedStorageTypes } from "./synchronisedStorageTypes";

/**
 * The object definition for a sync request.
 */
export interface ISyncRequest {
	/**
	 * The LD Context for the request.
	 */
	"@context": typeof SynchronisedStorageContexts.ContextRoot;

	/**
	 * The LD Type for the request.
	 */
	type: typeof SynchronisedStorageTypes.SyncRequest;

	/**
	 * The identity of the node that created the request.
	 */
	nodeIdentity: string;
}

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { ISyncChange } from "./ISyncChange.js";
import type { SynchronisedStorageContexts } from "./synchronisedStorageContexts.js";
import type { SynchronisedStorageTypes } from "./synchronisedStorageTypes.js";

/**
 * The object definition for a sync change set.
 */
export interface ISyncChangeSet {
	/**
	 * The LD Context for the change set.
	 */
	"@context": typeof SynchronisedStorageContexts.ContextRoot;

	/**
	 * The LD Type for the change set.
	 */
	type: typeof SynchronisedStorageTypes.ChangeSet;

	/**
	 * The id of the change set.
	 */
	id: string;

	/**
	 * The storage key of the change set. This is used to identify the entities being synchronised.
	 */
	storageKey: string;

	/**
	 * The date the change set was created.
	 */
	dateCreated: string;

	/**
	 * The date the change set was last modified.
	 */
	dateModified: string;

	/**
	 * The identity of the node that created the change set.
	 */
	nodeId: string;

	/**
	 * The changes to apply after a snapshot.
	 */
	changes: ISyncChange[];
}

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
	"@context": typeof SynchronisedStorageContexts.Context;

	/**
	 * The LD Type for the change set.
	 */
	type: typeof SynchronisedStorageTypes.SyncChangeSet;

	/**
	 * The id of the change set.
	 */
	id: string;

	/**
	 * The storage key of the change set. This is used to identify the entities being synchronised.
	 * @json-ld type:schema:identifier
	 */
	storageKey: string;

	/**
	 * The date the change set was created.
	 * @json-ld namespace:schema
	 */
	dateCreated: string;

	/**
	 * The date the change set was last modified.
	 * @json-ld namespace:schema
	 */
	dateModified: string;

	/**
	 * The identity of the node that created the change set.
	 * @json-ld namespace:twin-common
	 */
	nodeIdentity: string;

	/**
	 * The changes to apply after a snapshot.
	 * @json-ld type:json
	 */
	changes: ISyncChange[];
}

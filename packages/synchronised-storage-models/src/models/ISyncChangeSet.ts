// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { ISyncChange } from "./ISyncChange";
import type { ISynchronisedEntity } from "./ISynchronisedEntity";

/**
 * The object definition for a sync change set.
 */
export interface ISyncChangeSet<T extends ISynchronisedEntity = ISynchronisedEntity> {
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
	nodeIdentity: string;

	/**
	 * The changes to apply after a snapshot.
	 */
	changes: ISyncChange<T>[];
}

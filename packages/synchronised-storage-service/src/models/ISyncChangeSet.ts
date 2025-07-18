// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IProof } from "@twin.org/standards-w3c-did";
import type { ISynchronisedEntity } from "@twin.org/synchronised-storage-models";
import type { ISyncChange } from "./ISyncChange";

/**
 * The object definition for a sync change set.
 */
export interface ISyncChangeSet<T extends ISynchronisedEntity = ISynchronisedEntity> {
	/**
	 * The id of the snapshot.
	 */
	id: string;

	/**
	 * The date the change set was created.
	 */
	dateCreated: string;

	/**
	 * The schema type of the change set. This is used to identify the type of entity being synchronised.
	 */
	schemaType: string;

	/**
	 * The date the change set was last modified.
	 */
	dateModified?: string;

	/**
	 * The changes to apply after a snapshot.
	 */
	changes: ISyncChange<T>[];

	/**
	 * The identity of the node that created the change set.
	 */
	nodeIdentity: string;

	/**
	 * The proof for the change set.
	 */
	proof?: IProof;
}

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { entity, property } from "@twin.org/entity";
import type { ISyncChange, ISynchronisedEntity } from "@twin.org/synchronised-storage-models";

/**
 * Class representing an entry for the sync snapshot.
 */
@entity()
export class SyncSnapshotEntry<T extends ISynchronisedEntity = ISynchronisedEntity> {
	/**
	 * The id for the snapshot.
	 */
	@property({ type: "string", isPrimary: true })
	public id!: string;

	/**
	 * The version for the snapshot.
	 */
	@property({ type: "string" })
	public version!: string;

	/**
	 * The storage key for the snapshot i.e. which entity is being synchronized.
	 */
	@property({ type: "string", isSecondary: true })
	public storageKey!: string;

	/**
	 * The date the snapshot was created.
	 */
	@property({ type: "string" })
	public dateCreated!: string;

	/**
	 * The date the snapshot was last modified.
	 */
	@property({ type: "string" })
	public dateModified!: string;

	/**
	 * The flag to determine if this is the snapshot is the local one containing changes for this node.
	 */
	@property({ type: "boolean" })
	public isLocal!: boolean;

	/**
	 * The flag to determine if this is a consolidated snapshot.
	 */
	@property({ type: "boolean" })
	public isConsolidated!: boolean;

	/**
	 * The ids of the storage for the change sets in the snapshot, if this is not a local snapshot.
	 */
	@property({ type: "array", itemType: "string", optional: true })
	public changeSetStorageIds?: string[];

	/**
	 * The changes that were made in this snapshot, if this is a local snapshot.
	 */
	@property({ type: "array", itemType: "object", optional: true })
	public changes?: ISyncChange<T>[];
}

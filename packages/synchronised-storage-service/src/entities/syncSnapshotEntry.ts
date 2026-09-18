// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { entity, property } from "@twin.org/entity";
import type { ISyncChange } from "@twin.org/synchronised-storage-models";

/**
 * Class representing an entry for the sync snapshot.
 */
@entity()
export class SyncSnapshotEntry {
	/**
	 * The id for the snapshot.
	 */
	@property({ type: "string", isPrimary: true, maxLength: 255 })
	public id!: string;

	/**
	 * The version for the snapshot.
	 */
	@property({ type: "string", maxLength: 128 })
	public version!: string;

	/**
	 * The storage key for the snapshot i.e. which entity is being synchronized.
	 */
	@property({ type: "string", maxLength: 255, isSecondary: true })
	public storageKey!: string;

	/**
	 * The date the snapshot was created.
	 */
	@property({ type: "string", format: "date-time" })
	public dateCreated!: string;

	/**
	 * The date the snapshot was last modified.
	 */
	@property({ type: "string", format: "date-time" })
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
	 * The epoch for the changeset.
	 */
	@property({ type: "number" })
	public epoch!: number;

	/**
	 * The ids of the storage for the change sets in the snapshot, if this is not a local snapshot.
	 */
	@property({ type: "array", itemType: "string", optional: true })
	public changeSetStorageIds?: string[];

	/**
	 * The changes that were made in this snapshot, if this is a local snapshot.
	 */
	@property({ type: "array", itemType: "object", optional: true })
	public changes?: ISyncChange[];
}

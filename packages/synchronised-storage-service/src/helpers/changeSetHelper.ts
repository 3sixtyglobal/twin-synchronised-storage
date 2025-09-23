// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { BaseError, Converter, Is, ObjectHelper, RandomHelper } from "@twin.org/core";
import type { IEventBusComponent } from "@twin.org/event-bus-models";
import type { ILoggingComponent } from "@twin.org/logging-models";
import { nameof } from "@twin.org/nameof";
import {
	type ISyncChangeSet,
	type ISyncItemRemove,
	type ISyncItemSet,
	type ISyncReset,
	SyncChangeOperation,
	SynchronisedStorageTopics,
	type SyncNodeIdentityMode
} from "@twin.org/synchronised-storage-models";
import type { BlobStorageHelper } from "./blobStorageHelper";

/**
 * Class for performing change set operations.
 */
export class ChangeSetHelper {
	/**
	 * Runtime name for the class.
	 */
	public readonly CLASS_NAME: string = nameof<ChangeSetHelper>();

	/**
	 * The logging component to use for logging.
	 * @internal
	 */
	private readonly _logging?: ILoggingComponent;

	/**
	 * The event bus component.
	 * @internal
	 */
	private readonly _eventBusComponent: IEventBusComponent;

	/**
	 * The blob storage helper to use for remote sync states.
	 * @internal
	 */
	private readonly _blobStorageHelper: BlobStorageHelper;

	/**
	 * The identity of the node that is performing the update.
	 * @internal
	 */
	private _nodeIdentity?: string;

	/**
	 * Create a new instance of ChangeSetHelper.
	 * @param logging The logging component to use for logging.
	 * @param eventBusComponent The event bus component to use for events.
	 * @param blobStorageHelper The blob storage component to use for remote sync states.
	 */
	constructor(
		logging: ILoggingComponent | undefined,
		eventBusComponent: IEventBusComponent,
		blobStorageHelper: BlobStorageHelper
	) {
		this._logging = logging;
		this._eventBusComponent = eventBusComponent;
		this._blobStorageHelper = blobStorageHelper;
	}

	/**
	 * Set the node identity to use for signing changesets.
	 * @param nodeIdentity The identity of the node that is performing the update.
	 */
	public setNodeIdentity(nodeIdentity: string): void {
		this._nodeIdentity = nodeIdentity;
	}

	/**
	 * Get a changeset.
	 * @param changeSetStorageId The id of the sync changeset to apply.
	 * @returns The changeset if it was verified.
	 */
	public async getChangeset(changeSetStorageId: string): Promise<ISyncChangeSet | undefined> {
		await this._logging?.log({
			level: "info",
			source: this.CLASS_NAME,
			message: "getChangeSet",
			data: {
				changeSetStorageId
			}
		});

		try {
			const syncChangeSet =
				await this._blobStorageHelper.loadBlob<ISyncChangeSet>(changeSetStorageId);

			return syncChangeSet;
		} catch (error) {
			await this._logging?.log({
				level: "warn",
				source: this.CLASS_NAME,
				message: "getChangeSetError",
				data: {
					changeSetStorageId
				},
				error: BaseError.fromError(error)
			});
		}

		await this._logging?.log({
			level: "info",
			source: this.CLASS_NAME,
			message: "getChangeSetEmpty",
			data: {
				changeSetStorageId
			}
		});
	}

	/**
	 * Apply a sync changeset.
	 * @param changeSetStorageId The id of the sync changeset to apply.
	 * @returns The changeset if it existed.
	 */
	public async getAndApplyChangeset(
		changeSetStorageId: string
	): Promise<ISyncChangeSet | undefined> {
		const syncChangeset = await this.getChangeset(changeSetStorageId);

		// Only apply changesets from other nodes, we don't want to overwrite
		// any changes we have made to local entity storage
		if (!Is.empty(syncChangeset) && syncChangeset.nodeIdentity !== this._nodeIdentity) {
			await this.applyChangeset(syncChangeset);
		}

		return syncChangeset;
	}

	/**
	 * Apply a sync changeset.
	 * @param syncChangeset The sync changeset to apply.
	 * @returns Nothing.
	 */
	public async applyChangeset(syncChangeset: ISyncChangeSet): Promise<void> {
		if (Is.arrayValue(syncChangeset.changes)) {
			for (const change of syncChangeset.changes) {
				await this._logging?.log({
					level: "info",
					source: this.CLASS_NAME,
					message: "changeSetApplyingChange",
					data: {
						operation: change.operation,
						id: change.id
					}
				});

				switch (change.operation) {
					case SyncChangeOperation.Set:
						if (!Is.empty(change.entity)) {
							// The id was stripped from the entity as it is part of the operation
							// we make sure we reinstate it in the publish
							// Also the node identity was stripped when stored in the changeset
							// as the changeset is signed with the node identity.
							// so we need to restore it here.
							await this._eventBusComponent.publish<ISyncItemSet>(
								SynchronisedStorageTopics.RemoteItemSet,
								{
									storageKey: syncChangeset.storageKey,
									entity: {
										...change.entity,
										id: change.id,
										nodeIdentity: syncChangeset.nodeIdentity
									}
								}
							);
						}
						break;
					case SyncChangeOperation.Delete:
						if (!Is.empty(change.id)) {
							await this._eventBusComponent.publish<ISyncItemRemove>(
								SynchronisedStorageTopics.RemoteItemRemove,
								{
									storageKey: syncChangeset.storageKey,
									id: change.id,
									nodeIdentity: syncChangeset.nodeIdentity
								}
							);
						}
						break;
				}
			}
		}
	}

	/**
	 * Store the changeset.
	 * @param syncChangeSet The sync change set to store.
	 * @returns The id of the change set.
	 */
	public async storeChangeSet(syncChangeSet: ISyncChangeSet): Promise<string> {
		await this._logging?.log({
			level: "info",
			source: this.CLASS_NAME,
			message: "changeSetStoring",
			data: {
				id: syncChangeSet.id
			}
		});

		return this._blobStorageHelper.saveBlob(syncChangeSet);
	}

	/**
	 * Copy a change set.
	 * @param syncChangeSet The sync changeset to copy.
	 * @returns The id of the updated change set.
	 */
	public async copyChangeset(syncChangeSet: ISyncChangeSet): Promise<
		| {
				syncChangeSet: ISyncChangeSet;
				changeSetStorageId: string;
		  }
		| undefined
	> {
		if (Is.stringValue(this._nodeIdentity)) {
			await this._logging?.log({
				level: "info",
				source: this.CLASS_NAME,
				message: "copyChangeSet",
				data: {
					changeSetStorageId: syncChangeSet.id
				}
			});

			// Allocate a new id to the changeset copy
			const copy = ObjectHelper.clone(syncChangeSet);
			copy.id = Converter.bytesToHex(RandomHelper.generate(32));

			// Store the copy
			return {
				syncChangeSet: copy,
				changeSetStorageId: await this.storeChangeSet(copy)
			};
		}
	}

	/**
	 * Reset the storage for a given storage key.
	 * @param storageKey The key of the storage to reset.
	 * @param resetMode The reset mode, this will use the nodeIdentity in the entities to determine which are local/remote.
	 * @returns Nothing.
	 */
	public async reset(storageKey: string, resetMode: SyncNodeIdentityMode): Promise<void> {
		// If we are applying a consolidation we need to reset the local db
		// but keep any entries from the local node, as they might have been updated
		await this._logging?.log({
			level: "info",
			source: this.CLASS_NAME,
			message: "storageReset",
			data: {
				storageKey
			}
		});
		await this._eventBusComponent.publish<ISyncReset>(SynchronisedStorageTopics.Reset, {
			storageKey,
			resetMode
		});
	}
}

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { Converter, Is, RandomHelper } from "@twin.org/core";
import { ComparisonOperator } from "@twin.org/entity";
import type { IEntityStorageConnector } from "@twin.org/entity-storage-models";
import type { ILoggingConnector } from "@twin.org/logging-models";
import { nameof } from "@twin.org/nameof";
import {
	type ISynchronisedEntity,
	type SyncChangeOperation,
	SyncNodeIdentityMode
} from "@twin.org/synchronised-storage-models";
import type { ChangeSetHelper } from "./changeSetHelper";
import { SYNC_SNAPSHOT_VERSION } from "./versions";
import type { SyncSnapshotEntry } from "../entities/syncSnapshotEntry";
import type { ISyncState } from "../models/ISyncState";

/**
 * Class for performing entity storage operations in decentralised storage.
 */
export class LocalSyncStateHelper<T extends ISynchronisedEntity = ISynchronisedEntity> {
	/**
	 * Runtime name for the class.
	 */
	public readonly CLASS_NAME: string = nameof<LocalSyncStateHelper>();

	/**
	 * The logging connector to use for logging.
	 * @internal
	 */
	private readonly _logging: ILoggingConnector | undefined;

	/**
	 * The storage connector for the sync snapshot entries.
	 * @internal
	 */
	private readonly _snapshotEntryEntityStorage: IEntityStorageConnector<SyncSnapshotEntry<T>>;

	/**
	 * The change set helper to use for applying changesets.
	 * @internal
	 */
	private readonly _changeSetHelper: ChangeSetHelper<T>;

	/**
	 * Create a new instance of LocalSyncStateHelper.
	 * @param logging The logging connector to use for logging.
	 * @param snapshotEntryEntityStorage The storage connector for the sync snapshot entries.
	 * @param changeSetHelper The change set helper to use for applying changesets.
	 */
	constructor(
		logging: ILoggingConnector | undefined,
		snapshotEntryEntityStorage: IEntityStorageConnector<SyncSnapshotEntry<T>>,
		changeSetHelper: ChangeSetHelper<T>
	) {
		this._logging = logging;
		this._snapshotEntryEntityStorage = snapshotEntryEntityStorage;
		this._changeSetHelper = changeSetHelper;
	}

	/**
	 * Add a new change to the local snapshot.
	 * @param storageKey The storage key of the snapshot to add the change for.
	 * @param operation The operation to perform.
	 * @param id The id of the entity to add the change for.
	 * @returns Nothing.
	 */
	public async addLocalChange(
		storageKey: string,
		operation: SyncChangeOperation,
		id: string
	): Promise<void> {
		await this._logging?.log({
			level: "info",
			source: this.CLASS_NAME,
			message: "addLocalChange",
			data: {
				storageKey,
				operation,
				id
			}
		});

		const localChangeSnapshots = await this.getSnapshots(storageKey, true);

		if (localChangeSnapshots.length > 0) {
			const localChangeSnapshot = localChangeSnapshots[0];

			localChangeSnapshot.changes ??= [];

			// If we already have a change for this id we are
			// about to supersede it, we remove the previous change
			// to avoid having multiple changes for the same id
			const previousChangeIndex = localChangeSnapshot.changes.findIndex(change => change.id === id);
			if (previousChangeIndex !== -1) {
				localChangeSnapshot.changes.splice(previousChangeIndex, 1);
			}

			if (localChangeSnapshot.changes.length > 0) {
				localChangeSnapshot.dateModified = new Date(Date.now()).toISOString();
			}

			localChangeSnapshot.changes.push({ operation, id });

			await this.setLocalChangeSnapshot(localChangeSnapshot);
		}
	}

	/**
	 * Get the snapshot which contains just the changes for this node.
	 * @param storageKey The storage key of the snapshot to get.
	 * @param isLocal Whether to get the local snapshot or not.
	 * @returns The local snapshot entry.
	 */
	public async getSnapshots(storageKey: string, isLocal: boolean): Promise<SyncSnapshotEntry<T>[]> {
		await this._logging?.log({
			level: "info",
			source: this.CLASS_NAME,
			message: "getSnapshots",
			data: {
				storageKey
			}
		});

		const queryResult = await this._snapshotEntryEntityStorage.query({
			conditions: [
				{
					property: "isLocal",
					value: isLocal,
					comparison: ComparisonOperator.Equals
				},
				{
					property: "storageKey",
					value: storageKey,
					comparison: ComparisonOperator.Equals
				}
			]
		});

		if (queryResult.entities.length > 0) {
			await this._logging?.log({
				level: "info",
				source: this.CLASS_NAME,
				message: "getSnapshotsExists",
				data: {
					storageKey
				}
			});
			return queryResult.entities as SyncSnapshotEntry<T>[];
		}

		await this._logging?.log({
			level: "info",
			source: this.CLASS_NAME,
			message: "getSnapshotsDoesNotExist",
			data: {
				storageKey
			}
		});
		const now = new Date(Date.now()).toISOString();
		return [
			{
				version: SYNC_SNAPSHOT_VERSION,
				id: Converter.bytesToHex(RandomHelper.generate(32)),
				storageKey,
				dateCreated: now,
				dateModified: now,
				changeSetStorageIds: [],
				isLocal,
				isConsolidated: false
			}
		];
	}

	/**
	 * Set the current local snapshot with changes for this node.
	 * @param localChangeSnapshot The local change snapshot to set.
	 * @returns Nothing.
	 */
	public async setLocalChangeSnapshot(localChangeSnapshot: SyncSnapshotEntry<T>): Promise<void> {
		await this._logging?.log({
			level: "info",
			source: this.CLASS_NAME,
			message: "setLocalChangeSnapshot",
			data: {
				storageKey: localChangeSnapshot.storageKey
			}
		});
		await this._snapshotEntryEntityStorage.set(localChangeSnapshot);
	}

	/**
	 * Get the current local snapshot with the changes for this node.
	 * @param localChangeSnapshot The local change snapshot to remove.
	 * @returns Nothing.
	 */
	public async removeLocalChangeSnapshot(localChangeSnapshot: SyncSnapshotEntry<T>): Promise<void> {
		await this._logging?.log({
			level: "info",
			source: this.CLASS_NAME,
			message: "removeLocalChangeSnapshot",
			data: {
				snapshotId: localChangeSnapshot.id
			}
		});
		await this._snapshotEntryEntityStorage.remove(localChangeSnapshot.id);
	}

	/**
	 * Apply a sync state to the local node.
	 * @param storageKey The storage key of the snapshot to sync with.
	 * @param syncState The sync state to sync with.
	 * @returns Nothing.
	 */
	public async applySyncState(storageKey: string, syncState: ISyncState): Promise<void> {
		await this._logging?.log({
			level: "info",
			source: this.CLASS_NAME,
			message: "applySyncState",
			data: {
				snapshotCount: syncState.snapshots.length
			}
		});

		// Get all the existing snapshots that we have processed previously
		const existingRemoteSnapshots = await this.getSnapshots(storageKey, false);

		// Sort from newest to oldest
		const sortedSnapshots = syncState.snapshots.sort(
			(a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime()
		);

		// If we have no existing snapshots we can't have yet synced
		// in this case we need to find the most recent consolidation
		// and use that to build a complete DB table
		if (existingRemoteSnapshots.length === 0) {
			await this._logging?.log({
				level: "info",
				source: this.CLASS_NAME,
				message: "applySnapshotNoExisting",
				data: {
					storageKey
				}
			});
			const firstConsolidated = sortedSnapshots.find(snapshot => snapshot.isConsolidated);
			if (firstConsolidated) {
				// We found a consolidated snapshot, we can use it
				await this._logging?.log({
					level: "info",
					source: this.CLASS_NAME,
					message: "applySnapshotFoundConsolidated",
					data: {
						storageKey,
						snapshotId: firstConsolidated.id
					}
				});

				// We need to reset the entity storage and remove all the remote items
				// so that we use just the ones from the consolidation
				await this._changeSetHelper.reset(storageKey, SyncNodeIdentityMode.Remote);

				await this.processNewSnapshots([
					{
						...firstConsolidated,
						storageKey,
						isLocal: false
					}
				]);
			} else {
				await this._logging?.log({
					level: "info",
					source: this.CLASS_NAME,
					message: "applySnapshotNoConsolidated",
					data: {
						storageKey
					}
				});
			}
		} else {
			// Create a lookup map for the existing snapshots
			const existingSnapshots: { [id: string]: SyncSnapshotEntry<T> } = {};
			for (const snapshot of existingRemoteSnapshots) {
				existingSnapshots[snapshot.id] = snapshot;
			}

			const newSnapshots: SyncSnapshotEntry<T>[] = [];
			const modifiedSnapshots: {
				currentSnapshot: SyncSnapshotEntry<T>;
				updatedSnapshot: SyncSnapshotEntry<T>;
			}[] = [];
			const referencedExistingSnapshots: string[] = Object.keys(existingSnapshots);

			for (const snapshot of sortedSnapshots) {
				await this._logging?.log({
					level: "info",
					source: this.CLASS_NAME,
					message: "applySnapshot",
					data: {
						snapshotId: snapshot.id,
						dateCreated: new Date(snapshot.dateCreated).toISOString()
					}
				});

				// See if we have the local snapshot
				const currentSnapshot = existingSnapshots[snapshot.id];

				// As we are referencing an existing snapshot, we need to remove it from the list
				// to allow us to cleanup any unreferenced snapshots later
				const idx = referencedExistingSnapshots.indexOf(snapshot.id);
				if (idx !== -1) {
					referencedExistingSnapshots.splice(idx, 1);
				}

				const updatedSnapshot: SyncSnapshotEntry<T> = {
					...snapshot,
					storageKey,
					isLocal: false
				};

				if (Is.empty(currentSnapshot)) {
					// We don't have the snapshot locally, so we need to process it
					newSnapshots.push(updatedSnapshot);
				} else if (currentSnapshot.dateModified !== snapshot.dateModified) {
					// If the local snapshot has a different dateModified, we need to update it
					modifiedSnapshots.push({
						currentSnapshot,
						updatedSnapshot
					});
				} else {
					// we sorted the snapshots from newest to oldest, so if we found a local snapshot
					// with the same dateModified as the remote snapshot, we can stop processing further
					break;
				}
			}

			// We reverse the order of the snapshots to process them from oldest to newest
			// because we want to apply the changes in the order they were created
			await this.processModifiedSnapshots(modifiedSnapshots.reverse());
			await this.processNewSnapshots(newSnapshots.reverse());

			// Any ids remaining in this list are no longer referenced in the global state
			// so we should remove them from the local storage as they will never be updated again
			for (const referencedSnapshotId of referencedExistingSnapshots) {
				await this._snapshotEntryEntityStorage.remove(referencedSnapshotId);
			}
		}
	}

	/**
	 * Process the modified snapshots and store them in the local storage.
	 * @param modifiedSnapshots The modified snapshots to process.
	 * @returns Nothing.
	 * @internal
	 */
	private async processModifiedSnapshots(
		modifiedSnapshots: {
			currentSnapshot: SyncSnapshotEntry<T>;
			updatedSnapshot: SyncSnapshotEntry<T>;
		}[]
	): Promise<void> {
		for (const modifiedSnapshot of modifiedSnapshots) {
			await this._logging?.log({
				level: "info",
				source: this.CLASS_NAME,
				message: "processModifiedSnapshot",
				data: {
					snapshotId: modifiedSnapshot.updatedSnapshot.id,
					localModified: new Date(
						modifiedSnapshot.currentSnapshot.dateModified ??
							modifiedSnapshot.currentSnapshot.dateCreated
					).toISOString(),
					remoteModified: new Date(
						modifiedSnapshot.updatedSnapshot.dateModified ??
							modifiedSnapshot.updatedSnapshot.dateCreated
					).toISOString()
				}
			});

			const remoteChangeSetStorageIds = modifiedSnapshot.updatedSnapshot.changeSetStorageIds;
			const localChangeSetStorageIds = modifiedSnapshot.currentSnapshot.changeSetStorageIds ?? [];
			if (Is.arrayValue(remoteChangeSetStorageIds)) {
				for (const storageId of remoteChangeSetStorageIds) {
					// Check if the local snapshot does not have the storageId
					if (!localChangeSetStorageIds.includes(storageId)) {
						await this._changeSetHelper.getAndApplyChangeset(storageId);
					}
				}
			}

			await this._snapshotEntryEntityStorage.set(modifiedSnapshot.updatedSnapshot);
		}
	}

	/**
	 * Process the new snapshots and store them in the local storage.
	 * @param newSnapshots The new snapshots to process.
	 * @returns Nothing.
	 * @internal
	 */
	private async processNewSnapshots(newSnapshots: SyncSnapshotEntry<T>[]): Promise<void> {
		for (const newSnapshot of newSnapshots) {
			await this._logging?.log({
				level: "info",
				source: this.CLASS_NAME,
				message: "processNewSnapshot",
				data: {
					snapshotId: newSnapshot.id,
					dateCreated: newSnapshot.dateCreated
				}
			});

			const newSnapshotChangeSetStorageIds = newSnapshot.changeSetStorageIds ?? [];
			if (Is.arrayValue(newSnapshotChangeSetStorageIds)) {
				for (const storageId of newSnapshotChangeSetStorageIds) {
					await this._changeSetHelper.getAndApplyChangeset(storageId);
				}
			}

			await this._snapshotEntryEntityStorage.set(newSnapshot);
		}
	}
}

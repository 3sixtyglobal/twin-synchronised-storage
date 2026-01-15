// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	BaseError,
	Converter,
	Is,
	NotFoundError,
	ObjectHelper,
	RandomHelper
} from "@twin.org/core";
import type { IEventBusComponent } from "@twin.org/event-bus-models";
import type { ILoggingComponent } from "@twin.org/logging-models";
import { nameof } from "@twin.org/nameof";
import {
	type ISyncBatchRequest,
	type ISyncBatchResponse,
	type ISyncChange,
	type ISyncChangeSet,
	type ISyncItemResponse,
	SyncNodeIdMode,
	SyncChangeOperation,
	SynchronisedStorageTopics,
	SynchronisedStorageContexts,
	SynchronisedStorageTypes,
	type ISynchronisedEntity
} from "@twin.org/synchronised-storage-models";
import type { IVerifiableStorageConnector } from "@twin.org/verifiable-storage-models";
import type { BlobStorageHelper } from "./blobStorageHelper.js";
import type { ChangeSetHelper } from "./changeSetHelper.js";
import {
	SYNC_POINTER_STORE_VERSION,
	SYNC_SNAPSHOT_VERSION,
	SYNC_STATE_VERSION
} from "./versions.js";
import type { ISyncPointerStore } from "../models/ISyncPointerStore.js";
import type { ISyncSnapshot } from "../models/ISyncSnapshot.js";
import type { ISyncState } from "../models/ISyncState.js";

/**
 * Class for performing entity storage operations in decentralised storage.
 */
export class RemoteSyncStateHelper {
	/**
	 * Runtime name for the class.
	 */
	public static readonly CLASS_NAME: string = nameof<RemoteSyncStateHelper>();

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
	 * The blob storage helper.
	 * @internal
	 */
	private readonly _blobStorageHelper: BlobStorageHelper;

	/**
	 * The verifiable storage connector to use for storing sync pointers.
	 * @internal
	 */
	private readonly _verifiableSyncPointerStorageConnector: IVerifiableStorageConnector;

	/**
	 * The change set helper to use for applying changesets.
	 * @internal
	 */
	private readonly _changeSetHelper: ChangeSetHelper;

	/**
	 * The storage ids of the batch responses for each storage key.
	 * @internal
	 */
	private readonly _batchResponseStorageIds: { [storageKey: string]: string[] };

	/**
	 * The full changes for each storage key.
	 * @internal
	 */
	private readonly _populateFullChanges: {
		[storageKey: string]: {
			changes: ISyncChange[];
			entities: { [id: string]: ISynchronisedEntity | undefined };
			requestIds: string[];
			completeCallback: (id?: string) => Promise<void>;
		};
	};

	/**
	 * The synchronised storage key to use for verified storage operations.
	 * @internal
	 */
	private _synchronisedStorageKey?: string;

	/**
	 * The identity of the node that is performing the update.
	 * @internal
	 */
	private _nodeId?: string;

	/**
	 * Whether the node is trusted or not.
	 * @internal
	 */
	private readonly _isTrustedNode: boolean;

	/**
	 * Maximum number of consolidations to keep in storage.
	 * @internal
	 */
	private readonly _maxConsolidations: number;

	/**
	 * Create a new instance of RemoteSyncStateHelper.
	 * @param loggingComponent The logging component to use for logging.
	 * @param eventBusComponent The event bus component to use for events.
	 * @param verifiableSyncPointerStorageConnector The verifiable storage connector to use for storing sync pointers.
	 * @param blobStorageHelper The blob storage helper to use for remote sync states.
	 * @param changeSetHelper The change set helper to use for managing changesets.
	 * @param isTrustedNode Whether the node is trusted or not.
	 * @param maxConsolidations The maximum number of consolidations to keep in storage.
	 */
	constructor(
		loggingComponent: ILoggingComponent | undefined,
		eventBusComponent: IEventBusComponent,
		verifiableSyncPointerStorageConnector: IVerifiableStorageConnector,
		blobStorageHelper: BlobStorageHelper,
		changeSetHelper: ChangeSetHelper,
		isTrustedNode: boolean,
		maxConsolidations: number
	) {
		this._logging = loggingComponent;
		this._eventBusComponent = eventBusComponent;
		this._verifiableSyncPointerStorageConnector = verifiableSyncPointerStorageConnector;
		this._changeSetHelper = changeSetHelper;
		this._blobStorageHelper = blobStorageHelper;
		this._isTrustedNode = isTrustedNode;
		this._maxConsolidations = maxConsolidations;

		this._batchResponseStorageIds = {};
		this._populateFullChanges = {};
	}

	/**
	 * Set the node identity to use for signing changesets.
	 * @param nodeId The identity of the node that is performing the update.
	 */
	public setNodeId(nodeId: string): void {
		this._nodeId = nodeId;
	}

	/**
	 * Start the remote sync state helper.
	 */
	public async start(): Promise<void> {
		await this._eventBusComponent.subscribe<ISyncBatchResponse>(
			SynchronisedStorageTopics.BatchResponse,
			async response => {
				await this.handleBatchResponse(response.data);
			}
		);

		await this._eventBusComponent.subscribe<ISyncItemResponse>(
			SynchronisedStorageTopics.LocalItemResponse,
			async response => {
				await this.handleLocalItemResponse(response.data);
			}
		);
	}

	/**
	 * Set the synchronised storage key.
	 * @param synchronisedStorageKey The synchronised storage key to use.
	 */
	public setSynchronisedStorageKey(synchronisedStorageKey: string): void {
		this._synchronisedStorageKey = synchronisedStorageKey;
	}

	/**
	 * Build a changeset.
	 * @param storageKey The storage key of the change set.
	 * @param changes The changes to apply.
	 * @param completeCallback The callback to call when the changeset is created and stored.
	 * @returns The storage id of the change set if created.
	 */
	public async buildChangeSet(
		storageKey: string,
		changes: ISyncChange[],
		completeCallback: (syncChangeSet?: ISyncChangeSet, id?: string) => Promise<void>
	): Promise<void> {
		await this._logging?.log({
			level: "info",
			source: RemoteSyncStateHelper.CLASS_NAME,
			message: "buildingChangeSet",
			data: {
				storageKey,
				changeCount: changes.length
			}
		});

		this._populateFullChanges[storageKey] = {
			changes,
			entities: {},
			requestIds: [],
			completeCallback: async () => this.finaliseFullChanges(storageKey, completeCallback)
		};

		const setChanges = changes.filter(c => c.operation === SyncChangeOperation.Set);
		if (setChanges.length === 0) {
			// If we don't need to request any full details, we can just call the complete callback
			await this.finaliseFullChanges(storageKey, completeCallback);
		} else {
			// Otherwise we need to request the full details for each change
			this._populateFullChanges[storageKey].requestIds = setChanges.map(change => change.id);

			// Once all the requests are handled the callback will be called
			for (const change of setChanges) {
				// Create a request for each change to populate the full details
				await this._logging?.log({
					level: "info",
					source: RemoteSyncStateHelper.CLASS_NAME,
					message: "createChangeSetRequestingItem",
					data: {
						storageKey,
						id: change.id
					}
				});
				await this._eventBusComponent.publish<ISyncItemResponse>(
					SynchronisedStorageTopics.LocalItemRequest,
					{
						storageKey,
						id: change.id
					}
				);
			}
		}
	}

	/**
	 * Finalise the full details for the sync change set.
	 * @param storageKey The storage key of the change set.
	 * @param completeCallback The callback to call when the changeset is populated.
	 * @returns Nothing.
	 */
	public async finaliseFullChanges(
		storageKey: string,
		completeCallback: (syncChangeSet?: ISyncChangeSet, id?: string) => Promise<void>
	): Promise<void> {
		await this._logging?.log({
			level: "info",
			source: RemoteSyncStateHelper.CLASS_NAME,
			message: "finalisingSyncChanges",
			data: {
				storageKey
			}
		});
		if (Is.stringValue(this._nodeId)) {
			const changes = this._populateFullChanges[storageKey].changes;
			for (const change of changes) {
				change.entity = this._populateFullChanges[storageKey].entities[change.id] ?? change.entity;

				if (change.operation === SyncChangeOperation.Set && Is.objectValue(change.entity)) {
					// Remove the id from the entity as this is stored in the operation
					// and will be reinstated when the changeset is reconstituted
					ObjectHelper.propertyDelete(change.entity, "id");
					// Remove the node identity as the changeset has this stored at the top level
					// and we do not want to store it in the change itself to reduce redundancy
					ObjectHelper.propertyDelete(change.entity, "nodeId");
				}
			}

			const now = new Date(Date.now()).toISOString();
			const syncChangeSet: ISyncChangeSet = {
				"@context": SynchronisedStorageContexts.Namespace,
				type: SynchronisedStorageTypes.ChangeSet,
				id: Converter.bytesToHex(RandomHelper.generate(32)),
				dateCreated: now,
				dateModified: now,
				storageKey,
				changes,
				nodeId: this._nodeId
			};

			try {
				// If this is a trusted node, we also store the changeset
				let changeSetStorageId;
				if (this._isTrustedNode) {
					changeSetStorageId = await this._changeSetHelper.storeChangeSet(syncChangeSet);
				}

				await completeCallback(syncChangeSet, changeSetStorageId);
			} catch (err) {
				await this._logging?.log({
					level: "error",
					source: RemoteSyncStateHelper.CLASS_NAME,
					message: "finalisingSyncChangesFailed",
					data: {
						storageKey
					},
					error: BaseError.fromError(err)
				});
				await completeCallback();
			}
		} else {
			await completeCallback();
		}
	}

	/**
	 * Add a new changeset into the sync state.
	 * @param storageKey The storage key of the change set to add.
	 * @param changeSetStorageId The id of the change set to add the current state
	 * @returns Nothing.
	 */
	public async addChangeSetToSyncState(
		storageKey: string,
		changeSetStorageId: string
	): Promise<void> {
		await this._logging?.log({
			level: "info",
			source: RemoteSyncStateHelper.CLASS_NAME,
			message: "addChangeSetToSyncState",
			data: {
				storageKey,
				changeSetStorageId
			}
		});

		// First load the sync pointer store to get the current sync pointer for the storage key
		const syncPointerStore = await this.getVerifiableSyncPointerStore();

		let syncState: ISyncState | undefined;
		if (!Is.empty(syncPointerStore.syncPointers[storageKey])) {
			syncState = await this.getSyncState(syncPointerStore.syncPointers[storageKey]);
		}

		// No current sync state, so we create a new one
		if (Is.empty(syncState)) {
			syncState = { version: SYNC_STATE_VERSION, storageKey, snapshots: [] };
		}

		// Sort the snapshots so the newest snapshot is last in the array
		const sortedSnapshots = syncState.snapshots.sort((a, b) =>
			a.dateCreated.localeCompare(b.dateCreated)
		);

		// Get the current snapshot, if it does not exist we create a new one
		let currentSnapshot: ISyncSnapshot | undefined = sortedSnapshots[sortedSnapshots.length - 1];
		const currentEpoch = currentSnapshot?.epoch ?? 0;
		const now = new Date(Date.now()).toISOString();

		// If there is no snapshot or the current one is a consolidation
		// we start a new snapshot
		if (Is.empty(currentSnapshot) || currentSnapshot.isConsolidated) {
			currentSnapshot = {
				version: SYNC_SNAPSHOT_VERSION,
				id: Converter.bytesToHex(RandomHelper.generate(32)),
				dateCreated: now,
				dateModified: now,
				isConsolidated: false,
				epoch: currentEpoch + 1,
				changeSetStorageIds: []
			};
			syncState.snapshots.push(currentSnapshot);
		} else {
			// Snapshot exists, we update the dateModified
			currentSnapshot.dateModified = now;
		}

		// Add the changeset storage id to the current snapshot
		currentSnapshot.changeSetStorageIds.push(changeSetStorageId);

		// Store the sync state in the blob storage
		syncPointerStore.syncPointers[storageKey] = await this.storeRemoteSyncState(syncState);

		// Store the verifiable sync pointer store in the verifiable storage
		await this.storeVerifiableSyncPointerStore(syncPointerStore);
	}

	/**
	 * Create a consolidated snapshot for the entire storage.
	 * @param storageKey The storage key of the snapshot to create.
	 * @param batchSize The batch size to use for consolidation.
	 * @returns Nothing.
	 */
	public async consolidationStart(storageKey: string, batchSize: number): Promise<void> {
		await this._logging?.log({
			level: "info",
			source: RemoteSyncStateHelper.CLASS_NAME,
			message: "consolidationStarting"
		});

		// Perform a batch request to start the consolidation
		await this._eventBusComponent.publish<ISyncBatchRequest>(
			SynchronisedStorageTopics.BatchRequest,
			{ storageKey, batchSize, requestMode: SyncNodeIdMode.All }
		);
	}

	/**
	 * Get the sync pointer store.
	 * @returns The sync pointer store.
	 */
	public async getVerifiableSyncPointerStore(): Promise<ISyncPointerStore> {
		if (Is.stringValue(this._synchronisedStorageKey)) {
			try {
				await this._logging?.log({
					level: "info",
					source: RemoteSyncStateHelper.CLASS_NAME,
					message: "verifiableSyncPointerStoreRetrieving",
					data: {
						key: this._synchronisedStorageKey
					}
				});
				const syncPointerStore = await this._verifiableSyncPointerStorageConnector.get(
					this._synchronisedStorageKey,
					{ includeData: true }
				);
				if (Is.uint8Array(syncPointerStore.data)) {
					const syncPointer = ObjectHelper.fromBytes<ISyncPointerStore>(syncPointerStore.data);
					await this._logging?.log({
						level: "info",
						source: RemoteSyncStateHelper.CLASS_NAME,
						message: "verifiableSyncPointerStoreRetrieved",
						data: {
							key: this._synchronisedStorageKey
						}
					});
					return syncPointer;
				}
			} catch (err) {
				if (!BaseError.someErrorName(err, NotFoundError.CLASS_NAME)) {
					throw err;
				}
			}

			await this._logging?.log({
				level: "info",
				source: RemoteSyncStateHelper.CLASS_NAME,
				message: "verifiableSyncPointerStoreNotFound",
				data: {
					key: this._synchronisedStorageKey
				}
			});
		}

		// If no sync pointer store exists, we return an empty one
		return {
			version: SYNC_POINTER_STORE_VERSION,
			syncPointers: {}
		};
	}

	/**
	 * Store the verifiable sync pointer in the verifiable storage.
	 * @param syncPointerStore The sync pointer store to store.
	 * @returns Nothing.
	 */
	public async storeVerifiableSyncPointerStore(syncPointerStore: ISyncPointerStore): Promise<void> {
		if (Is.stringValue(this._nodeId) && Is.stringValue(this._synchronisedStorageKey)) {
			await this._logging?.log({
				level: "info",
				source: RemoteSyncStateHelper.CLASS_NAME,
				message: "verifiableSyncPointerStoreStoring",
				data: {
					key: this._synchronisedStorageKey
				}
			});

			// Store the verifiable sync pointer in the verifiable storage
			await this._verifiableSyncPointerStorageConnector.update(
				this._nodeId,
				this._synchronisedStorageKey,
				ObjectHelper.toBytes<ISyncPointerStore>(syncPointerStore)
			);
		}
	}

	/**
	 * Store the remote sync state.
	 * @param syncState The sync state to store.
	 * @returns The id of the sync state.
	 */
	public async storeRemoteSyncState(syncState: ISyncState): Promise<string> {
		await this._logging?.log({
			level: "info",
			source: RemoteSyncStateHelper.CLASS_NAME,
			message: "syncStateStoring",
			data: {
				snapshotCount: syncState.snapshots.length
			}
		});

		// Limits the number of consolidations in the list so that we can shrink decentralised
		// storage requirements, sort from newest to oldest so that we can easily find the
		// oldest snapshots to remove.
		const snapshots = syncState.snapshots.sort(
			(a, b) => new Date(a.dateCreated).getTime() - new Date(b.dateCreated).getTime()
		);

		// Find all the consolidation indexes
		const consolidationIndexes = [];
		for (let i = 0; i < snapshots.length; i++) {
			const snapshot = snapshots[i];
			if (snapshot.isConsolidated) {
				consolidationIndexes.push(i);
			}
		}

		if (consolidationIndexes.length > this._maxConsolidations) {
			// Once we have reached the max for consolidations we need to remove
			// all the snapshots, including non consolidated ones, beyond this point
			const toRemove = snapshots.slice(consolidationIndexes[this._maxConsolidations - 1] + 1);

			syncState.snapshots = snapshots.slice(
				0,
				consolidationIndexes[this._maxConsolidations - 1] + 1
			);

			for (const snapshot of toRemove) {
				// We need to remove all the storage ids associated with the snapshot
				if (Is.arrayValue(snapshot.changeSetStorageIds)) {
					for (const storageId of snapshot.changeSetStorageIds) {
						await this._blobStorageHelper.removeBlob(storageId);
					}
				}
			}
		}

		return this._blobStorageHelper.saveBlob(syncState);
	}

	/**
	 * Get the remote sync state.
	 * @param syncPointerId The id of the sync pointer to retrieve the state for.
	 * @returns The remote sync state.
	 */
	public async getSyncState(syncPointerId: string): Promise<ISyncState | undefined> {
		try {
			await this._logging?.log({
				level: "info",
				source: RemoteSyncStateHelper.CLASS_NAME,
				message: "syncStateRetrieving",
				data: {
					syncPointerId
				}
			});
			const syncState = await this._blobStorageHelper.loadBlob<ISyncState>(syncPointerId);

			if (Is.object(syncState)) {
				await this._logging?.log({
					level: "info",
					source: RemoteSyncStateHelper.CLASS_NAME,
					message: "syncStateRetrieved",
					data: {
						syncPointerId,
						snapshotCount: syncState.snapshots.length
					}
				});
				return syncState;
			}
		} catch (error) {
			await this._logging?.log({
				level: "warn",
				source: RemoteSyncStateHelper.CLASS_NAME,
				message: "getSyncStateError",
				data: {
					syncPointerId
				},
				error: BaseError.fromError(error)
			});
		}

		await this._logging?.log({
			level: "info",
			source: RemoteSyncStateHelper.CLASS_NAME,
			message: "syncStateNotFound",
			data: {
				syncPointerId
			}
		});
	}

	/**
	 * Handle the batch response which is triggered from a consolidation request.
	 * @param response The batch response to handle.
	 */
	private async handleBatchResponse(response: ISyncBatchResponse): Promise<void> {
		if (Is.stringValue(this._nodeId)) {
			const now = new Date(Date.now()).toISOString();

			// Create a new snapshot entry for the current batch
			const syncChangeSet: ISyncChangeSet = {
				"@context": SynchronisedStorageContexts.Namespace,
				type: SynchronisedStorageTypes.ChangeSet,
				id: Converter.bytesToHex(RandomHelper.generate(32)),
				dateCreated: now,
				dateModified: now,
				changes: response.entities.map(change => ({
					operation: SyncChangeOperation.Set,
					id: change.id
				})),
				storageKey: response.storageKey,
				nodeId: this._nodeId
			};

			// Store the changeset in the blob storage
			const changeSetStorageId = await this._changeSetHelper.storeChangeSet(syncChangeSet);

			// Add the changeset storage id to the snapshot ids
			this._batchResponseStorageIds[response.storageKey] ??= [];
			this._batchResponseStorageIds[response.storageKey].push(changeSetStorageId);

			// If this is the last entry in the batch response, we can create the consolidated snapshot
			if (response.lastEntry) {
				// Get the current sync pointer store
				const syncPointerStore = await this.getVerifiableSyncPointerStore();

				let syncState: ISyncState | undefined;

				if (Is.stringValue(syncPointerStore.syncPointers[response.storageKey])) {
					// If the sync pointer exists, we load the current sync state
					syncState = await this.getSyncState(syncPointerStore.syncPointers[response.storageKey]);
				}

				// If the sync state does not exist, we create a new one
				syncState ??= {
					version: SYNC_STATE_VERSION,
					storageKey: response.storageKey,
					snapshots: []
				};

				// Sort the snapshots so the newest snapshot is last in the array
				const sortedSnapshots = syncState.snapshots.sort((a, b) =>
					a.dateCreated.localeCompare(b.dateCreated)
				);
				const currentSnapshot: ISyncSnapshot | undefined =
					sortedSnapshots[sortedSnapshots.length - 1];
				const currentEpoch = currentSnapshot?.epoch ?? 0;

				const batchSnapshot: ISyncSnapshot = {
					version: SYNC_SNAPSHOT_VERSION,
					id: Converter.bytesToHex(RandomHelper.generate(32)),
					dateCreated: now,
					dateModified: now,
					isConsolidated: true,
					epoch: currentEpoch + 1,
					changeSetStorageIds: this._batchResponseStorageIds[response.storageKey]
				};
				syncState.snapshots.push(batchSnapshot);

				// Store the updated sync state
				const syncStateId = await this.storeRemoteSyncState(syncState);

				syncPointerStore.syncPointers[response.storageKey] = syncStateId;

				// Store the verifiable sync pointer in the verifiable storage
				await this.storeVerifiableSyncPointerStore(syncPointerStore);

				// Remove the batch response storage ids for the storage key
				// as we have consolidated the changes
				delete this._batchResponseStorageIds[response.storageKey];

				await this._logging?.log({
					level: "info",
					source: RemoteSyncStateHelper.CLASS_NAME,
					message: "consolidationCompleted"
				});
			}
		}
	}

	/**
	 * Handle the item response.
	 * @param response The item response to handle.
	 */
	private async handleLocalItemResponse(response: ISyncItemResponse): Promise<void> {
		await this._logging?.log({
			level: "info",
			source: RemoteSyncStateHelper.CLASS_NAME,
			message: "createChangeSetRespondingItem",
			data: {
				storageKey: response.storageKey,
				id: response.id
			}
		});
		// We have received a response to an item request, find the right storage
		// for the request id
		if (!Is.empty(this._populateFullChanges[response.storageKey])) {
			const idx = this._populateFullChanges[response.storageKey].requestIds.indexOf(response.id);

			if (idx !== -1) {
				this._populateFullChanges[response.storageKey].requestIds.splice(idx, 1);
				this._populateFullChanges[response.storageKey].entities[response.id] = response.entity;

				// If there are no request ids remaining we can complete the population
				if (this._populateFullChanges[response.storageKey].requestIds.length === 0) {
					await this._populateFullChanges[response.storageKey].completeCallback();
				}
			}
		}
	}
}
